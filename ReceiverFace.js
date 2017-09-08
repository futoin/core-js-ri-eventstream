'use strict';

const _defaults = require( 'lodash/defaults' );
const path = require( 'path' );
const NativeIface = require( 'futoin-invoker/NativeIface' );
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
            specDirs: [ path.resolve( __dirname, 'specs' ) ],
            sendOnBehalfOf: false,
        } );

        channel.register( as, ifacever, options );
        return ifacever;
    }
}

module.exports = ReceiverFace;
