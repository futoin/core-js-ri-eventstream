'use strict';

const PollService = require( './PollService' );
const { DB_IFACEVER, DB_EVTTABLE, DB_EVTCONSUMERS } = require( './common' );

class DBPollService extends PollService
{
    constructor( _as, executor, options )
    {
        super();
        executor.ccm().assertIface( '#db.evt', DB_IFACEVER );
        this._evt_table = options.event_table || DB_EVTTABLE;
        this._consumer_table = options.consumer_table || DB_EVTCONSUMERS;
    }

    registerConsumer( as, reqinfo )
    {
        const component = reqinfo.params().component;

        if ( component === 'LIVE' )
        {
            as.error( 'LiveNotAllowed',
                'Live consumer should not register' );
        }

        as.add(
            ( as ) =>
            {
                const db = reqinfo.executor().ccm().db( 'evt' );
                const now = db.queryBuilder().helpers().now();
                const user_id = parseInt( reqinfo.info.USER_INFO.localID() );
                const ident = `${user_id}:${component}`;

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
        as.add( ( as ) => reqinfo.result( true ) );
    }

    pollEvents( as, reqinfo )
    {
        const params = reqinfo.params();
        const component = params.component;
        const user_id = parseInt( reqinfo.info.USER_INFO.localID() );
        const ident = `${user_id}:${component}`;
        let last_id = params.last_id || 0;
        const want = params.want;

        const db = reqinfo.executor().ccm().db( 'evt' );
        const xfer = db.newXfer();
        const helpers = xfer.helpers();
        const is_reliable = ( component !== 'LIVE' );

        // Update info
        if ( is_reliable )
        {
            xfer.update( this._consumer_table, { affected: 1 } )
                .set( {
                    last_evt_id: last_id,
                    last_time: helpers.now(),
                } )
                .where( {
                    ident,
                    'last_evt_id <=': last_id,
                } );

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
                    reqinfo.result( events );

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
                        as.add( ( as ) =>
                        {} );
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
