'use strict';

/**
 * @file
 *
 * Copyright 2017 FutoIn Project (https://futoin.org)
 * Copyright 2017 Andrey Galkin <andrey@futoin.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const $asyncevent = require( 'futoin-asyncevent' );

const ReliableReceiver = require( './ReliableReceiver' );
const ReliableReceiverService = require( './ReliableReceiverService' );
const { DB_IFACEVER, DB_EVTHISTORY, cmpIds } = require( './common' );

const MAX_XFER_EVENTS = 100;

/**
 * Database Event Archiver service.
 *
 * @note No more than one instance should run at once.
 */
class DBEventArchiver extends ReliableReceiver
{
    static get COMPONENT()
    {
        return 'ARCHIVER';
    }

    /**
     * C-tor
     *
     * @param {AdvancedCCM} db_ccm - CCM instance with registered '#db.evtdwh' interface
     */
    constructor( db_ccm )
    {
        super( db_ccm );
        $asyncevent( this, [ 'processedEvents' ] );
        db_ccm.assertIface( '#db.evtdwh', DB_IFACEVER );
    }

    _registerReceiver( as, executor, options )
    {
        const archiver = this;
        const SYM_LAST_ID = Symbol( 'LAST_ID' );
        const SYM_HISTORY_TABLE = Symbol( 'SYM_HISTORY_TABLE' );
        const receiver = class extends ReliableReceiverService
        {
            constructor( executor, options )
            {
                super( executor, options );
                this[SYM_LAST_ID] = null;
                this[SYM_HISTORY_TABLE] = options.history_table || DB_EVTHISTORY;
            }

            _onEvents( as, reqinfo, events )
            {
                const ccm = reqinfo.executor().ccm();
                const db = ccm.db( 'evtdwh' );
                const history_table = this[SYM_HISTORY_TABLE];

                // startup & error recovery
                if ( !this[SYM_LAST_ID] )
                {
                    as.add( ( as ) =>
                    {
                        db.select( history_table )
                            .get( 'last_id', 'MAX(id)' )
                            .execute( as );
                        as.add( ( as, res ) =>
                        {
                            this[SYM_LAST_ID] = `${res.rows[0][0] || 0}`;
                        } );
                    } );
                }

                as.add( ( as ) =>
                {
                    const iter = events[Symbol.iterator]();
                    let last_id = this[SYM_LAST_ID];
                    let c = iter.next();

                    // Skip already archived
                    //---
                    for ( ;; )
                    {
                        if ( c.done )
                        {
                            return;
                        }

                        if ( cmpIds( c.value.id, last_id ) > 0 )
                        {
                            break;
                        }

                        c = iter.next();
                    }

                    // Push to DB
                    //---
                    as.setCancel( ( as ) =>
                    {
                        // make sure to re-read Last ID on any error
                        this[SYM_LAST_ID] = null;
                    } );

                    while ( !c.done )
                    {
                        const q = db.insert( history_table );
                        const helpers = q.helpers();
                        let next_last_id = last_id;
                        let j;

                        for ( j = 0; j < MAX_XFER_EVENTS && !c.done; ++j )
                        {
                            const v = c.value;

                            q.set( {
                                id : v.id,
                                type: v.type,
                                data: JSON.stringify( v.data ),
                                ts: helpers.date( v.ts ),
                            } );
                            q.newRow();

                            next_last_id = v.id;
                            c = iter.next();
                        }

                        q.execute( as );

                        as.add( ( as ) =>
                        {
                            this[SYM_LAST_ID] = next_last_id;
                            archiver.emit( 'processedEvents', j );
                        } );
                    }
                } );
            }
        };

        return receiver.register( as, executor, options );
    }
}

module.exports = DBEventArchiver;

/**
 * Emitted for count of archived events in each iteration.
 * @event ReliableReceiver#processedEvents
 */

