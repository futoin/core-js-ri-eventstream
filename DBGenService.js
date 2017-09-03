'use strict';

const GenService = require( './GenService' );
const { DB_IFACEVER } = require( './common' );

class DBGenService extends GenService
{
    constructor( _as, executor, options )
    {
        super();
        executor.ccm().assertIface( '#db.evt', DB_IFACEVER );

        this._add_event_query = null;
        this._evt_table = options.event_table || 'EvtQueue';
    }

    addEvent( as, reqinfo )
    {
        let pq = this._add_event_query;

        if ( !pq )
        {
            const db = reqinfo.executor().ccm().db( 'evt' );
            db.once( 'close', () =>
            {
                this._add_event_query = null;
            } );

            const qb = db.insert( this._evt_table );
            qb.set( 'type', qb.param( 'type' ) )
                .set( 'data', qb.param( 'data' ) )
                .set( 'ts', qb.helpers().now() )
                .getInsertID( 'id' );
            pq = this._add_event_query = qb.prepare();
        }

        const params = reqinfo.params();

        pq.execute( as, {
            type: params.type,
            data: JSON.stringify( params.data ),
        } );

        as.add( ( as, res ) =>
        {
            reqinfo.result( `${res.rows[0][0]}` );
        } );
    }
}

module.exports = DBGenService;
