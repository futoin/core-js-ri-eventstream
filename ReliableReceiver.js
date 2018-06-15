'use strict';

/**
 * @file
 *
 * Copyright 2017-2018 FutoIn Project (https://futoin.org)
 * Copyright 2017-2018 Andrey Galkin <andrey@futoin.org>
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

const LiveReceiver = require( './LiveReceiver' );
const ReliableReceiverService = require( './ReliableReceiverService' );

/**
 * Reliable Event Receiver helper to minimize boilerplate code in projects.
 */
class ReliableReceiver extends LiveReceiver
{
    /**
     * Override to register custom instance of ReliableReceiverService.
     *
     * @param {AsyncSteps} as - async steps interface
     * @param {Executor} executor - Internal Executor instance
     * @param {object} options - passed options
     *
     * @returns {ReliableReceiverService} instance of service
     */
    _registerReceiver( as, executor, options )
    {
        const receiver = this;
        const svc_class = class extends ReliableReceiverService
        {
            _onEvents( as, _reqinfo, events )
            {
                receiver._onEvents( as, events );
            }
        };

        return svc_class.register( as, executor, options );
    }
}

module.exports = ReliableReceiver;

