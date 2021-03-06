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
const _defaults = require( 'lodash/defaults' );
const PollService = require( './PollService' );
const PushFace = require( './PushFace' );
const ReceiverFace = require( './ReceiverFace' );
const $asyncevent = require( 'futoin-asyncevent' );
const { cmpIds } = require( './common' );

const WORKER_STATE = Symbol( 'WORKER_STATE' );

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

        $asyncevent( this, [
            'pushError',
            'queueOverflow',
        ] );

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
     * @param {boolean} [options.allow_reliable=true] - allow reliable consumers
     * @param {boolean} [options.allow_polling=true] - allow polling calls
     * @returns {PushService} instance
     */
    static register( as, executor, options={} )
    {
        const ifacever = 'futoin.evt.push:' + PushFace.LATEST_VERSION;
        const impl = new this( as, executor, options );
        const spec_dirs = PushFace.spec();

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
        const chunk_size = this._maxChunkEvents( reqinfo.channel() );

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
                    chunk_size,
                };
                Object.seal( state );

                channel.onInvokerAbort( () =>
                {
                    this._cleanupChannel( echan_key, echan, iface );
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
                    {
                        executor,
                        ident,
                        last_id: '0',
                        want,
                        is_reliable: true,
                        chunk_size,
                    }
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
                        chunk_size,
                    };
                    Object.seal( state );

                    const worker_as = $as();
                    worker_as.state[WORKER_STATE] = state;
                    channel.onInvokerAbort( () =>
                    {
                        worker_as.state[WORKER_STATE] = null;
                        this._cleanupChannel( echan_key, echan, iface );
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

    _cleanupChannel( echan_key, echan, consumer_key )
    {
        echan.removeConsumer( consumer_key );

        // cleanup empty channels
        if ( !echan.consumers.size )
        {
            this._echannels.delete( echan_key );
        }
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
                const chunk_limit = state.chunk_size;
                const is_reliable = state.ident !== null;
                let chunk = filtered;

                if ( is_reliable && ( cmpIds( chunk[0].id, state.last_id ) <= 0 ) )
                {
                    chunk = PushService._trimChunk( chunk, state.last_id );

                    if ( !chunk )
                    {
                        continue;
                    }
                }

                const chunk_len = chunk.length;
                state.queue_count += chunk_len;

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

                // Add new chunk, splitting, if needed
                if ( chunk_len > chunk_limit )
                {
                    for ( let s = 0; s < chunk_len; )
                    {
                        const clen = Math.min( chunk_len - s, chunk_limit );
                        c_queue.push( chunk.slice( s, s + clen ) );
                        s += clen;
                    }
                }
                else
                {
                    c_queue.push( chunk );
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

            const chunk = PushService._mergeQueue( state );

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
                    state.req_count--;
                    stats.live_fails++;
                    this._onPushError( as, err );
                }
            ).execute();

            stats.live_calls++;
        }
    }

    _reliableWorker( as )
    {
        const evt_stats = this._stats;

        const sendEvents = ( as, state, events ) =>
        {
            if ( !events.length )
            {
                return;
            }

            const last_id = events[events.length - 1].id;

            state.iface.onEvents( as, state.seq_id, events );
            evt_stats.reliable_calls++;

            as.add( ( as ) => this._recordLastId( as, state.ident, last_id ) );
            as.add( ( as ) =>
            {
                state.seq_id++;
                state.last_id = last_id;
            } );
        };

        as.loop( ( as ) => as.add(
            ( as ) =>
            {
                const state = as.state[WORKER_STATE];

                if ( !state )
                {
                    // graceful shutdown
                    as.break();
                }

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

                        sendEvents( as, state, history_push );

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
                                state.history_push = ( history_push.length >= state.chunk_size );
                            }
                        } );
                    }
                    else
                    {
                        // get new events for pushing
                        this._pollEvents(
                            as,
                            {
                                executor: state.executor,
                                ident: state.ident,
                                last_id: state.last_id,
                                want : state.want,
                                is_reliable: true,
                                chunk_size: state.chunk_size,
                            }
                        );

                        as.add( ( as, events ) =>
                        {
                            state.history_push = events;
                        } );
                    }
                }
                else if ( queue.length )
                {
                    const chunk = PushService._mergeQueue( state );

                    as.loop( ( as ) => as.add(
                        ( as ) =>
                        {
                            sendEvents( as, state, chunk );
                            as.add( ( as ) => as.break() );
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
                if ( err === 'LoopBreak' )
                {
                    return;
                }

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

    static _mergeQueue( state )
    {
        const queue = state.queue;
        const limit = state.chunk_size;
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


/**
 * Emitted in push error handlers
 * @event PushService#pushError
 */

/**
 * Emitted in push error handlers
 * @event PushService#queueOverflow
 */
