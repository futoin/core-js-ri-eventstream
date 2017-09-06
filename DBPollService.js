'use strict';

const PollService = require( './PollService' );
const { DB_IFACEVER, DB_EVTTABLE, DB_EVTCONSUMERS } = require( './common' );

class DBPollService extends PollService
{
    constructor( _as, executor, options )
    {
        super( _as, executor, options );
        executor.ccm().assertIface( '#db.evt', DB_IFACEVER );
        this._evt_table = options.event_table || DB_EVTTABLE;
        this._consumer_table = options.consumer_table || DB_EVTCONSUMERS;
    }

    _registerConsumer( as, executor, ident )
    {
        as.add(
            ( as ) =>
            {
                const db = executor.ccm().db( 'evt' );
                const now = db.queryBuilder().helpers().now();

                db.insert( this._consumer_table )
                    .set( {
                        last_evt_id: 0,
                        reg_time: now,
                        last_time: now,
                        ident,
                    } )
                    .execute( as );
            },
            ( as, err ) =>
            {
                if ( err === 'Duplicate' )
                {
                    as.success();
                }
            }
        );
    }

    _pollEvents( as, executor, ident, last_id, want, is_reliable )
    {
        const db = executor.ccm().db( 'evt' );
        const xfer = db.newXfer();
        const helpers = xfer.helpers();

        // Update info
        if ( is_reliable )
        {
            // check, if registered
            xfer.select( this._consumer_table, { selected: 1 } )
                .get( 'id' )
                .where( { ident } )
                .forUpdate();

            xfer.update( this._consumer_table )
                .set( {
                    last_evt_id: last_id,
                    last_time: helpers.now(),
                } )
                .where( {
                    ident,
                    'last_evt_id <=': last_id,
                } );

            // make sure to select actual last_id
            last_id = db.select( this._consumer_table )
                .get( 'last_evt_id' )
                .where( { ident } );
        }

        // Actual select
        const s = xfer.select( this._evt_table, { result: true } )
            .get( [ 'id', 'type', 'data', 'ts' ] )
            .where( 'id >', last_id )
            .limit( this.MAX_EVENTS );

        if ( want )
        {
            s.where( 'type IN', want );
        }

        as.add(
            ( as ) =>
            {
                xfer.execute( as );

                as.add( ( as, res ) =>
                {
                    const events = this._res2events( res[0].rows, helpers );

                    // Make sure we do not run through events again
                    // and again.
                    if ( !events.length && want )
                    {
                        const xfer = db.newXfer();

                        const sq = xfer.select( this._evt_table )
                            .get( 'max_id', 'MAX(id)' );

                        xfer.select(
                            this._evt_table,
                            { result: true,
                                selected: false } )
                            .get( [ 'id', 'type', 'data', 'ts' ] )
                            .where( 'id >', last_id )
                            .where( 'type IN', want )
                            .limit( this.MAX_EVENTS );

                        const uq = xfer.update( this._consumer_table );
                        uq.set( 'last_evt_id', uq.backref( sq, 'max_id' ) );
                        uq.where( { ident } );

                        as.add(
                            ( as ) => xfer.execute( as ),
                            ( as, err ) =>
                            {
                                if ( err === 'XferCondition' )
                                {
                                    as.success();
                                }
                            }
                        );
                        as.add( ( as ) => as.success( events ) );
                    }
                    else
                    {
                        as.success( events );
                    }
                } );
            },
            ( as, err ) =>
            {
                if ( err === 'XferCondition' )
                {
                    // it may get triggered on failed update as well...
                    as.error( 'NotRegistered' );
                }
            }
        );
    }

    _res2events( rows, helpers )
    {
        return rows.map( ( v ) => ( {
            id: `${v[0]}`,
            type: v[1],
            data: JSON.parse( v[2] ),
            ts: helpers.nativeDate( v[3] ).format(),
        } ) );
    }
}

module.exports = DBPollService;
