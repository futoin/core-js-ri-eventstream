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

module.exports = {
    FTN18_VERSION : '1.1',
    PING_VERSION : '1.0',
    DB_IFACEVER : 'futoin.db.l2:1.0',
    DB_EVTTABLE : 'evt_queue',
    DB_EVTCONSUMERS : 'evt_consumers',
    DB_EVTHISTORY : 'evt_history',
    GEN_FACE : '#evtgen',
    POLL_FACE : '#evtpoll',
    PUSH_FACE : '#evtpush',

    cmpIds: function( a, b )
    {
        const a_len = a.length;
        const b_len = b.length;

        if ( a_len === b_len )
        {
            return a.localeCompare( b );
        }
        else
        {
            return a_len - b_len;
        }
    },
};
