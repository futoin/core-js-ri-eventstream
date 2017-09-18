'use strict';

const GenFace = require( './GenFace' );
const SpecTools = require( 'futoin-invoker/SpecTools' );
const { DB_EVTTABLE } = require( './common' );

/**
 * GenFace for DB backend.
 * 
 * The only difference to original GenFace is native DB-specific API.
 */
class DBGenFace extends GenFace
{
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

module.exports = DBGenFace;
