'use strict';

const expect = require( 'chai' ).expect;
const $as_test = require( 'futoin-asyncsteps/testcase' );

const Executor = require( 'futoin-executor/Executor' );
const GenFace = require( '../GenFace' );
const DBGenFace = require( '../DBGenFace' );
const DBGenService = require( '../DBGenService' );
const PollFace = require( '../PollFace' );
const PushFace = require( '../PushFace' );
const DBPollService = require( '../DBPollService' );
const DBPushService = require( '../DBPushService' );
const DBEventArchiver = require( '../DBEventArchiver' );
const DBServiceApp = require( '../DBServiceApp' );
const ReceiverFace = require( '../ReceiverFace' );
const ReliableReceiver = require( '../ReliableReceiver' );
const LiveReceiver = require( '../LiveReceiver' );
const main = require( '../main' );

const receiver_face = `futoin.evt.receiver:${ReceiverFace.LATEST_VERSION}`;

module.exports = function( describe, it, vars )
{
    describe( 'DBGenService', function()
    {
        let as;
        let ccm;
        let executor;

        beforeEach( 'common', function()
        {
            ccm = vars.ccm;
            as = vars.as;
            executor = new Executor( ccm );

            executor.on( 'notExpected', function()
            {
                console.dir( arguments );
            } );

            as.add(
                ( as ) =>
                {
                    DBGenService.register( as, executor );
                    DBGenFace.register( as, ccm, 'evtgen', executor );
                },
                ( as, err ) =>
                {
                    console.log( err );
                    console.log( as.state.error_info );
                    console.log( as.state.last_exception || 'Fail' );
                }
            );
        } );

        it( 'should generate events', function( done )
        {
            this.timeout( 5e3 );

            as.add(
                ( as ) =>
                {
                    const iface = ccm.iface( 'evtgen' );

                    expect( iface.DB_EVENT_TABLE ).to.equal( 'evt_queue' );

                    iface.addEvent( as, 'AB_C', null );
                    iface.addEvent( as, 'AB_C', false );
                    iface.addEvent( as, 'AB_C', 'dt' );
                    iface.addEvent( as, 'X', 1 );
                    iface.addEvent( as, 'ABCDEFHIJ_KLMN_O', {} );
                    iface.addEvent( as, 'ABCDEFHIJ_KLMN_O', { some: 'data' } );
                    as.add( ( as, res ) =>
                    {
                        expect( res ).to.equal( '6' );
                    } );

                    ccm.db( 'evt' )
                        .select( 'evt_queue' )
                        .get( [ 'id', 'type', 'data' ] )
                        .order( 'id' )
                        .executeAssoc( as );
                    as.add( ( as, res ) =>
                    {
                        res = res.map( ( v ) => ( {
                            id: parseInt( v.id ),
                            type: v.type,
                            data: JSON.parse( v.data ),
                        } ) );
                        expect( res ).to.eql( [
                            { id: 1,
                                type: 'AB_C',
                                data: null },
                            { id: 2,
                                type: 'AB_C',
                                data: false },
                            { id: 3,
                                type: 'AB_C',
                                data: "dt" },
                            { id: 4,
                                type: 'X',
                                data: 1 },
                            { id: 5,
                                type: 'ABCDEFHIJ_KLMN_O',
                                data: {} },
                            { id: 6,
                                type: 'ABCDEFHIJ_KLMN_O',
                                data: { some: "data" } },
                        ] );
                        executor.close();
                    } );
                },
                ( as, err ) =>
                {
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );

        it( 'should generate event in xfer', function( done )
        {
            as.add(
                ( as ) =>
                {
                    const iface = ccm.iface( 'evtgen' );
                    const db = ccm.db( 'evt' );

                    const xb = db.newXfer();
                    iface.addXferEvent( xb, 'XFER_EVT', 123 );
                    iface.addXferEvent( xb, 'XFER_EVT', 321 );

                    expect( function()
                    {
                        iface.addXferEvent( xb, 'Invld', 321 );
                    } ).to.throw( 'Invalid event type: Invld' );
                    xb.execute( as );

                    ccm.db( 'evt' )
                        .select( 'evt_queue' )
                        .get( [ 'id', 'type', 'data' ] )
                        .where( 'type', 'XFER_EVT' )
                        .order( 'id' )
                        .executeAssoc( as );
                    as.add( ( as, res ) =>
                    {
                        res = res.map( ( v ) => ( {
                            id: parseInt( v.id ),
                            type: v.type,
                            data: JSON.parse( v.data ),
                        } ) );
                        expect( res ).to.eql( [
                            { id: 7,
                                type: 'XFER_EVT',
                                data: 123 },
                            { id: 8,
                                type: 'XFER_EVT',
                                data: 321 },
                        ] );
                    } );
                },
                ( as, err ) =>
                {
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );
    } );

    describe( 'DBPollFace', function()
    {
        let as;
        let ccm;
        let executor;

        beforeEach( 'common', function()
        {
            ccm = vars.ccm;
            as = vars.as;
            executor = new Executor( ccm );

            executor.on( 'notExpected', function()
            {
                console.dir( arguments );
            } );

            as.add(
                ( as ) =>
                {
                    DBGenService.register( as, executor );
                    DBPollService.register( as, executor );
                    GenFace.register( as, ccm, 'evtgen', executor );
                    PollFace.register( as, ccm, 'evtpoll', executor );
                },
                ( as, err ) =>
                {
                    console.log( err );
                    console.log( as.state.error_info );
                    console.log( as.state.last_exception || 'Fail' );
                }
            );
        } );

        it( 'should poll events', function( done )
        {
            as.add(
                ( as ) =>
                {
                    const poll = ccm.iface( 'evtpoll' );

                    poll.registerConsumer( as, 'T1' );
                    poll.registerConsumer( as, 'T1' );

                    poll.pollEvents( as, 'T1', null, null );

                    as.add( ( as, res ) =>
                    {
                        res = res.map( ( v ) => ( {
                            id: parseInt( v.id ),
                            type: v.type,
                            data: v.data,
                        } ) );
                        expect( res ).to.eql( [
                            { id: 1,
                                type: 'AB_C',
                                data: null },
                            { id: 2,
                                type: 'AB_C',
                                data: false },
                            { id: 3,
                                type: 'AB_C',
                                data: "dt" },
                            { id: 4,
                                type: 'X',
                                data: 1 },
                            { id: 5,
                                type: 'ABCDEFHIJ_KLMN_O',
                                data: {} },
                            { id: 6,
                                type: 'ABCDEFHIJ_KLMN_O',
                                data: { some: "data" } },
                            { id: 7,
                                type: 'XFER_EVT',
                                data: 123 },
                            { id: 8,
                                type: 'XFER_EVT',
                                data: 321 },
                        ] );
                    } );

                    poll.pollEvents( as, 'T1', '1', [ 'AB_C' ] );

                    as.add( ( as, res ) =>
                    {
                        res = res.map( ( v ) => ( {
                            id: parseInt( v.id ),
                            type: v.type,
                            data: v.data,
                        } ) );
                        expect( res ).to.eql( [
                            { id: 2,
                                type: 'AB_C',
                                data: false },
                            { id: 3,
                                type: 'AB_C',
                                data: "dt" },
                        ] );
                    } );

                    poll.pollEvents( as, 'T1', '3', [ 'AB_C' ] );

                    as.add( ( as, res ) =>
                    {
                        expect( res.length ).to.equal( 0 );
                    } );

                    // ensure WAX
                    poll.pollEvents( as, 'T1', '3', [ 'AB_C' ] );

                    as.add( ( as, res ) =>
                    {
                        expect( res.length ).to.equal( 0 );
                    } );

                    //---
                    ccm.iface( 'evtgen' ).addEvent( as, 'AB_C', 'dt' );
                    poll.pollEvents( as, 'T1', '3', [ 'AB_C' ] );
                    as.add( ( as, res ) => expect( res.length ).to.equal( 1 ) );
                    poll.pollEvents( as, 'T1', '3', [ 'AB_C' ] );
                    as.add( ( as, res ) => expect( res.length ).to.equal( 1 ) );
                    poll.pollEvents( as, 'T1', '9', [ 'AB_C' ] );
                    as.add( ( as, res ) => expect( res.length ).to.equal( 0 ) );
                    //---
                    as.add( ( as ) => executor.close() );
                },
                ( as, err ) =>
                {
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );

        it( 'must detect not registrated', function( done )
        {
            as.add(
                ( as ) =>
                {
                    const poll = ccm.iface( 'evtpoll' );

                    poll.pollEvents( as, 'T2', null, null );
                    as.add( ( as ) => as.error( 'Fail' ) );
                },
                ( as, err ) =>
                {
                    if ( err === 'NotRegistered' )
                    {
                        done();
                    }
                    else
                    {
                        console.log( err );
                        console.log( as.state.error_info );
                        done( as.state.last_exception || 'Fail' );
                    }
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );

        it( 'must not allow LIVE registration', function( done )
        {
            as.add(
                ( as ) =>
                {
                    const poll = ccm.iface( 'evtpoll' );

                    poll.registerConsumer( as, 'LIVE' );
                    as.add( ( as ) => as.error( 'Fail' ) );
                },
                ( as, err ) =>
                {
                    if ( err === 'LiveNotAllowed' )
                    {
                        done();
                    }
                    else
                    {
                        console.log( err );
                        console.log( as.state.error_info );
                        done( as.state.last_exception || 'Fail' );
                    }
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );

        it( 'should silently cancel skip on new event', function( done )
        {
            as.add(
                ( as ) =>
                {
                    const poll = ccm.iface( 'evtpoll' );
                    const db = ccm.db( 'evt' );
                    let first = true;

                    const proto = db.constructor.prototype;
                    const orig_newXfer = proto.newXfer;

                    proto.newXfer = function()
                    {
                        const xfer = orig_newXfer.apply( this, arguments );

                        if ( first )
                        {
                            first = false;
                            return xfer;
                        }

                        proto.newXfer = orig_newXfer;
                        xfer.execute = function( as )
                        {
                            ccm.iface( 'evtgen' ).addEvent( as, 'EVT_MIDDLE', 'dt' );
                            as.add( ( as ) => this.constructor.prototype.execute.apply( this, [ as ] ) );
                        };
                        return xfer;
                    };

                    poll.pollEvents( as, 'T1', null, [ 'EVT_MIDDLE' ] );
                    as.add( ( as, res ) => expect( res.length ).to.equal( 0 ) );

                    poll.pollEvents( as, 'T1', null, [ 'EVT_MIDDLE' ] );
                    as.add( ( as, res ) => expect( res.length ).to.equal( 1 ) );
                },
                ( as, err ) =>
                {
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );

        it( 'should allow LIVE polling', function( done )
        {
            as.add(
                ( as ) =>
                {
                    const poll = ccm.iface( 'evtpoll' );
                    const db = ccm.db( 'evt' );

                    ccm.iface( 'evtgen' ).addEvent( as, 'EVT_LV', 'lv' );
                    as.add( ( as, res ) =>
                    {
                        as.state.live_id = res;
                    } );

                    poll.pollEvents( as, 'LIVE', null, [ 'EVT_LV' ] );
                    as.add( ( as, res ) =>
                    {
                        expect( res.length ).to.equal( 1 );

                        poll.pollEvents( as, 'LIVE', as.state.live_id, [ 'EVT_LV' ] );
                        as.add( ( as, res ) => expect( res.length ).to.equal( 0 ) );

                        poll.pollEvents( as, 'LIVE', `${as.state.live_id - 1}`, [ 'EVT_LV' ] );
                        as.add( ( as, res ) => expect( res.length ).to.equal( 1 ) );
                    } );
                },
                ( as, err ) =>
                {
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );
    } );

    describe( 'DBPushService', function()
    {
        let as;
        let ccm;
        let executor;
        let clientExecutor;

        beforeEach( 'common', function()
        {
            ccm = vars.ccm;
            as = vars.as;
            executor = new Executor( ccm, { specDirs: main.specDirs } );
            clientExecutor = new Executor( ccm, { specDirs: main.specDirs } );

            executor.on( 'notExpected', function()
            {
                console.dir( arguments );
            } );

            as.add(
                ( as ) =>
                {
                    DBGenService.register( as, executor );
                    const push_svc = DBPushService.register( as, executor, {
                        sleep_min: 10,
                        sleep_max: 30,
                        sleep_step: 21,
                    } );
                    DBGenFace.register( as, ccm, 'evtgen', executor );
                    PushFace.register( as, ccm, 'evtpush', executor, null, { executor: clientExecutor } );

                    as.state.push_svc = push_svc;
                    push_svc.on( 'pushError', function()
                    {
                        console.log( arguments );
                    } );
                },
                ( as, err ) =>
                {
                    console.log( err );
                    console.log( as.state.error_info );
                    console.log( as.state.last_exception || 'Fail' );
                }
            );
        } );

        afterEach( 'common', function()
        {
            executor.close();
        } );

        it( 'should push events', function( done )
        {
            this.timeout( 5e3 );

            as.add(
                ( as ) =>
                {
                    let expected_events = 0;

                    const recv_svc = {
                        _count: 0,
                        _as: null,
                        _last_id: '0',

                        onEvents( as, reqinfo )
                        {
                            const events = reqinfo.params().events;
                            this._count += events.length;
                            this._last_id = events[events.length - 1].id;
                            reqinfo.result( true );

                            if ( this._count >= expected_events && this._as )
                            {
                                this._as.success();
                                this._as = null;
                            }
                        },
                    };

                    clientExecutor.register( as, receiver_face, recv_svc );

                    const gen = ccm.iface( 'evtgen' );
                    const push = ccm.iface( 'evtpush' );
                    const db = ccm.db( 'evt' );

                    as.add( ( as ) => push.readyToReceive( as, 'LIVE' ) );
                    as.add( ( as ) => push.readyToReceive( as, 'LIVE', [ 'INVALID' ] ) );

                    as.repeat( 10, ( as, i ) =>
                    {
                        gen.addEvent( as, 'EVT_PUSH', { i } );
                        expected_events += 1;
                    } );
                    as.add( ( as ) =>
                    {
                        if ( recv_svc._count < expected_events )
                        {
                            recv_svc._as = as;
                            as.waitExternal();
                        }
                    } );
                    as.add( ( as ) => clientExecutor.close() );
                    as.add( ( as ) => push.registerConsumer( as, 'RLB' ) );
                    as.add( ( as ) => push.pollEvents( as, 'RLB', null, [ 'EVT_PUSH' ] ) );
                    as.add( ( as, events ) => expect( events.length ).to.equal( expected_events ) );
                    as.loop( ( as ) =>
                    {
                        const push_svc = as.state.push_svc;

                        if ( push_svc._worker_as )
                        {
                            as.waitExternal();
                            setTimeout( () => as.success(), push_svc._sleep_curr );
                        }
                        else
                        {
                            as.break();
                        }
                    } );
                    as.add( ( as ) =>
                    {
                        // Not reliable due to race condition, but
                        // we try to go through all codepaths here
                        // to increase test coverage
                        const push_svc = as.state.push_svc;

                        expect( push_svc._worker_as ).to.be.null;

                        // tricky, we need to wait for internal worker
                        // to inject all events
                        push_svc._sleep_curr = 3e3;
                        push_svc._sleep_min = push_svc._sleep_curr;
                        push_svc._sleep_max = push_svc._sleep_curr;

                        push.readyToReceive( as, 'RLB' );

                        // Give some time to enter sleep loop
                        as.add( ( as ) =>
                        {
                            as.waitExternal();
                            setTimeout( () => as.success(), 100 );
                        } );
                    } );

                    as.repeat( 11, ( as ) =>
                    {
                        const xfer = db.newXfer();

                        for ( let i = 0; i < 100; ++i )
                        {
                            gen.addXferEvent( xfer, 'EVT_PUSH', { i } );
                            expected_events += 1;
                        }

                        xfer.execute( as );
                    } );

                    as.add( ( as ) =>
                    {
                        if ( recv_svc._count < expected_events )
                        {
                            recv_svc._as = as;
                            as.waitExternal();
                        }
                    } );


                    // Give some time for receiver to complete
                    as.add( ( as ) =>
                    {
                        as.waitExternal();
                        setTimeout( () => as.success(), 100 );
                    } );

                    as.add( ( as ) =>
                    {
                        clientExecutor.close();
                        executor.close();
                    } );
                },
                ( as, err ) =>
                {
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );
    } );

    describe( 'DBEventArchiver', function()
    {
        let as;
        let ccm;
        let executor;

        beforeEach( 'common', function()
        {
            ccm = vars.ccm;
            as = vars.as;
            executor = new Executor( ccm, { specDirs: main.specDirs } );

            executor.on( 'notExpected', function()
            {
                console.dir( arguments );
            } );

            //executor.on( 'request', (_, req) => console.log(req) );
            //executor.on( 'response', (_, rsp) => console.log(rsp) );

            as.add(
                ( as ) =>
                {
                    DBGenService.register( as, executor );
                    const push_svc = DBPushService.register( as, executor, {
                        sleep_min: 10,
                        sleep_max: 30,
                        sleep_step: 5,
                    } );
                    GenFace.register( as, ccm, 'evtgen', executor );

                    as.state.push_svc = push_svc;
                    //push_svc.on('pushError', function(){ console.log(arguments); });
                },
                ( as, err ) =>
                {
                    console.log( err );
                    console.log( as.state.error_info );
                    console.log( as.state.last_exception || 'Fail' );
                }
            );
        } );

        afterEach( 'common', function()
        {
            executor.close();
        } );

        it( 'should archive events', function( done )
        {
            this.timeout( 10e3 );

            as.add(
                ( as ) =>
                {
                    const archiver = new DBEventArchiver( ccm );

                    archiver.on( 'workerError', function()
                    {
                        console.log( arguments );
                    } );
                    archiver.on( 'receiverError', function()
                    {
                        if ( arguments[0] !== 'Duplicate' )
                        {
                            console.log( arguments );
                        }
                    } );

                    let push_count = 0;
                    let event_count = 0;
                    let push_cb = null;
                    archiver.on( 'processedEvents', ( count ) =>
                    {
                        push_count++;
                        event_count += count;

                        if ( push_cb )
                        {
                            push_cb();
                        }
                    } );

                    archiver.start( executor );
                    expect( () => archiver.start( executor ) ).to.throw( 'Already started!' );

                    const dbact = ccm.db( 'evt' );
                    const dbdwh = ccm.db( 'evtdwh' );

                    dbact.select( 'evt_queue' )
                        .get( 'c', 'COUNT(*)' ).execute( as );

                    as.add( ( as, res_orig ) =>
                    {
                        as.state.res_orig = parseInt( res_orig.rows[0][0] );
                        as.state.event_count_expect = as.state.res_orig;
                        as.state.push_count_expect =
                            ~~( ( parseInt( `${res_orig.rows[0][0]}` ) + 100 ) / 100 );

                        if ( push_count < as.state.push_count_expect )
                        {
                            as.waitExternal();
                            push_cb = () =>
                            {
                                // console.log( push_count, as.state.push_count_expect );

                                if ( push_count === as.state.push_count_expect )
                                {
                                    push_cb = null;
                                    as.success();
                                }
                            };
                        }
                    } );

                    dbdwh.select( 'evt_history' )
                        .get( 'c', 'COUNT(*)' ).execute( as );

                    as.add( ( as, res ) =>
                    {
                        expect( parseInt( res.rows[0][0] ) ).to.equal( as.state.res_orig );
                        expect( push_count ).to.equal( as.state.push_count_expect );
                        expect( event_count ).to.equal( as.state.event_count_expect );
                        archiver.stop();
                        archiver.start( executor );

                        ccm.iface( 'evtgen' ).addEvent( as, 'NEW_EVT', 123 );
                        as.state.push_count_expect++;
                        as.state.event_count_expect++;

                        as.loop( ( as ) =>
                        {
                            dbdwh.select( 'evt_history' )
                                .get( 'c', 'COUNT(*)' ).execute( as );

                            as.add( ( as, res ) =>
                            {
                                // console.log( res.rows[0][0], as.state.event_count_expect );

                                if ( parseInt( res.rows[0][0] ) === as.state.event_count_expect )
                                {
                                    expect( event_count ).to.equal( as.state.event_count_expect );
                                    expect( push_count ).to.equal( as.state.push_count_expect );
                                    as.break();
                                }
                            } );
                        } );
                    } );

                    as.add( ( as ) =>
                    {
                        // duplicate event case
                        dbdwh.insert( 'evt_history' )
                            .set( {
                                id : as.state.event_count_expect + 1,
                                type: 'NEW_EVT',
                                data: JSON.stringify( 234 ),
                                ts: dbdwh.helpers().now(),
                            } )
                            .execute( as );

                        ccm.iface( 'evtgen' ).addEvent( as, 'NEW_EVT', 234 );
                        as.state.event_count_expect++;
                        ccm.iface( 'evtgen' ).addEvent( as, 'NEW_EVT', 345 );
                        as.state.event_count_expect++;
                        as.state.push_count_expect++;
                    } );

                    as.add( ( as ) =>
                    {
                        if ( push_count < as.state.push_count_expect )
                        {
                            as.waitExternal();
                            push_cb = () =>
                            {
                                // console.log( push_count, as.state.push_count_expect );

                                if ( push_count >= as.state.push_count_expect )
                                {
                                    push_cb = null;
                                    as.success();
                                }
                            };
                        }
                    } );

                    dbdwh.select( 'evt_history' )
                        .get( 'c', 'COUNT(*)' ).execute( as );

                    as.add( ( as, res ) =>
                    {
                        expect( parseInt( res.rows[0][0] ) ).to.equal( as.state.event_count_expect );
                        // One event is duplicate
                        expect( event_count ).to.equal( as.state.event_count_expect - 1 );
                    } );


                    as.loop( ( as ) =>
                    {
                        dbact.select( 'evt_consumers' )
                            .get( 'last_evt_id' )
                            .where( 'ident', '-internal:ARCHIVER' )
                            .execute( as );

                        as.add( ( as, res ) =>
                        {
                            // console.log( res.rows[0][0], as.state.event_count_expect );

                            if ( parseInt( res.rows[0][0] ) === as.state.event_count_expect )
                            {
                                as.break();
                            }
                        } );
                    } );

                    as.add( ( as ) =>
                    {
                        as.waitExternal();
                        ccm.once( 'close', () => as.success() );
                        ccm.close();
                    } );
                },
                ( as, err ) =>
                {
                    console.log( err, as.state.error_info );
                    console.log( as.state.last_exception );
                    done( as.state.last_exception );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );
    } );

    describe( 'DBEventDiscarder', function()
    {
        const DBEventDiscarder = require( '../DBEventDiscarder' );

        it( 'should discard delivered events', function( done )
        {
            this.timeout( 60e3 );
            const as = vars.as;
            const ccm = vars.ccm;


            as.add(
                ( as ) =>
                {
                    const db = ccm.db( 'evt' );
                    db.delete( 'evt_consumers' )
                        .where( 'ident !=', '-internal:ARCHIVER' )
                        .execute( as );

                    let event_count = 0;
                    let event_discarded = 0;
                    let wait_as = null;

                    const discared = new DBEventDiscarder();
                    discared.on( 'eventDiscard', ( cnt ) =>
                    {
                        event_discarded += cnt;

                        if ( event_discarded >= event_count )
                        {
                            setTimeout( () =>
                            {
                                wait_as.success();
                                wait_as = null;
                            }, 100 );
                        }
                    } );
                    discared.on( 'workerError', function()
                    {
                        console.log( arguments );
                    } );

                    db.select( 'evt_queue' ).get( 'c', 'COUNT(*)' ).execute( as );

                    as.add( ( as, res ) =>
                    {
                        event_count = parseInt( res.rows[0][0] );

                        wait_as = as;
                        as.waitExternal();
                        discared.start( ccm, { limit_at_once: 100,
                            poll_period_ms: 30 } );

                        expect( () => discared.start() ).to.throw( 'Already started!' );
                    } );

                    db.select( 'evt_queue' ).get( 'c', 'COUNT(*)' ).execute( as );

                    as.add( ( as, res ) =>
                    {
                        expect( parseInt( res.rows[0][0] ) ).to.equal( 0 );
                        discared.stop();
                    } );
                },
                ( as, err ) =>
                {
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );
    } );

    describe( 'DBServiceApp', function()
    {
        it ( 'should initialize', $as_test( ( as ) =>
        {
            const app = new DBServiceApp( as, {
                databaseConfig: vars.dbcfg,
                enableDiscarder: true,
                enableArchiver: true,
            } );
            as.add( ( as ) =>
            {
                app.ccm().iface( '#evtgen' );
                app.ccm().iface( '#evtpoll' );
                app.ccm().iface( '#evtpush' );
            } );
            as.add( ( as ) => app.close() );
        } ) );
    } );

    describe( 'ReliableReceiver', function()
    {
        let as;
        let ccm;
        let executor;

        beforeEach( 'common', function()
        {
            ccm = vars.ccm;
            as = vars.as;
            executor = new Executor( ccm, { specDirs: main.specDirs } );

            executor.on( 'notExpected', function()
            {
                console.dir( arguments );
            } );

            as.add(
                ( as ) =>
                {
                    DBGenService.register( as, executor );
                    const push_svc = DBPushService.register( as, executor, {
                        sleep_min: 10,
                        sleep_max: 30,
                        sleep_step: 5,
                    } );
                    GenFace.register( as, ccm, 'evtgen', executor );

                    as.state.push_svc = push_svc;
                    //push_svc.on('pushError', function(){ console.log(arguments); });
                },
                ( as, err ) =>
                {
                    console.log( err );
                    console.log( as.state.error_info );
                    console.log( as.state.last_exception );
                }
            );
        } );

        afterEach( 'common', function()
        {
            executor.close();
        } );

        it( 'should receive live events', function( done )
        {
            this.timeout( 10e3 );

            as.add(
                ( as ) =>
                {
                    const LiveClass = class extends LiveReceiver
                    {
                        constructor()
                        {
                            super( ccm );
                            this.on_count = 0;
                            this.on( 'newEvents', ( events ) => this.on_count += events.length );
                        }
                    };
                    const live_receiver1 = new LiveClass;
                    const live_receiver2 = new LiveClass;

                    const receiver = new class extends ReliableReceiver
                    {
                        constructor()
                        {
                            super( ccm );
                            this.count = 0;
                            this.on_count = 0;
                            this.on( 'newEvents', ( events ) => this.on_count += events.length );
                        }

                        _onEvents( as, events )
                        {
                            super._onEvents( as, events );
                            this.count += events.length;
                        }
                    };

                    receiver.on( 'workerError', function()
                    {
                        console.log( arguments );
                    } );
                    receiver.on( 'receiverError', function()
                    {
                        if ( arguments[0] !== 'Duplicate' )
                        {
                            console.log( arguments );
                        }
                    } );

                    // give chance receiver to setup
                    let ready_as = true;
                    receiver.once( 'ready', () =>
                    {
                        ready_as && ready_as.success();
                        ready_as = false;
                    } );
                    live_receiver1.start( executor );
                    live_receiver2.start( executor, null, { want: [ 'RER_EVT' ] } );
                    receiver.start( executor, null, { want: [ 'RER_EVT' ] } );

                    expect( () => receiver.start( executor ) ).to.throw( 'Already started!' );

                    as.add( ( as ) =>
                    {
                        if ( ready_as )
                        {
                            ready_as = as;
                            as.waitExternal();
                        }
                    } );

                    const ITERATIONS = 1234;
                    const evgen = ccm.iface( 'evtgen' );

                    as.repeat( ITERATIONS, ( as, i ) =>
                    {
                        evgen.addEvent( as, 'RER_EVT', i );
                        evgen.addEvent( as, 'RER_EVT_O', i );
                    } );

                    as.loop( ( as ) =>
                    {
                        if ( ( receiver.count === ITERATIONS ) &&
                             ( receiver.on_count === ITERATIONS ) &&
                             ( live_receiver1.on_count === ( ITERATIONS * 2 ) ) &&
                             ( live_receiver2.on_count === ITERATIONS )
                        )
                        {
                            as.break();
                        }

                        as.waitExternal();
                        setTimeout( () => as.success(), 100 );
                    } );
                },
                ( as, err ) =>
                {
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );
    } );
};
