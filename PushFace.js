'use strict';

const _defaults = require( 'lodash/defaults' );
const PingFace = require( 'futoin-invoker/PingFace' );
const PollFace = require( './PollFace' );


/**
 * Event Stream - Push Face
 */
class PushFace extends PollFace
{
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
            specDirs: [ this.spec(), PingFace.spec( this.PING_VERSION ) ],
            sendOnBehalfOf: false,
        } );

        ccm.register(
            as,
            name,
            `futoin.evt.push:${ifacever}`,
            endpoint,
            credentials,
            options
        );
    }
}

module.exports = PushFace;
