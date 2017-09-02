'use strict';

const _defaults = require( 'lodash/defaults' );
const path = require( 'path' );
const NativeIface = require( 'futoin-invoker/NativeIface' );
const { FTN18_VERSION } = require( './common' );


/**
 * Event Stream - Poll Face
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
     * @param {AdvancedCCM} ccm - CCM instance
     * @param {string} name - CCM registration name
     * @param {*} endpoint - see AdvancedCCM#register
     * @param {*} [credentials=null] - see AdvancedCCM#register
     * @param {object} [options={}] - interface options
     * @param {string} [options.version=1.0] - interface version to use
     */
    static register( as, ccm, name, endpoint, credentials=null, options={} )
    {
        const ifacever = options.version || this.LATEST_VERSION;

        _defaults( options, {
            nativeImpl: this,
            specDirs: [ path.resolve( __dirname, 'specs' ) ],
            sendOnBehalfOf: false,
        } );

        ccm.register(
            as,
            name,
            `futoin.evt.receiver:${ifacever}`,
            endpoint,
            credentials,
            options
        );
    }
}

module.exports = ReceiverFace;
