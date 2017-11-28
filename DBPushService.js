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
const $as = require( 'futoin-asyncsteps' );

const DBPollService = require( './DBPollService' );
const PushService = require( './PushService' );
const { DB_IFACEVER, DB_EVTTABLE, DB_EVTCONSUMERS } = require( './common' );

/**
 * Database-specific Push Service
 */
class DBPushService extends PushService
{
    /**
     * Please use DBPushService,register()
     *
     * @param {AsyncSteps} as - async step interface
     * @param {Executor} executor - related Executor
     * @param {object} [options={}] - options
     * @param {string} [options.event_table=default] - events table
     * @param {string} [options.consumer_table=default] - consumers table
     * @param {integer} [options.sleep_min=100] - minimal sleep on lack of events
     * @param {integer} [options.sleep_max=3000] - maximal sleep on lack of events
     * @param {integer} [options.sleep_step=100] - sleep time increase on lack of events
     */
    constructor( as, executor, options )
    {
        super( as, executor, options );

        _defaults(
            options,
            {
                sleep_min: 100,
                sleep_max: 3000,
                sleep_step: 100,
                event_table: DB_EVTTABLE,
                consumer_table: DB_EVTCONSUMERS,
            }
        );


        const ccm = executor.ccm();
        this._ccm = ccm;
        ccm.assertIface( '#db.evt', DB_IFACEVER );

        const qb = ccm.db( 'evt' ).queryBuilder();
        this._evt_table = qb.identifier( options.event_table );
        this._consumer_table = qb.identifier( options.consumer_table );

        this._worker_as = null;

        this._sleep_min = options.sleep_min;
        this._sleep_max = options.sleep_max;
        this._sleep_step = options.sleep_step;
        this._sleep_curr = this._sleep_min;
        this._sleep_prev = 0;
    }

    _close()
    {
        if ( this._worker_as )
        {
            this._worker_as.cancel();
            this._worker_as = null;
        }

        super._close();
    }

    _recordLastId( as, ident, last_id )
    {
        const db = this._ccm.db( 'evt' );
        const qb = db.update( this._consumer_table );
        qb
            .set( {
                last_evt_id: last_id,
                last_time: qb.helpers().now(),
            } )
            .where( {
                ident,
                'last_evt_id <=': last_id,
            } )
            .execute( as );
    }

    _pokeWorker()
    {
        if ( this._worker_as )
        {
            return;
        }

        const was = $as();

        // startup
        was.loop( ( as ) => as.add(
            ( as ) =>
            {
                const db = this._ccm.db( 'evt' );

                db.select( this._evt_table )
                    .get( 'last_id', 'MAX(id)' )
                    .execute( as );

                as.add( ( as, res ) =>
                {
                    const state = as.state;
                    state.last_id = `${res.rows[0][0] || 0}`;
                    as.break();
                } );
            },
            ( as, err ) =>
            {
                if ( err !== 'LoopBreak' )
                {
                    this._onPushError( as, err );
                    as.success();
                }
            }
        ) );

        // main loop
        was.loop( ( as ) => as.add(
            ( as ) =>
            {
                if ( !this._echannels.size )
                {
                    this._worker_as = null;
                    as.break();
                }

                const db = this._ccm.db( 'evt' );
                const MAX_EVENTS = this.MAX_EVENTS;

                const xfer = db.newXfer( db.SERIALIZABLE );
                xfer.select( this._evt_table, { result: true } )
                    .get( [ 'id', 'type', 'data', 'ts' ] )
                    .where( 'id >', as.state.last_id )
                    .order( 'id' )
                    .limit( MAX_EVENTS );
                xfer.execute( as );

                as.add( ( as, res ) =>
                {
                    const events = this._res2events( res[0].rows, db.helpers() );
                    const elen = events.length;

                    if ( elen )
                    {
                        this._onEvents( events );
                        as.state.last_id = events[events.length - 1].id;
                    }

                    if ( elen >= MAX_EVENTS )
                    {
                        let curr = this._sleep_curr - this._sleep_step;

                        if ( curr < this._sleep_min )
                        {
                            curr = this._sleep_min;
                        }

                        this._sleep_curr = curr;
                        this._sleep_prev = 0;
                    }
                    else
                    {
                        let curr;

                        // only if previous sleep was not enough
                        if ( this._sleep_prev === this._sleep_curr )
                        {
                            curr = this._sleep_curr + this._sleep_step;

                            if ( curr > this._sleep_max )
                            {
                                curr = this._sleep_max;
                            }

                            this._sleep_curr = curr;
                        }
                        else
                        {
                            curr = this._sleep_curr;
                        }

                        as.waitExternal();
                        setTimeout( () =>
                        {
                            if ( this._worker_as === was )
                            {
                                as.success();
                            }
                        }, curr );
                        this._sleep_prev = curr;
                    }
                } );
            },
            ( as, err ) =>
            {
                if ( err !== 'LoopBreak' )
                {
                    this._onPushError( as, err );
                    as.success();
                }
            }
        ) );
        was.execute();
        this._worker_as = was;
    }
}

for ( let f of [ '_registerConsumer', '_pollEvents', '_res2events' ] )
{
    DBPushService.prototype[f] = DBPollService.prototype[f];
}

module.exports = DBPushService;
