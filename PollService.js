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
const PingService = require( 'futoin-executor/PingService' );
const PollFace = require( './PollFace' );


/**
 * Event Stream - Poll Service Base
 */
class PollService extends PingService
{
    get MAX_EVENTS()
    {
        return 1000;
    }

    /**
     * Register futoin.evt.poll interface with Executor
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @param {boolean} [options.allow_reliable=true] - allow reliable consumers
     * @param {boolean} [options.allow_polling=true] - allow polling calls
     * @param {integer} [options.max_chunk_events=100] - maxium events per request
     * @returns {PollService} instance
     *
     * @note Chunk event count is lower then protocol permits by default as there is
     *       a typical amount 64K futoin message limit.
     */
    static register( as, executor, options={} )
    {
        const ifacever = 'futoin.evt.poll:' + PollFace.LATEST_VERSION;
        const impl = new this( as, executor, options );
        const spec_dirs = PollFace.spec();

        executor.register( as, ifacever, impl, spec_dirs );
        executor.once( 'close', () => impl._close() );

        return impl;
    }

    constructor( as, _executor, options )
    {
        super();
        _defaults( options, {
            allow_reliable: true,
            allow_polling: true,
            max_chunk_events: 100,
        } );
        this._allow_reliable = options.allow_reliable;
        this._allow_polling = options.allow_polling;
        this._max_chunk_events = options.max_chunk_events;
    }

    _close()
    {
    }

    _maxChunkEvents( channel )
    {
        if ( channel.type() === 'INTERNAL' )
        {
            return this.MAX_EVENTS;
        }

        return this._max_chunk_events;
    }

    registerConsumer( as, reqinfo )
    {
        const component = reqinfo.params().component;

        if ( component === 'LIVE' )
        {
            as.error( 'LiveNotAllowed',
                'Live consumer should not register' );
        }

        if ( !this._allow_reliable )
        {
            as.error( 'SecurityError', 'Registration is not allowed' );
        }

        const user_id = reqinfo.info.USER_INFO.localID();
        const ident = `${user_id}:${component}`;

        reqinfo.result( true ); // set in advance
        this._registerConsumer( as, reqinfo.executor(), ident );
    }

    _registerConsumer( as, _executor, _ident )
    {
        as.error( 'NotImplemented', 'Please override PollService#_registerConsumer' );
    }

    pollEvents( as, reqinfo )
    {
        if ( !this._allow_polling )
        {
            as.error( 'SecurityError', 'Only event push is allowed' );
        }

        const params = reqinfo.params();
        const component = params.component;
        const user_id = reqinfo.info.USER_INFO.localID();
        const ident = `${user_id}:${component}`;
        const last_id = params.last_id || '0';
        const want = params.want;
        const is_reliable = ( component !== 'LIVE' );

        if ( is_reliable && !this._allow_reliable )
        {
            as.error( 'SecurityError', 'Reliable delivery is disabled' );
        }

        const chunk_size = this._maxChunkEvents( reqinfo.channel() );
        this._pollEvents( as, {
            executor: reqinfo.executor(),
            ident,
            last_id,
            want,
            is_reliable,
            chunk_size } );
        as.add( ( as, res ) => reqinfo.result( res ) );
    }

    _pollEvents( as, { _executor, _ident, _last_id, _want, _is_reliable, _chunk_size } )
    {
        as.error( 'NotImplemented', 'Please override PollService#_pollEvents' );
    }
}

module.exports = PollService;
