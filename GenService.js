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

const PingService = require( 'futoin-executor/PingService' );
const PingFace = require( 'futoin-invoker/PingFace' );
const GenFace = require( './GenFace' );


/**
 * Event Stream - Generator Service Base
 */
class GenService extends PingService
{
    /**
     * Register futoin.evt.gen interface with Executor
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {GenService} instance
     */
    static register( as, executor, options={} )
    {
        const ifacever = 'futoin.evt.gen:' + GenFace.LATEST_VERSION;
        const impl = new this( as, executor, options );
        const spec_dirs = [ GenFace.spec(), PingFace.spec( GenFace.PING_VERSION ) ];

        executor.register( as, ifacever, impl, spec_dirs );
        executor.once( 'close', () => impl._close() );

        return impl;
    }

    _close()
    {
    }
}

module.exports = GenService;
