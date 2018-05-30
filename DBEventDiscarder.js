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

const $as = require( 'futoin-asyncsteps' );
const $asyncevent = require( 'futoin-asyncevent' );
const { DB_IFACEVER, DB_EVTTABLE, DB_EVTCONSUMERS } = require( './common' );

/**
 * DB-specific event discarding.
 *
 * It's assumed to be run against "active" database part as defined in the concept
 * to reduce its size after all reliably delivered events are delivered to consumers.
 *
 * Event are deleted based on limit_at_once to avoid too large transactions which
 * may affect performance of realtime processes and break some DB clusters like Galera.
 */
class DBEventDiscarder
{
    constructor()
    {
        this._worker_as = null;
        $asyncevent( this, [
            'workerError',
            'eventDiscard',
        ] );
    }

    /**
     * Start event discarding
     *
     * @param {AdvancedCCM} ccm - CCM with registered #db.evt interface
     * @param {object} [options={}] - options
     * @param {integer} [options.poll_period_ms=600e3] - poll interval
     * @param {integer} [options.limit_at_once=1000] - events to delete at once
     * @param {string} [options.event_table=default] - events table
     * @param {string} [options.consumer_table=default] - consumers table
     */
    start( ccm, {
        poll_period_ms = 600e3,
        limit_at_once = 1e3,
        event_table = DB_EVTTABLE,
        consumer_table = DB_EVTCONSUMERS,
    }={} )
    {
        if ( this._worker_as )
        {
            return;
        }

        ccm.assertIface( '#db.evt', DB_IFACEVER );
        ccm.once( 'close', () => this.stop() );

        const was = $as();
        this._worker_as = was;
        was.loop( ( as ) => as.add(
            ( as ) =>
            {
                const db = ccm.db( 'evt' );

                // NOTE: if last_id IS NULL then it should not delete anything

                const sel_last_id = db
                    .select( consumer_table )
                    .get( 'last_id', 'MIN(last_evt_id)' );

                const sel_id = db
                    .select( event_table )
                    .get( 'id' )
                    .where( 'id <=', sel_last_id )
                    .order( 'id' )
                    .limit( limit_at_once );

                // Workaround MySQL case:
                // ER_NOT_SUPPORTED_YET: This version of MySQL doesn't yet support 'LIMIT & IN/ALL/ANY/SOME subquery'
                const sel_id_wrap = ( db._db_type !== 'mysql' )
                    ? sel_id
                    : db.select( [ sel_id, 'IDs' ] );

                const del_events = db.delete( event_table )
                    .where( 'id IN', sel_id_wrap );
                // console.log(del_events._toQuery());
                del_events.execute( as );

                as.add( ( as, res ) =>
                {
                    if ( res.affected )
                    {
                        this.emit( 'eventDiscard', res.affected );
                    }
                    else
                    {
                        const timer = setTimeout(
                            () => as.success(),
                            poll_period_ms );
                        as.setCancel( ( as ) => clearTimeout( timer ) );
                    }
                } );
            },
            ( as, err ) =>
            {
                this._onWorkerError( as, err );
                as.success();
            }
        ) );
        was.execute();
    }

    /**
     * Stop event discarding
     */
    stop()
    {
        if ( this._worker_as )
        {
            this._worker_as.cancel();
            this._worker_as = null;
        }
    }

    _onWorkerError( as, err )
    {
        this.emit( 'workerError', err, as.state.error_info, as.state.last_exception );
    }
}

module.exports = DBEventDiscarder;

/**
 * Emitted on worker errors
 * @event DBEventDiscarder#workerError
 */

/**
 * Emitted on discarded events
 * @event DBEventDiscarder#eventDiscard
 */
