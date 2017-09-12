'use strict';

const $as = require( 'futoin-asyncsteps' );
const _defaults = require( 'lodash/defaults' );
const PingFace = require( 'futoin-invoker/PingFace' );
const PollService = require( './PollService' );
const PushFace = require( './PushFace' );
const ReceiverFace = require( './ReceiverFace' );
const ee = require( 'event-emitter' );
const { cmpIds } = require( './common' );

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
                Object.seal( state );

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
                    const state = {
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
                    };
                    Object.seal( state );

                    const worker_as = $as();
                    worker_as.state.worker = state;
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
                filtered = events.filter( ( v ) => ( want.has( v.type ) ) );
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
                    const removed = c_queue.shift();
                    state.queue_count -= removed.length;

                    this.emit( 'queueOverflow', state.ident || 'LIVE', removed.length );

                    if ( is_reliable )
                    {
                        if ( !state.history_push )
                        {
                            state.history_push = true;
                        }

                        stats.skip_on_reliable++;
                    }
                    else
                    {
                        stats.skip_on_live++;
                        state.seq_id++; // indicate skip
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
            state.req_count++;
            const seq_id = state.seq_id++;

            const chunk = PushService._mergeQueue( state, this.MAX_EVENTS );

            // live events
            $as().add(
                ( as ) =>
                {
                    state.iface.onEvents( as, seq_id, chunk );
                    as.add( ( as ) =>
                    {
                        state.req_count--;

                        if ( state.queue.length )
                        {
                            this._pushLive( state );
                        }
                    } );
                },
                ( as, err ) =>
                {
                    this._onPushError( as, err );
                    state.req_count--;
                    stats.live_fails++;
                }
            ).execute();

            stats.live_calls++;
        }
    }

    _reliableWorker( as )
    {
        const MAX_EVENTS = this.MAX_EVENTS;
        const state = as.state.worker;
        const evt_stats = this._stats;

        const sendEvents = ( as, events ) =>
        {
            const last_id = events[events.length - 1].id;

            state.iface.onEvents( as, state.seq_id, events );
            evt_stats.reliable_calls++;

            as.add( ( as ) =>
            {
                state.seq_id++;
                state.last_id = last_id;
            } );
        };

        as.loop( ( as ) => as.add(
            ( as ) =>
            {
                const queue = state.queue;
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

                        sendEvents( as, history_push );

                        as.add( ( as ) =>
                        {
                            const last_id = state.last_id;

                            if ( queue.length &&
                                ( cmpIds( queue[0][0].id, last_id ) <= 0 ) )
                            {
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

                                state.history_push = false;
                            }
                            else
                            {
                                state.history_push = ( history_push.length >= MAX_EVENTS );
                            }
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
                        } );
                    }
                }
                else if ( queue.length )
                {
                    const chunk = PushService._mergeQueue( state, this.MAX_EVENTS );

                    as.loop( ( as ) => as.add(
                        ( as ) =>
                        {
                            sendEvents( as, chunk );

                            as.add( ( as ) =>
                            {
                                this._recordLastId( as, state.ident, state.last_id );
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
                    this._onPushError( as, err );

                    evt_stats.reliable_fails++;
                    as.success();
                }
            }
        ) );
    }

    static _trimChunk( chunk, last_id )
    {
        if ( cmpIds( chunk[0].id, last_id ) > 0 )
        {
            return chunk;
        }

        if ( cmpIds( chunk[chunk.length - 1].id, last_id ) <= 0 )
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
            const cmp_res = cmpIds( c, last_id );

            if ( !cmp_res )
            {
                start = i + 1;
                break;
            }

            if ( cmp_res < 0 )
            {
                start = i + 1;
            }
            else
            {
                end = i;
            }
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

    _onPushError( as, err )
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

/**
 * Emitted in push error handlers
 * @event PushService#queueOverflow
 */
