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

const PushFace = require( './PushFace' );
const main = require( './main' );
const ee = require( 'event-emitter' );

/**
 * Base implementation for reliable receiver side
 */
class ReliableReceiverService
{
    /**
     * Register futoin.evt.receiver interface with Executor
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {PushService} instance
     */
    static register( as, executor, options={} )
    {
        const ifacever = 'futoin.evt.receiver:' + PushFace.LATEST_VERSION;
        const impl = new this( executor, options );
        const spec_dirs = main.specDirs;

        executor.register( as, ifacever, impl, spec_dirs );

        return impl;
    }

    constructor( executor, _options )
    {
        this._reset( executor );
        ee( this );
    }

    _reset( executor )
    {
        this._next_seq_id = 0;
        this._out_of_order = new Map();
        executor.once( 'close', () => this._reset( executor ) );
    }

    onEvents( as, reqinfo )
    {
        const p = reqinfo.params();
        let seq_id = p.seq;

        // extra "if" is cheaper than empty step
        if ( this._next_seq_id !== seq_id )
        {
            as.add( ( as ) =>
            {
                // check again due to race condition
                if ( this._next_seq_id !== seq_id )
                {
                    as.setCancel( ( as ) => this._out_of_order.delete( seq_id ) );
                    this._out_of_order.set( seq_id, as );
                    as.waitExternal();
                }
            } );
        }

        as.add( ( as ) =>
        {
            this._onEvents( as, reqinfo, p.events );
        } );

        as.add( ( as ) =>
        {
            this._out_of_order.delete( seq_id );
            this._next_seq_id = ++seq_id;

            if ( this._out_of_order.has( seq_id ) )
            {
                try
                {
                    this._out_of_order.get( seq_id ).success();
                }
                catch ( e )
                {
                    // ignore
                }

                this._out_of_order.delete( seq_id );
            }

            reqinfo.result( true );
        } );
    }

    _onEvents( as, _reqinfo, _events )
    {
        as.error( 'NotImplemented' );
    }
}

module.exports = ReliableReceiverService;


/**
 * Emitted after new events being pushed to DWH
 * @event ReliableReceiverService#newEvents
 */
