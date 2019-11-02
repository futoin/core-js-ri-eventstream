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

const { SPEC_DIRS } = require( '@futoin/specs' );
const { NativeIface } = require( 'futoin-invoker' );
const { FTN18_VERSION } = require( './common' );


/**
 * Event Stream - Receiver Face
 */
class ReceiverFace extends NativeIface
{
    /**
     * Latest supported FTN17 version
     */
    static get LATEST_VERSION()
    {
        return FTN18_VERSION;
    }


    /**
     * CCM registration helper
     *
     * @param {AsyncSteps} as - steps interface
     * @param {ChannelContext} channel - Bi-Direction channel instance
     * @param {object} [options={}] - interface options
     * @param {string} [options.version=1.0] - interface version to use
     * @returns {string} - iface:ver of registered interface
     */
    static register( as, channel, options={} )
    {
        const version = options.version || this.LATEST_VERSION;
        const ifacever = `futoin.evt.receiver:${version}`;

        _defaults( options, {
            nativeImpl: this,
            specDirs: SPEC_DIRS,
            sendOnBehalfOf: false,
        } );

        channel.register( as, ifacever, options );
        return ifacever;
    }
}

module.exports = ReceiverFace;
