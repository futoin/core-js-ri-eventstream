'use strict';

const _defaults = require( 'lodash/defaults' );
const path = require( 'path' );
const PingFace = require( 'futoin-invoker/PingFace' );
const { FTN18_VERSION, PING_VERSION } = require( './common' );


/**
 * Event Stream - Poll Face
 */
class PollFace extends PingFace
{
    /**
     * Latest supported FTN17 version
     */
    static get LATEST_VERSION()
    {
        return FTN18_VERSION;
    }

    /**
     * Latest supported FTN4 version
     */
    static get PING_VERSION()
    {
        return PING_VERSION;
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
            specDirs: [ this.spec(), PingFace.spec( this.PING_VERSION ) ],
            sendOnBehalfOf: false,
        } );

        ccm.register(
            as,
            name,
            `futoin.evt.poll:${ifacever}`,
            endpoint,
            credentials,
            options
        );
    }

    static spec()
    {
        return path.resolve( __dirname, 'specs' );
    }
}

module.exports = PollFace;
