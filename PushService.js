'use strict';

const $as = require( 'futoin-asyncsteps' );
const _defaults = require( 'lodash/defaults' );
const PingFace = require( 'futoin-invoker/PingFace' );
const PollService = require( './PollService' );
const PushFace = require( './PushFace' );
const ReceiverFace = require( './ReceiverFace' );
const ee = require( 'event-emitter' );

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
        this.consumers.set( iface, state );
    }

    removeConsumer( iface )
    {
        this.consumers.delete( iface );
    }
}

/**
 * Implement queuing algo with options to tune:
 * 1. on small packet - add delay to allow filling up
 * 2. add progressive delay to fill packets with deadline
 * 3. if following chunk is fully filled, then send current one
 *  half-filled to avoid continuous fragmentation on restore of throughput
 */


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
            request_max: 2,
        } );

        // Dynamically created channels based on "want"
        this._echannels = new Map();
        // max events in queue for reliable delivery
        this._queue_max = options.queue_max;
        // max parallel requests per consumer
        this._request_max = options.request_max;

        this._stats = {
            skip_on_live: 0,
            skip_on_reliable: 0,
            live_calls: 0,
            live_fails: 0,
            reliable_calls: 0,
            reliable_fails: 0,
        };
        Object.seal( this._stats );
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
        const ifacever = 'futoin.evt.push:' + PushFace.LATEST_VERSION;
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

            if ( !iface )
            {
                as.error( 'InternalError',
                    'Failed to register receiver iface' );
            }

            const echan_key = EventChannel.want2key( want );
            let echan = this._echannels.get( echan_key );

            if ( !echan )
            {
                echan = new EventChannel( want );
                this._echannels.set( echan_key, echan );
            }

            if ( component === 'LIVE' )
            {
                const state = {
                    seq_id: 0,
                    req_count: 0,
                    queue: [],
                    queue_count: 0,
                    ident: null,
                    iface,
                };

                channel.onInvokerAbort( () =>
                {
                    echan.removeConsumer( iface );
                } );

                echan.addConsumer( iface, state );

                this._pokeWorker();
                reqinfo.result( true );
            }
            else if ( this._allow_reliable )
            {
                const executor = reqinfo.executor();
                const user_id = reqinfo.info.USER_INFO.localID();
                const ident = `${user_id}:${component}`;

                this._pollEvents(
                    as,
                    executor,
                    ident,
                    null,
                    want,
                    true
                );

                as.add( ( as, events ) =>
                {
                    const worker_as = $as();
                    const state = worker_as.state;
                    Object.assign( state, {
                        seq_id: 0,
                        queue: [],
                        queue_count: 0,
                        last_id: 0,
                        ident,
                        executor,
                        iface,
                        want,
                        wait_as: null,
                        history_push: events.length ? events : false,
                    } );

                    channel.onInvokerAbort( () =>
                    {
                        echan.removeConsumer( iface );
                        worker_as.cancel();
                    } );

                    echan.addConsumer( iface, state );

                    worker_as.add( ( as ) => this._reliableWorker( as ) );
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

    _pokeWorker()
    {
        throw new Error( 'Not Implemented' );
    }

    _recordLastId( as, _ident, _last_id )
    {
        throw new Error( 'Not Implemented' );
    }

    _onEvents( events )
    {
        const QUEUE_MAX = this._queue_max;
        const stats = this._stats;

        for ( let [ k, echan ] of this._echannels.entries() )
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

            for ( let state of consumers.values() )
            {
                const c_queue = state.queue;
                const is_reliable = state.ident !== null;

                c_queue.push( filtered );
                state.queue_count += filtered.length;

                // removed oldest queue chunks on reach of limit
                while ( state.queue_count > QUEUE_MAX )
                {
                    state.queue_count -= c_queue[0].length;
                    c_queue.shift();

                    if ( is_reliable )
                    {
                        if ( !state.history_push )
                        {
                            state.history_push = true;
                        }

                        stats.skip_on_reliable += 1;
                    }
                    else
                    {
                        stats.skip_on_live += 1;
                    }
                }

                if ( is_reliable )
                {
                    // trigger further execution of worker steps
                    if ( state.wait_as )
                    {
                        try
                        {
                            state.wait_as.success();
                            state.wait_as = null;
                        }
                        catch ( e )
                        {
                            // ignore
                        }
                    }
                }
                else
                {
                    this._pushLive( state );
                }
            }
        }
    }

    _pushLive( state )
    {
        const stats = this._stats;

        if ( state.req_count < this._request_max )
        {
            state.req_count += 1;
            const seq_id = state.seq_id + 1;
            state.seq_id = seq_id;

            const chunk = PushService._mergeQueue( state, this.MAX_EVENTS );

            // live events
            $as().add(
                ( as ) =>
                {
                    state.iface.onEvents( as, seq_id, chunk );
                    as.add( ( as ) =>
                    {
                        state.req_count -= 1;

                        if ( state.queue.length )
                        {
                            this._pushLive( state );
                        }
                    } );
                },
                ( as, err ) =>
                {
                    this._onError( as, err );
                    state.req_count -= 1;
                    stats.live_fails += 1;
                }
            ).execute();

            stats.live_calls += 1;
        }
    }

    _reliableWorker( as )
    {
        const MAX_EVENTS = this.MAX_EVENTS;
        const state = as.state;
        const evt_stats = this._stats;

        const sendEvents = ( as, events ) =>
        {
            const seq_id = state.seq_id + 1;
            state.seq_id = seq_id;
            const last_id = events[events.length - 1].id;

            state.iface.onEvents( as, seq_id, events );
            evt_stats.reliable_calls += 1;
            return last_id;
        };

        as.loop( ( as ) => as.add(
            ( as ) =>
            {
                const queue = state.queue;
                const last_id = state.last_id;

                if ( state.history_push && queue.length && queue[0][0].id <= last_id )
                {
                    state.history_push = false;

                    // remove already sent queued items
                    while ( queue.length )
                    {
                        const chunk = PushService._trimChunk( queue[0], last_id );

                        if ( chunk )
                        {
                            queue[0] = chunk;
                            break;
                        }
                        else
                        {
                            queue.shift();
                            continue;
                        }
                    }
                }

                const history_push = state.history_push;

                // If have history events or marked for history push
                if ( history_push )
                {
                    // if already have history events
                    if ( history_push instanceof Array )
                    {
                        if ( !history_push.length )
                        {
                            state.history_push = false;
                            as.continue();
                        }

                        const next_last_id = sendEvents( as, history_push );

                        as.add( ( as ) =>
                        {
                            state.last_id = next_last_id;
                            state.history_push = ( history_push.length >= MAX_EVENTS );
                            as.continue();
                        } );
                    }
                    else
                    {
                        // get new events for pushing
                        this._pollEvents(
                            as,
                            state.executor,
                            state.ident,
                            state.last_id,
                            state.want,
                            true
                        );

                        as.add( ( as, events ) =>
                        {
                            state.history_push = events;
                            as.continue();
                        } );
                    }
                }
                else if ( queue.length )
                {
                    const chunk = PushService._mergeQueue( state, this.MAX_EVENTS );

                    as.loop( ( as ) => as.add(
                        ( as ) =>
                        {
                            const next_last_id = sendEvents( as, chunk );

                            as.add( ( as ) =>
                            {
                                state.last_id = next_last_id;
                                this._recordLastId( as, state.ident, next_last_id );
                                as.break();
                            } );
                        },
                        ( as, err ) =>
                        {
                            if ( err !== 'LoopBreak' )
                            {
                                this._onError( as, err );
                                as.success();
                            }
                        }
                    ) );
                }
                else
                {
                    state.wait_as = as;
                    as.waitExternal();
                }
            },
            ( as, err ) =>
            {
                if ( err !== 'LoopCont' )
                {
                    this._onError( as, err );

                    evt_stats.reliable_fails += 1;
                    as.success();
                }
            }
        ) );
    }

    static _trimChunk( chunk, last_id )
    {
        if ( chunk[0].id > last_id )
        {
            return chunk;
        }

        if ( chunk[chunk.length - 1].id <= last_id )
        {
            return null;
        }

        let start = 0;
        let end = chunk.length - 1;
        let i;

        while ( start < end )
        {
            i = start + ~~( ( end - start ) / 2 );

            const c = chunk[i].id;

            if ( c === last_id )
            {
                start = i + 1;
                break;
            }

            if ( c < last_id )
            {
                start = i + 1;
            }

            if ( c > last_id )
            {
                end = i;
            }
        }

        if ( chunk.length <= start )
        {
            return null;
        }

        return chunk.slice( start );
    }

    static _mergeQueue( state, limit )
    {
        const queue = state.queue;
        let chunk = queue.shift();

        if ( !queue.length || ( chunk.length + queue[0].length ) > limit )
        {
            state.queue_count -= chunk.length;
            return chunk;
        }

        chunk = chunk.slice();

        while ( queue.length && ( chunk.length + queue[0].length ) <= limit )
        {
            Array.prototype.push.apply( chunk, queue.shift() );
        }

        state.queue_count -= chunk.length;
        return chunk;
    }

    _onError( as, err )
    {
        this.emit( 'pushError', err, as.state.error_info, as.state.last_exception );
    }
}

module.exports = PushService;

ee( PushService.prototype );

/**
 * Emitted in push error handlers
 * @event PushService#pushError
 */
