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

const ReceiverService = require( './ReceiverService' );

const NEXT_SEQ_ID = Symbol( 'NEXT_SEQ_ID' );
const OUT_OF_ORDER = Symbol( 'OUT_OF_ORDER' );

/**
 * Base implementation for reliable receiver side.
 *
 * @note Unlike ReceiverService, it restores proper order of events.
 */
class ReliableReceiverService extends ReceiverService
{
    constructor( executor, options )
    {
        super( executor, options );
        this._reset( executor );
    }

    _reset( executor )
    {
        this[NEXT_SEQ_ID] = 0;
        this[OUT_OF_ORDER] = new Map();
        executor.once( 'close', () => this._reset( executor ) );
    }

    onEvents( as, reqinfo )
    {
        const p = reqinfo.params();
        let seq_id = p.seq;

        // extra "if" is cheaper than empty step
        if ( this[NEXT_SEQ_ID] !== seq_id )
        {
            as.add( ( as ) =>
            {
                // check again due to race condition
                if ( this[NEXT_SEQ_ID] !== seq_id )
                {
                    as.setCancel( ( as ) => this[OUT_OF_ORDER].delete( seq_id ) );
                    this[OUT_OF_ORDER].set( seq_id, as );
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
            this[OUT_OF_ORDER].delete( seq_id );
            this[NEXT_SEQ_ID] = ++seq_id;

            if ( this[OUT_OF_ORDER].has( seq_id ) )
            {
                try
                {
                    this[OUT_OF_ORDER].get( seq_id ).success();
                }
                catch ( e )
                {
                    // ignore
                }

                this[OUT_OF_ORDER].delete( seq_id );
            }

            reqinfo.result( true );
        } );
    }
}

module.exports = ReliableReceiverService;
