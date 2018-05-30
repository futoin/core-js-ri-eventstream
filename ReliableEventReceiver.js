'use strict';

/**
 * @file
 *
 * Copyright 2018 FutoIn Project (https://futoin.org)
 * Copyright 2018 Andrey Galkin <andrey@futoin.org>
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

const EventArchiver = require( './EventArchiver' );
const ReliableReceiverService = require( './ReliableReceiverService' );

/**
 * Reliable Event Receiver helper to minimize boilerplate code in projects.
 *
 * @note No more than one instance should run at once.
 * @todo Refactor to be based for EventArchiver, but not vice-versa.
 */
class ReliableEventReceiver extends EventArchiver
{
    static get COMPONENT()
    {
        return 'LIVE';
    }

    /**
     * C-tor
     *
     * @param {AdvancedCCM} db_ccm - CCM instance with registered '#db.evtdwh' interface
     */
    constructor( db_ccm )
    {
        super( db_ccm );
    }

    _registerReceiver( as, executor )
    {
        const receiver = this;
        const svc_class = class extends ReliableReceiverService
        {
            _onEvents( as, _reqinfo, events )
            {
                receiver._onEvents( as, events );
            }
        };

        return svc_class.register( as, executor );
    }

    _onEvents( as, _events )
    {
        as.error( 'NotImplemented' );
    }
}

module.exports = ReliableEventReceiver;
