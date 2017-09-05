'use strict';

const $as = require( 'futoin-asyncsteps' );
const _defaults = require( 'lodash/defaults' );
const PingFace = require( 'futoin-invoker/PingFace' );
const PollService = require( './PollService' );
const PushFace = require( './PushFace' );
const ReceiverFace = require( './ReceiverFace' );

class EventChannel
{
    static want2key( want )
    {
        if ( !want )
        {
            return '*';
        }

        return want.sort().join( ':' );
    }

    constructor( want )
    {
        this.want = want ? new Set( want ) : null;
        this.consumers = new Map();
    }

    addConsumer( iface, state )
    {
        this.consumers.add( iface, state );
    }

    removeConsumer( iface )
    {
        this.consumers.delete( iface );
    }
}


/**
 * Event Stream - Push Service Base
 */
class PushService extends PollService
{
    constructor( as, executor, options )
    {
        super( as, executor, options );
        _defaults( options, {
            queue_max: 10e3,
            request_max: 3,
        } );

        // Dynamically created channels based on "want"
        this._echannels = new Map();
        // max events in queue for reliable delivery
        this._queue_max = options.queue_max;
        // max parallel requests per consumer
        this._request_max = options.request_max;

        this._stats = {
            skip_on_live: 0,
            live_calls: 0,
        };
    }

    /**
     * Register futoin.evt.push interface with Executor
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {PushService} instance
     */
    static register( as, executor, options={} )
    {
        const ifacever = 'futoin.evt.poll:' + PushFace.LATEST_VERSION;
        const impl = new this( as, executor, options );
        const spec_dirs = [ PushFace.spec(), PingFace.spec( PushFace.PING_VERSION ) ];

        executor.register( as, ifacever, impl, spec_dirs );
        executor.once( 'close', () => impl._close() );

        return impl;
    }

    _close()
    {
    }

    readyToReceive( as, reqinfo )
    {
        const params = reqinfo.params();
        const component = params.component;
        const channel = reqinfo.channel();

        const ifacever = ReceiverFace.register( as, channel );

        as.add( ( as ) =>
        {
            const iface = channel.iface( ifacever );
            const want = params.want;


            const echan_key = EventChannel.want2key( want );
            let echan = this._echannels.get( echan_key );

            if ( !echan )
            {
                echan = new EventChannel( want );
                this._echannels.set( echan_key, echan );
            }

            if ( component === 'LIVE' )
            {
                channel.onInvokerAbort(
                    () => echan.removeConsumer( iface ) );

                echan.addConsumer( iface, {
                    seq_id: 0,
                    req_count: 0,
                    want,
                    queue: false,
                } );
                this._pokeWorker();
                reqinfo.result( true );
            }
            else if ( this._allow_reliable )
            {
                const user_id = parseInt( reqinfo.info.USER_INFO.localID() );
                const ident = `${user_id}:${component}`;
                this._getLastID( as, ident );
                as.add( ( as, last_id ) =>
                {
                    const worker_as = $as();
                    const state = {
                        seq_id: 0,
                        req_count: 0,
                        queue: [],
                        queue_count: 0,
                        want,
                        last_id,
                        root_as: worker_as,
                    };

                    channel.onInvokerAbort( () =>
                    {
                        echan.removeConsumer( iface );
                        worker_as.cancel();
                    } );

                    echan.addConsumer( iface, state );

                    worker_as.add( this._reliableWorker );
                    worker_as.execute();

                    this._pokeWorker();
                    reqinfo.result( true );
                } );
            }
            else
            {
                as.error( 'SecurityError', 'Only LIVE delivery is allowed' );
            }
        } );
    }

    _getLastID( as, _ident )
    {
        as.error( 'InternalError', 'Not implemented PushService#_getLastID' );
    }

    _pokeWorker()
    {
        throw new Error( 'Not Implemented' );
    }

    _onEvents( events )
    {
        const REQUEST_MAX = this._request_max;
        const stats = this._stats;

        for ( let [ k, echan ] in this._echannels.entries() )
        {
            let consumers = echan.consumers;

            // cleanup empty channels
            if ( !consumers.size )
            {
                this._echannels.delete( k );
                continue;
            }

            let want = echan.want;
            let filtered;

            if ( want )
            {
                filtered = events.filter( ( v ) => ( want.get( v.type ) !== undefined ) );
            }
            else
            {
                filtered = events;
            }

            if ( !filtered.length )
            {
                continue;
            }

            for ( let [ iface, state ] in consumers )
            {
                if ( state.queue )
                {
                    // reliable TODO
                }
                else if ( state.req_count < REQUEST_MAX )
                {
                    state.req_count += 1;
                    const seq_id = state.seq_id + 1;
                    state.seq_id = seq_id;

                    // live events
                    $as().add(
                        ( as ) =>
                        {
                            iface.onEvents( as, seq_id, filtered );
                        },
                        ( as, err ) =>
                        {
                            state.req_count -= 1;
                        }
                    ).execute();

                    stats.live_calls += 1;
                }
                else
                {
                    stats.skip_on_live += 1;
                }
            }
        }
    }

    _reliableWorker( as )
    {
        // TODO
    }
}

module.exports = PushService;
