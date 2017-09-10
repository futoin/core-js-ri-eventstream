'use strict';

const _defaults = require( 'lodash/defaults' );
const path = require( 'path' );
const PingFace = require( 'futoin-invoker/PingFace' );
const SpecTools = require( 'futoin-invoker/SpecTools' );
const { FTN18_VERSION, PING_VERSION, DB_EVTTABLE } = require( './common' );


/**
 * Event Stream - Generator Face
 */
class GenFace extends PingFace
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
            `futoin.evt.gen:${ifacever}`,
            endpoint,
            credentials,
            options
        );
    }

    static spec()
    {
        return path.resolve( __dirname, 'specs' );
    }

    /**
     * Helper to add event generation into DB transaction
     * @param {XferBuilder} xb - instance of transaction builder
     * @param {string} type - event type
     * @param {*} data - any data
     * @param {string} [table=evt_queue] - event queue
     */
    addXferEvent( xb, type, data, table=DB_EVTTABLE )
    {
        const check = SpecTools.checkType( this._raw_info, 'EventType', type );

        if ( !check )
        {
            throw new Error( `Invalid event type: ${type}` );
        }

        xb.insert( table, { affected: 1 } )
            .set( 'type', type )
            .set( 'data', JSON.stringify( data ) )
            .set( 'ts', xb.helpers().now() );
    }
}

module.exports = GenFace;
