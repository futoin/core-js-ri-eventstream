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

const _defaults = require( 'lodash/defaults' );
const PollService = require( './PollService' );
const { DB_IFACEVER, DB_EVTTABLE, DB_EVTCONSUMERS } = require( './common' );

/**
 * Database-based Poll Service
 */
class DBPollService extends PollService
{
    /**
     * Please use DBPollService,register()
     *
     * @param {AsyncSteps} as - async step interface
     * @param {Executor} executor - related Executor
     * @param {object} [options={}] - options
     * @param {string} [options.event_table=default] - events table
     * @param {string} [options.consumer_table=default] - consumers table
     */
    constructor( as, executor, options )
    {
        super( as, executor, options );

        _defaults( options, {
            event_table: DB_EVTTABLE,
            consumer_table: DB_EVTCONSUMERS,
        } );

        const ccm = executor.ccm();
        ccm.assertIface( '#db.evt', DB_IFACEVER );

        const qb = ccm.db( 'evt' ).queryBuilder();
        this._evt_table = qb.identifier( options.event_table );
        this._consumer_table = qb.identifier( options.consumer_table );
    }

    _registerConsumer( as, executor, ident )
    {
        as.add(
            ( as ) =>
            {
                const db = executor.ccm().db( 'evt' );
                const now = db.helpers().now();

                db.insert( this._consumer_table )
                    .set( {
                        last_evt_id: 0,
                        reg_time: now,
                        last_time: now,
                        ident,
                    } )
                    .execute( as );
            },
            ( as, err ) =>
            {
                if ( err === 'Duplicate' )
                {
                    as.success();
                }
            }
        );
    }

    _pollEvents( as, { executor, ident, last_id, want, is_reliable, chunk_size } )
    {
        const db = executor.ccm().db( 'evt' );
        const xfer = db.newXfer( db.SERIALIZABLE );
        const helpers = xfer.helpers();

        // Update info
        if ( is_reliable )
        {
            // check, if registered
            xfer.select( this._consumer_table, { selected: 1 } )
                .get( 'id' )
                .where( { ident } )
                .forUpdate();

            xfer.update( this._consumer_table )
                .set( {
                    last_evt_id: last_id,
                    last_time: helpers.now(),
                } )
                .where( {
                    ident,
                    'last_evt_id <=': last_id,
                } );

            // make sure to select actual last_id
            last_id = db.select( this._consumer_table )
                .get( 'last_evt_id' )
                .where( { ident } );
        }
        else
        {
            last_id = parseInt( last_id );
        }

        // Actual select
        const s = xfer.select( this._evt_table, { result: true } )
            .get( [ 'id', 'type', 'data', 'ts' ] )
            .where( 'id >', last_id )
            .limit( chunk_size );

        if ( want )
        {
            s.where( 'type IN', want );
        }

        as.add(
            ( as ) =>
            {
                xfer.execute( as );

                as.add( ( as, res ) =>
                {
                    const events = this._res2events( res[0].rows, helpers );

                    // Make sure we do not run through events again
                    // and again.
                    if ( !events.length && want )
                    {
                        const xfer = db.newXfer( db.SERIALIZABLE );

                        const sq = xfer.select(
                            [ db.select( this._evt_table )
                                .get( 'max_id', 'MAX(id)' ), 'ETM' ],
                            { selected: 1 }
                        ).where( 'max_id IS NOT NULL' );

                        xfer.select(
                            this._evt_table,
                            { result: true,
                                selected: false } )
                            .get( [ 'id', 'type', 'data', 'ts' ] )
                            .where( 'id >', last_id )
                            .where( 'type IN', want )
                            .limit( chunk_size );

                        const uq = xfer.update( this._consumer_table );
                        uq.set( 'last_evt_id', uq.backref( sq, 'max_id' ) );
                        uq.where( { ident } );

                        as.add(
                            ( as ) => xfer.execute( as ),
                            ( as, err ) =>
                            {
                                if ( err === 'XferCondition' )
                                {
                                    as.success();
                                }
                            }
                        );
                        as.add( ( as ) => as.success( events ) );
                    }
                    else
                    {
                        as.success( events );
                    }
                } );
            },
            ( as, err ) =>
            {
                if ( err === 'XferCondition' )
                {
                    // it may get triggered on failed update as well...
                    as.error( 'NotRegistered' );
                }
            }
        );
    }

    _res2events( rows, helpers )
    {
        return rows.map( ( v ) => ( {
            id: `${v[0]}`,
            type: v[1],
            data: JSON.parse( v[2] ),
            ts: helpers.nativeDate( v[3] ).format(),
        } ) );
    }
}

module.exports = DBPollService;
