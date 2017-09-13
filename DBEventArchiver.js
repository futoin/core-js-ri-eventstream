'use strict';

const EventArchiver = require( './EventArchiver' );
const ReliableReceiverService = require( './ReliableReceiverService' );
const { DB_IFACEVER, DB_EVTHISTORY, cmpIds } = require( './common' );

const MAX_XFER_EVENTS = 100;

class ReliableDBReceiverService extends ReliableReceiverService
{
    constructor( executor, options )
    {
        super( executor, options );
        this._last_id = null;
        this._history_table = options.history_table || DB_EVTHISTORY;
    }

    _onEvents( as, reqinfo, events )
    {
        const ccm = reqinfo.executor().ccm();
        const db = ccm.db( 'evtdwh' );
        const history_table = this._history_table;

        // startup & error recovery
        if ( !this._last_id )
        {
            as.add( ( as ) =>
            {
                db.select( history_table )
                    .get( 'last_id', 'MAX(id)' )
                    .execute( as );
                as.add( ( as, res ) =>
                {
                    this._last_id = `${res.rows[0][0] || 0}`;
                } );
            } );
        }

        as.add( ( as ) =>
        {
            const iter = events[Symbol.iterator]();
            let last_id = this._last_id;
            let c = iter.next();

            // Skip already archived
            //---
            while ( !c.done &&
                    ( cmpIds( c.value.id, last_id ) <= 0 ) )
            {
                c = iter.next();
            }

            if ( c.done )
            {
                return;
            }

            // Push to DB
            //---
            as.setCancel( ( as ) =>
            {
                // make sure to re-read Last ID on any error
                this._last_id = null;
            } );

            while ( !c.done )
            {
                const xfer = db.newXfer();
                const helpers = xfer.helpers();
                let next_last_id = last_id;
                let j;

                for ( j = 0; j < MAX_XFER_EVENTS && !c.done; ++j )
                {
                    const v = c.value;

                    xfer.insert( history_table, { affected: 1 } ).set( {
                        id : v.id,
                        type: v.type,
                        data: JSON.stringify( v.data ),
                        ts: helpers.date( v.ts ),
                    } );

                    next_last_id = v.id;
                    c = iter.next();
                }

                xfer.execute( as );

                as.add( ( as ) =>
                {
                    this._last_id = next_last_id;
                    this.emit( 'newEvents', j );
                } );
            }
        } );
    }
}

/**
 * Database Event Archiver service.
 * 
 * @note No more than one instance should run at once.
 */
class DBEventArchiver extends EventArchiver
{
    /**
     * C-tor
     * 
     * @param {AdvancedCCM} db_ccm - CCM instance with registered '#db.evtdwh' interface
     */
    constructor( db_ccm )
    {
        super( db_ccm );
        db_ccm.assertIface( '#db.evtdwh', DB_IFACEVER );
    }

    _registerReceiver( as, executor )
    {
        return ReliableDBReceiverService.register( as, executor );
    }
}

module.exports = DBEventArchiver;
