'use strict';

const _defaults = require( 'lodash/defaults' );
const $as = require( 'futoin-asyncsteps' );

const DBPollService = require( './DBPollService' );
const PushService = require( './PushService' );
const { DB_IFACEVER, DB_EVTTABLE, DB_EVTCONSUMERS } = require( './common' );

class DBPushService extends PushService
{
    constructor( _as, executor, options )
    {
        super( _as, executor, options );

        _defaults(
            options,
            {
                sleep_min: 100,
                sleep_max: 3000,
                sleep_step: 100,
            }
        );

        this._ccm = executor.ccm();
        this._ccm.assertIface( '#db.evt', DB_IFACEVER );
        this._evt_table = options.event_table || DB_EVTTABLE;
        this._consumer_table = options.consumer_table || DB_EVTCONSUMERS;

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

                    if ( res.rows.length )
                    {
                        state.last_id = `${res.rows[0][0] || 0}`;
                    }
                    else
                    {
                        state.last_id = '0';
                    }

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

                const q = db.select( this._evt_table )
                    .get( [ 'id', 'type', 'data', 'ts' ] )
                    .where( 'id >=', as.state.last_id )
                    .order( 'id' )
                    .limit( MAX_EVENTS );
                const helpers = q.helpers();

                q.execute( as );

                as.add( ( as, res ) =>
                {
                    const events = this._res2events( res.rows, helpers );
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
