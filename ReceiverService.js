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

/**
 * Base implementation for receiver side
 */
class ReceiverService
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

    onEvents( as, reqinfo )
    {
        this._onEvents( as, reqinfo, reqinfo.params().events );
    }

    /**
     * Member to override to handle vents.
     * @param {AsyncSteps} as - AsyncSteps interface
     * @param {RequestInfo} reqinfo - request info object
     * @param {array} events - list of events
     */
    _onEvents( as, reqinfo, events )
    {
        void reqinfo;
        void events;
        as.error( 'NotImplemented' );
    }
}

module.exports = ReceiverService;
