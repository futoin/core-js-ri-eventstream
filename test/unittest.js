'use strict';

require( './prepare' );

const expect = require( 'chai' ).expect;
const moment = require( 'moment' );
const $asyncevent = require( 'futoin-asyncevent' );

const main = require( '../main' );
const Executor = require( 'futoin-executor/Executor' );
const { AdvancedCCM, SpecTools } = require( 'futoin-invoker' );
const $as = require( 'futoin-asyncsteps' );
const { cmpIds } = require( '../common' );

const ReceiverFace = require( '../ReceiverFace' );
const receiver_face = `futoin.evt.receiver:${ReceiverFace.LATEST_VERSION}`;


describe( 'PollService', function()
{
    const PollService = require( '../PollService' );
    const PollFace = require( '../PollFace' );

    it( 'should throw NotImplemented', function( done )
    {
        const ccm = new AdvancedCCM();
        const executor = new Executor( ccm );

        $as().add(
            ( as ) =>
            {
                PollService.register( as, executor );
                PollFace.register( as, ccm, 'pf', executor );

                as.add(
                    ( as ) =>
                    {
                        ccm.iface( 'pf' ).registerConsumer( as, 'SC' );
                    },
                    ( as, err ) =>
                    {
                        if ( err === 'NotImplemented' &&
                             as.state.error_info === 'Please override PollService#_registerConsumer' )
                        {
                            as.success();
                        }
                    }
                );

                as.add(
                    ( as ) =>
                    {
                        ccm.iface( 'pf' ).pollEvents( as, 'SC', null, null );
                    },
                    ( as, err ) =>
                    {
                        if ( err === 'NotImplemented' &&
                             as.state.error_info === 'Please override PollService#_pollEvents' )
                        {
                            as.success();
                        }
                    }
                );

                as.add( ( as ) => done() );
            },
            ( as, err ) =>
            {
                console.log( err );
                console.log( as.state.error_info );
                done( as.state.last_exception || 'Fail' );
            }
        ).execute();
    } );

    it( 'should allow only live events, if configured', function( done )
    {
        const ccm = new AdvancedCCM();
        const executor = new Executor( ccm );

        $as().add(
            ( as ) =>
            {
                PollService.register( as, executor, { allow_reliable: false } );
                PollFace.register( as, ccm, 'pf', executor );

                as.add(
                    ( as ) =>
                    {
                        ccm.iface( 'pf' ).registerConsumer( as, 'SC' );
                        as.add( ( as ) => as.error( 'Fail' ) );
                    },
                    ( as, err ) =>
                    {
                        if ( err === 'SecurityError' &&
                             as.state.error_info === 'Registration is not allowed' )
                        {
                            as.success();
                        }
                    }
                );

                as.add(
                    ( as ) =>
                    {
                        ccm.iface( 'pf' ).pollEvents( as, 'SC', null, null );
                        as.add( ( as ) => as.error( 'Fail' ) );
                    },
                    ( as, err ) =>
                    {
                        if ( err === 'SecurityError' &&
                             as.state.error_info === 'Reliable delivery is disabled' )
                        {
                            as.success();
                        }
                    }
                );

                as.add( ( as ) => done() );
            },
            ( as, err ) =>
            {
                console.log( err );
                console.log( as.state.error_info );
                done( as.state.last_exception || 'Fail' );
            }
        ).execute();
    } );

    it( 'should forbid polling, if configured', function( done )
    {
        const ccm = new AdvancedCCM();
        const executor = new Executor( ccm );

        $as().add(
            ( as ) =>
            {
                PollService.register( as, executor, { allow_polling: false } );
                PollFace.register( as, ccm, 'pf', executor );

                as.add(
                    ( as ) =>
                    {
                        ccm.iface( 'pf' ).pollEvents( as, 'PLT', null, null );
                        as.add( ( as ) => as.error( 'Fail' ) );
                    },
                    ( as, err ) =>
                    {
                        if ( err === 'SecurityError' &&
                             as.state.error_info === 'Only event push is allowed' )
                        {
                            as.success();
                        }
                    }
                );

                as.add(
                    ( as ) =>
                    {
                        ccm.iface( 'pf' ).pollEvents( as, 'LIVE', null, null );
                        as.add( ( as ) => as.error( 'Fail' ) );
                    },
                    ( as, err ) =>
                    {
                        if ( err === 'SecurityError' &&
                             as.state.error_info === 'Only event push is allowed' )
                        {
                            as.success();
                        }
                    }
                );

                as.add( ( as ) => done() );
            },
            ( as, err ) =>
            {
                console.log( err );
                console.log( as.state.error_info );
                done( as.state.last_exception || 'Fail' );
            }
        ).execute();
    } );
} );

describe( 'PushService', function()
{
    const PushService = require( '../PushService' );
    const PushFace = require( '../PushFace' );

    class MockPushService extends PushService
    {
        _pokeWorker()
        {
        }

        _recordLastId( as, ident, _last_id )
        {
            as.add( ( as ) =>
            {
                if ( ident !== '-internal:RLB' )
                {
                    as.error( 'InternalError' );
                }
            } );
        }

        _registerConsumer( as, _executor, _ident )
        {
        }

        _pollEvents( as, executor, ident, last_id, want, is_reliable )
        {
            as.add( ( as ) =>
            {
                if ( this._event_history && this._event_history.queue.length )
                {
                    as.success( PushService._mergeQueue( this._event_history ) );
                }
                else
                {
                    as.success( [] );
                }
            } );
        }
    }

    afterEach( function()
    {
        //require( 'event-emitter/all-off' )( SpecTools );
    } );

    it( 'should properly compare event IDs', function()
    {
        const test = ( a, b, req ) =>
        {
            const res = cmpIds( a, b );

            switch ( req )
            {
            case -1: expect( res ).to.be.below( 0 ); break;
            case 1: expect( res ).to.be.above( 0 ); break;
            case 0: expect( res ).to.equal( 0 ); break;
            default: undefined();
            }
        };

        test( '1', '1', 0 );
        test( '0', '1', -1 );
        test( '1', '2', -1 );
        test( '1', '0', 1 );
        test( '2', '1', 1 );
        test( '1', '11', -1 );
        test( '2', '11', -1 );
        test( '11', '11', 0 );
        test( '111', '11', 1 );
        test( '111', '110', 1 );
    } );

    it( 'should properly trim chunks by last ID', function()
    {
        const test = ( chunk, last_id, after ) =>
        {
            const before = chunk.slice();
            const res = PushService._trimChunk( chunk, last_id );
            expect( chunk ).to.eql( before );
            expect( res ).to.eql( after );
        };

        test(
            [ { id: '1' } ],
            '0',
            [ { id: '1' } ]
        );
        test(
            [ { id: '1' }, { id: '2' } ],
            '2',
            null
        );
        test(
            [ { id: '1' }, { id: '2' } ],
            '3',
            null
        );

        test(
            [ { id: '2' }, { id: '3' } ],
            '2',
            [ { id: '3' } ]
        );
        test(
            [ { id: '2' }, { id: '3' }, { id: '4' } ],
            '2',
            [ { id: '3' }, { id: '4' } ]
        );

        test(
            [ { id:'2' }, { id:'3' }, { id:'4' }, { id:'10' }, { id:'20' }, { id:'30' }, { id:'31' } ],
            '10',
            [ { id:'20' }, { id:'30' }, { id:'31' } ]
        );
        test(
            [ { id:'2' }, { id:'3' }, { id:'4' }, { id:'10' }, { id:'20' }, { id:'30' }, { id:'31' } ],
            '11',
            [ { id:'20' }, { id:'30' }, { id:'31' } ]
        );
        test(
            [ { id:'2' }, { id:'3' }, { id:'4' }, { id:'10' }, { id:'20' }, { id:'30' }, { id:'31' } ],
            '19',
            [ { id:'20' }, { id:'30' }, { id:'31' } ]
        );
        test(
            [ { id:'2' }, { id:'3' }, { id:'4' }, { id:'10' }, { id:'20' }, { id:'30' }, { id:'31' } ],
            '20',
            [ { id:'30' }, { id:'31' } ]
        );
        test(
            [ { id:'2' }, { id:'3' }, { id:'4' }, { id:'10' }, { id:'20' }, { id:'30' }, { id:'31' } ],
            '21',
            [ { id:'30' }, { id:'31' } ]
        );
        test(
            [ { id:'2' }, { id:'3' }, { id:'4' }, { id:'10' }, { id:'20' }, { id:'30' }, { id:'31' } ],
            '3',
            [ { id:'4' }, { id:'10' }, { id:'20' }, { id:'30' }, { id:'31' } ]
        );
        test(
            [ { id:'2' }, { id:'3' }, { id:'4' }, { id:'10' }, { id:'20' }, { id:'30' }, { id:'31' } ],
            '7',
            [ { id:'10' }, { id:'20' }, { id:'30' }, { id:'31' } ]
        );
    } );

    it( 'should combine chunks in queue', function()
    {
        const test = ( queue, chunk, after ) =>
        {
            const queue_count = queue.reduce( ( m, v ) => m + v.length, 0 );
            const state = { queue,
                queue_count,
                chunk_size: 1000 };
            const res = PushService._mergeQueue( state );
            expect( res ).to.eql( chunk );
            expect( queue ).to.eql( after );
            expect( state.queue_count ).to.eql(
                queue.reduce( ( m, v ) => m + v.length, 0 )
            );
        };

        const arr = [];

        for ( let i = 0; i < 1000; ++i )
        {
            arr.push( i );
        }

        test(
            [ [ 1, 2 ] ],
            [ 1, 2 ],
            []
        );

        test(
            [ [ 1, 2 ], [ 4, 8 ], [ 10, 20 ] ],
            [ 1, 2, 4, 8, 10, 20 ],
            []
        );

        test(
            [ arr, [ 1, 2 ] ],
            arr,
            [ [ 1, 2 ] ]
        );

        test(
            [ [ 1, 2 ], arr ],
            [ 1, 2 ],
            [ arr ]
        );
    } );

    it( 'should process live events', function( done )
    {
        this.timeout( 15e3 );

        const ccm = new AdvancedCCM();
        const executor = new Executor( ccm );
        const liveExecutor = new Executor( ccm, { specDirs: main.specDirs } );

        executor.on( 'notExpected', function()
        {
            console.log( 'executor' );
            console.dir( arguments );
        } );
        liveExecutor.on( 'notExpected', function()
        {
            console.log( 'liveExecutor' );
            console.dir( arguments );
        } );

        $as().add(
            ( as ) =>
            {
                const call_count = 100;
                SpecTools.once( 'error', ( err ) => console.log( err ) );

                const push_svc = MockPushService.register( as, executor, {
                    request_max : call_count,
                } );
                push_svc.on( 'pushError', function()
                {
                    console.log( arguments );
                } );
                PushFace.register( as, ccm, 'pfl', executor, null, { executor: liveExecutor } );

                let events_expected = 0;

                const live_rcv_svc = {
                    _count: 0,
                    _call_count: 0,
                    _as: null,
                    _inter_as: null,
                    onEvents: function( as, reqinfo )
                    {
                        this._count += reqinfo.params().events.length;
                        this._call_count += 1;

                        if ( this._count === events_expected && this._as )
                        {
                            this._as.success();
                            this._as = null;
                        }

                        if ( this._inter_as )
                        {
                            this._inter_as.success();
                            this._inter_as = null;
                        }

                        reqinfo.result( true );
                    },
                };

                liveExecutor.register( as, receiver_face, live_rcv_svc );

                as.setTimeout( 10e3 );
                as.setCancel( ( as ) =>
                {
                    console.log( live_rcv_svc );
                } );

                as.add( ( as ) =>
                {
                    const pfl = ccm.iface( 'pfl' );
                    pfl.readyToReceive( as, 'LIVE' );

                    as.repeat( call_count, ( as, i ) =>
                    {
                        const events = [];

                        for ( let j = 0; j < ( ( i + 1 ) * ( 1000 / call_count ) ); ++j )
                        {
                            events.push( {
                                id: `${i * 1000 + j + 1}`,
                                type: 'EVT',
                                data: 1,
                                ts: moment.utc().format(),
                            } );
                        }

                        events_expected += events.length;
                        push_svc._onEvents( events );
                    } );
                    as.add( ( as ) =>
                    {
                        if ( live_rcv_svc._count !== events_expected )
                        {
                            as.waitExternal();
                            live_rcv_svc._as = as;
                        }
                    } );
                } );
                as.add( ( as ) =>
                {
                    expect( live_rcv_svc._count )
                        .to.equal( events_expected );
                    expect( live_rcv_svc._call_count )
                        .to.be.below( call_count+1 );

                    ccm.once( 'close', () => as.success() );
                    as.waitExternal();

                    executor.close();
                    liveExecutor.close();
                    ccm.close();
                } );
                as.add( ( as ) => done() );
            },
            ( as, err ) =>
            {
                console.log( err );
                console.log( as.state.error_info );
                done( as.state.last_exception || 'Fail' );
            }
        ).execute();
    } );

    it( 'should process events', function( done )
    {
        this.timeout( 15e3 );

        const ccm = new AdvancedCCM();
        const executor = new Executor( ccm );
        const liveExecutor = new Executor( ccm, { specDirs: main.specDirs } );
        const reliableExecutor = new Executor( ccm, { specDirs: main.specDirs } );

        executor.on( 'notExpected', function()
        {
            console.log( 'executor' );
            console.dir( arguments );
        } );
        liveExecutor.on( 'notExpected', function()
        {
            console.log( 'liveExecutor' );
            console.dir( arguments );
        } );
        reliableExecutor.on( 'notExpected', function()
        {
            console.log( 'reliableExecutor' );
            console.dir( arguments );
        } );

        $as().add(
            ( as ) =>
            {
                const call_count = 10;
                SpecTools.once( 'error', ( err ) => console.log( err ) );

                const push_svc = MockPushService.register( as, executor );
                push_svc.on( 'pushError', function()
                {
                    console.log( arguments );
                } );
                push_svc.on( 'queueOverflow', function()
                {
                    console.log( arguments );
                } );

                PushFace.register( as, ccm, 'pfl', executor, null, { executor: liveExecutor } );
                PushFace.register( as, ccm, 'pfr', executor, null, { executor: reliableExecutor } );

                let events_expected = 0;

                const live_rcv_svc = {
                    _count: 0,
                    _call_count: 0,
                    _as: null,
                    _inter_as: null,
                    onEvents: function( as, reqinfo )
                    {
                        this._count += reqinfo.params().events.length;
                        this._call_count += 1;

                        if ( this._count === events_expected && this._as )
                        {
                            this._as.success();
                            this._as = null;
                        }

                        if ( this._inter_as )
                        {
                            this._inter_as.success();
                            this._inter_as = null;
                        }

                        reqinfo.result( true );
                    },
                };
                const reliable_rcv_svc = {};
                Object.assign( reliable_rcv_svc, live_rcv_svc );
                liveExecutor.register( as, receiver_face, live_rcv_svc );
                reliableExecutor.register( as, receiver_face, reliable_rcv_svc );

                as.setTimeout( 10e3 );
                as.setCancel( ( as ) =>
                {
                    console.log( push_svc );
                    console.log( live_rcv_svc );
                    console.log( reliable_rcv_svc );
                } );

                as.add( ( as ) =>
                {
                    const pfl = ccm.iface( 'pfl' );
                    pfl.readyToReceive( as, 'LIVE' );
                    const pfr = ccm.iface( 'pfr' );
                    pfr.readyToReceive( as, 'RLB' );

                    as.repeat( call_count, ( as, i ) =>
                    {
                        reliable_rcv_svc._inter_as = as;
                        as.waitExternal();

                        const events = [];

                        for ( let j = 0; j < ( ( i + 1 ) * ( 1000 / call_count ) ); ++j )
                        {
                            events.push( {
                                id: `${i * 1000 + j + 1}`,
                                type: 'EVT',
                                data: 1,
                                ts: moment.utc().format(),
                            } );
                        }

                        events_expected += events.length;
                        push_svc._onEvents( events );
                    } );
                    as.add( ( as ) =>
                    {
                        if ( reliable_rcv_svc._count !== events_expected )
                        {
                            as.waitExternal();
                            reliable_rcv_svc._as = as;
                        }
                    } );
                } );
                as.add( ( as ) =>
                {
                    expect( live_rcv_svc._count )
                        .to.equal( events_expected );
                    expect( reliable_rcv_svc._count )
                        .to.equal( events_expected );
                    expect( live_rcv_svc._call_count )
                        .to.be.below( call_count+1 );
                    expect( reliable_rcv_svc._call_count )
                        .to.be.below( call_count+1 );

                    ccm.once( 'close', () => as.success() );
                    as.waitExternal();

                    executor.close();
                    reliableExecutor.close();
                    liveExecutor.close();
                    ccm.close();
                } );
                as.add( ( as ) => done() );
            },
            ( as, err ) =>
            {
                console.log( err );
                console.log( as.state.error_info );
                done( as.state.last_exception || 'Fail' );
            }
        ).execute();
    } );

    it( 'should throw placeholder errors', function( done )
    {
        const ccm = new AdvancedCCM();
        const executor = new Executor( ccm );

        $as().add(
            ( as ) =>
            {
                const push_svc = PushService.register( as, executor );
                let push_error = null;
                let wait_as = null;
                push_svc.on( 'pushError', function()
                {
                    push_error = Array.from( arguments );
                    wait_as.success();
                    wait_as = null;
                } );

                expect( () => push_svc._pokeWorker() )
                    .to.throw( 'Not Implemented' );

                expect( () => push_svc._recordLastId() )
                    .to.throw( 'Not Implemented' );

                as.add(
                    ( as ) => as.error( 'MyError', 'My Info' ),
                    ( as, err ) =>
                    {
                        push_svc._onPushError( as, err );
                        as.add( ( as ) =>
                        {
                            as.waitExternal();
                            wait_as = as;
                        } );
                    }
                );

                as.add( ( as ) =>
                {
                    expect( push_error[0] ).to.equal( 'MyError' );
                    expect( push_error[1] ).to.equal( 'My Info' );
                    expect( push_error[2] ).to.be.instanceof( Error );

                    ccm.once( 'close', () => as.success() );
                    as.waitExternal();

                    executor.close();
                    ccm.close();
                } );
                as.add( ( as ) => done() );
            },
            ( as, err ) =>
            {
                console.log( err );
                console.log( as.state.error_info );
                done( as.state.last_exception || 'Fail' );
            }
        ).execute();
    } );

    it( 'should deliver with failures', function( done )
    {
        this.timeout( 15e3 );

        const ccm = new AdvancedCCM();
        const executor = new Executor( ccm );
        const liveExecutor = new Executor( ccm, { specDirs: main.specDirs } );
        const reliableExecutor = new Executor( ccm, { specDirs: main.specDirs } );

        executor.on( 'notExpected', function()
        {
            console.log( 'executor' );
            console.dir( arguments );
        } );
        liveExecutor.on( 'notExpected', function()
        {
            console.log( 'liveExecutor' );
            console.dir( arguments );
        } );
        reliableExecutor.on( 'notExpected', function()
        {
            console.log( 'reliableExecutor' );
            console.dir( arguments );
        } );

        $as().add(
            ( as ) =>
            {
                SpecTools.once( 'error', ( err ) => console.log( err ) );

                const push_svc = MockPushService.register( as, executor );
                //push_svc.on('pushError', function() { console.log(arguments); } );

                PushFace.register( as, ccm, 'pfl', executor, null, { executor: liveExecutor } );
                PushFace.register( as, ccm, 'pfr', executor, null, { executor: reliableExecutor } );

                let events_expected = 0;

                const live_rcv_svc = {
                    _count: 0,
                    _call_count: 0,
                    _as: null,
                    _inter_as: null,
                    _fail: false,
                    onEvents: function( as, reqinfo )
                    {
                        this._fail = !this._fail;
                        this._call_count += 1;

                        if ( this._fail )
                        {
                            as.error( 'InternalError' );
                        }

                        this._count += reqinfo.params().events.length;

                        if ( this._count === events_expected && this._as )
                        {
                            this._as.success();
                            this._as = null;
                        }

                        if ( this._inter_as )
                        {
                            this._inter_as.success();
                            this._inter_as = null;
                        }

                        reqinfo.result( true );
                    },
                };
                const reliable_rcv_svc = {};
                Object.assign( reliable_rcv_svc, live_rcv_svc );
                liveExecutor.register( as, receiver_face, live_rcv_svc );
                reliableExecutor.register( as, receiver_face, reliable_rcv_svc );

                as.setTimeout( 10e3 );
                as.setCancel( ( as ) =>
                {
                    console.log( live_rcv_svc );
                    console.log( reliable_rcv_svc );
                } );

                const call_count = 8;

                as.add( ( as ) =>
                {
                    const pfl = ccm.iface( 'pfl' );
                    pfl.readyToReceive( as, 'LIVE' );
                    const pfr = ccm.iface( 'pfr' );
                    pfr.readyToReceive( as, 'RLB' );

                    as.repeat( call_count, ( as, i ) =>
                    {
                        const events = [];

                        for ( let j = 0; j < ( ( ( i + 1 ) * ( 1000 / ( call_count - 3 ) ) ) % 1000 ); ++j )
                        {
                            events.push( {
                                id: `${i * 1000 + j + 1}`,
                                type: 'EVT',
                                data: 1,
                                ts: moment.utc().format(),
                            } );
                        }

                        if ( !events.length ) return;

                        events_expected += events.length;
                        push_svc._onEvents( events );
                    } );
                    as.add( ( as ) =>
                    {
                        if ( reliable_rcv_svc._count !== events_expected )
                        {
                            as.waitExternal();
                            reliable_rcv_svc._as = as;
                        }
                    } );
                } );
                as.add( ( as ) =>
                {
                    expect( live_rcv_svc._count )
                        .to.be.below( events_expected );
                    expect( reliable_rcv_svc._count )
                        .to.equal( events_expected );
                    expect( live_rcv_svc._call_count )
                        .to.be.below( call_count+1 );
                    expect( reliable_rcv_svc._call_count )
                        .to.be.below( call_count * 2 );

                    ccm.once( 'close', () => as.success() );
                    as.waitExternal();

                    executor.close();
                    reliableExecutor.close();
                    liveExecutor.close();
                    ccm.close();
                } );
                as.add( ( as ) => done() );
            },
            ( as, err ) =>
            {
                console.log( err );
                console.log( as.state.error_info );
                done( as.state.last_exception || 'Fail' );
            }
        ).execute();
    } );

    it( 'should deliver with history', function( done )
    {
        this.timeout( 15e3 );

        const ccm = new AdvancedCCM();
        const executor = new Executor( ccm );
        const liveExecutor = new Executor( ccm, { specDirs: main.specDirs } );
        const reliableExecutor = new Executor( ccm, { specDirs: main.specDirs } );

        executor.on( 'notExpected', function()
        {
            console.log( 'executor' );
            console.dir( arguments );
        } );
        liveExecutor.on( 'notExpected', function()
        {
            console.log( 'liveExecutor' );
            console.dir( arguments );
        } );
        reliableExecutor.on( 'notExpected', function()
        {
            console.log( 'reliableExecutor' );
            console.dir( arguments );
        } );

        $as().add(
            ( as ) =>
            {
                SpecTools.once( 'error', ( err ) => console.log( err ) );

                const push_svc = MockPushService.register( as, executor, {
                    queue_max: 100e3,
                } );
                push_svc.on( 'pushError', function()
                {
                    console.log( arguments );
                } );
                push_svc.on( 'queueOverflow', function()
                {
                    console.log( arguments );
                } );

                PushFace.register( as, ccm, 'pfl', executor, null, { executor: liveExecutor } );
                PushFace.register( as, ccm, 'pfr', executor, null, { executor: reliableExecutor } );

                push_svc._event_history = { queue: [],
                    queue_count: 0,
                    chunk_size: 1000 };
                let events_expected = 0;
                let expected_live_events = 0;
                const call_count = 20;

                as.repeat( 2, ( as, i ) =>
                {
                    const events = [];
                    const max = i ? 700 : 1000;

                    for ( let j = 0; j < max; ++j )
                    {
                        events.push( {
                            id: `${events_expected + j + 1}`,
                            type: 'EVT',
                            data: 1,
                            ts: moment.utc().format(),
                        } );
                    }

                    if ( !events.length ) return;

                    events_expected += events.length;
                    push_svc._event_history.queue.push( events );
                    push_svc._event_history.queue_count += events.length;
                } );

                const live_rcv_svc = {
                    _count: 0,
                    _call_count: 0,
                    _as: null,
                    _ident: 'LIVE',
                    onEvents: function( as, reqinfo )
                    {
                        const { seq, events } = reqinfo.params();
                        this._call_count += 1;

                        this._count += reqinfo.params().events.length;

                        if ( this._count >= events_expected && this._as )
                        {
                            this._as.success();
                            this._as = null;
                        }

                        reqinfo.result( true );
                    },
                };
                const reliable_rcv_svc = {};
                Object.assign( reliable_rcv_svc, live_rcv_svc, { _ident: 'RLB' } );
                liveExecutor.register( as, receiver_face, live_rcv_svc );
                reliableExecutor.register( as, receiver_face, reliable_rcv_svc );

                as.setTimeout( 10e3 );
                as.setCancel( ( as ) =>
                {
                    console.log( live_rcv_svc );
                    console.log( reliable_rcv_svc );
                } );

                as.add( ( as ) =>
                {
                    events_expected /= 2;
                    const shift = events_expected;
                    const pfl = ccm.iface( 'pfl' );
                    pfl.readyToReceive( as, 'LIVE' );
                    const pfr = ccm.iface( 'pfr' );
                    pfr.readyToReceive( as, 'RLB' );

                    as.repeat( call_count, ( as, i ) =>
                    {
                        const events = [];

                        for ( let j = 0; j < ( ( ( i + 1 ) * ( 1000 / call_count * 2 ) ) % 1000 ); ++j )
                        {
                            events.push( {
                                id: `${events_expected + j + 1}`,
                                type: 'EVT',
                                data: 2,
                                ts: moment.utc().format(),
                            } );
                        }

                        if ( !events.length ) return;

                        events_expected += events.length;
                        expected_live_events += events.length;
                        push_svc._onEvents( events );
                    } );
                    as.add( ( as ) =>
                    {
                        if ( reliable_rcv_svc._count < events_expected )
                        {
                            as.waitExternal();
                            reliable_rcv_svc._as = as;
                        }
                    } );
                } );
                as.add( ( as ) =>
                {
                    expect( live_rcv_svc._count )
                        .to.equal( expected_live_events );
                    expect( reliable_rcv_svc._count )
                        .to.equal( events_expected );
                    expect( live_rcv_svc._call_count )
                        .to.be.below( call_count+1 );
                    expect( reliable_rcv_svc._call_count )
                        .to.be.below( call_count * 2 );

                    ccm.once( 'close', () => as.success() );
                    as.waitExternal();

                    executor.close();
                    reliableExecutor.close();
                    liveExecutor.close();
                    ccm.close();
                } );
                as.add( ( as ) => done() );
            },
            ( as, err ) =>
            {
                console.log( err );
                console.log( as.state.error_info );
                done( as.state.last_exception || 'Fail' );
            }
        ).execute();
    } );

    it( 'should deliver from history', function( done )
    {
        this.timeout( 15e3 );

        $as().repeat( 2, ( as, global_iter ) =>
        {
            const ccm = new AdvancedCCM();
            const executor = new Executor( ccm );
            const liveExecutor = new Executor( ccm, { specDirs: main.specDirs } );
            const reliableExecutor = new Executor( ccm, { specDirs: main.specDirs } );

            executor.on( 'notExpected', function()
            {
                console.log( 'executor' );
                console.dir( arguments );
            } );
            liveExecutor.on( 'notExpected', function()
            {
                console.log( 'liveExecutor' );
                console.dir( arguments );
            } );
            reliableExecutor.on( 'notExpected', function()
            {
                console.log( 'reliableExecutor' );
                console.dir( arguments );
            } );

            as.add(
                ( as ) =>
                {
                    SpecTools.once( 'error', ( err ) => console.log( err ) );

                    const push_svc = MockPushService.register( as, executor );
                    push_svc.on( 'pushError', function()
                    {
                        console.log( arguments );
                    } );
                    push_svc.on( 'queueOverflow', function()
                    {
                        console.log( arguments );
                    } );

                    PushFace.register( as, ccm, 'pfr', executor, null, { executor: reliableExecutor } );

                    push_svc._event_history = { queue: [],
                        queue_count: 0,
                        chunk_size: 1000 };
                    let events_expected = 0;
                    let event_gap = 0;
                    const call_count = 3;

                    as.repeat( 2, ( as, i ) =>
                    {
                        const events = [];
                        const max = ( global_iter && i ) ? 700 : 1000;

                        for ( let j = 0; j < max; ++j )
                        {
                            events.push( {
                                id: `${events_expected + j + 1}`,
                                type: 'EVT',
                                data: 1,
                                ts: moment.utc().format(),
                            } );
                        }

                        if ( !events.length ) return;

                        events_expected += events.length;
                        push_svc._event_history.queue.push( events );
                        push_svc._event_history.queue_count += events.length;
                    } );

                    const reliable_rcv_svc = {
                        _count: 0,
                        _call_count: 0,
                        _as: null,
                        onEvents: function( as, reqinfo )
                        {
                            this._call_count += 1;

                            this._count += reqinfo.params().events.length;

                            if ( ( this._count >= events_expected ) && this._as )
                            {
                                this._as.success();
                                this._as = null;
                            }

                            reqinfo.result( true );
                        },
                    };

                    reliableExecutor.register( as, receiver_face, reliable_rcv_svc );

                    as.setTimeout( 10e3 );
                    as.setCancel( ( as ) =>
                    {
                        console.log( events_expected );
                        console.log( reliable_rcv_svc );
                    } );

                    as.add( ( as ) =>
                    {
                        const shift = events_expected;
                        const pfr = ccm.iface( 'pfr' );
                        pfr.readyToReceive( as, 'RLB' );

                        as.add( ( as ) =>
                        {
                            if ( reliable_rcv_svc._count < events_expected )
                            {
                                as.waitExternal();
                                reliable_rcv_svc._as = as;
                            }
                        } );

                        as.add( ( as ) =>
                        {
                            event_gap = events_expected;
                            events_expected /= 2;
                            event_gap -= events_expected;

                            as.waitExternal();
                            setTimeout( () => as.success(), 100 );
                        } );

                        as.repeat( call_count, ( as, i ) =>
                        {
                            const events = [];

                            for ( let j = 0; j < ( ( ( i + 1 ) * ( 1000 / call_count * 2 ) ) % 1000 ); ++j )
                            {
                                events.push( {
                                    id: `${events_expected + j + 1}`,
                                    type: 'EVT',
                                    data: 2,
                                    ts: moment.utc().format(),
                                } );
                            }

                            if ( !events.length ) return;

                            events_expected += events.length;
                            push_svc._onEvents( events );
                        } );
                        as.add( ( as ) =>
                        {
                            if ( reliable_rcv_svc._count < events_expected )
                            {
                                as.waitExternal();
                                reliable_rcv_svc._as = as;
                            }
                        } );
                    } );
                    as.add( ( as ) =>
                    {
                        expect( reliable_rcv_svc._count )
                            .to.equal( events_expected );
                        expect( reliable_rcv_svc._call_count )
                            .to.be.below( call_count + 2 );

                        ccm.once( 'close', () => as.success() );
                        as.waitExternal();

                        executor.close();
                        reliableExecutor.close();
                        liveExecutor.close();
                        ccm.close();
                    } );
                    as.add( ( as ) => global_iter && done() );
                },
                ( as, err ) =>
                {
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
        } ).execute();
    } );

    it( 'should handle queue overflow', function( done )
    {
        this.timeout( 15e3 );

        const ccm = new AdvancedCCM();
        const executor = new Executor( ccm );
        const liveExecutor = new Executor( ccm, { specDirs: main.specDirs } );
        const reliableExecutor = new Executor( ccm, { specDirs: main.specDirs } );

        executor.on( 'notExpected', function()
        {
            console.log( 'executor' );
            console.dir( arguments );
        } );
        liveExecutor.on( 'notExpected', function()
        {
            console.log( 'liveExecutor' );
            console.dir( arguments );
        } );
        reliableExecutor.on( 'notExpected', function()
        {
            console.log( 'reliableExecutor' );
            console.dir( arguments );
        } );

        $as().add(
            ( as ) =>
            {
                SpecTools.once( 'error', ( err ) => console.log( err ) );

                const push_svc = MockPushService.register( as, executor, {
                    queue_max: 1500,
                } );
                push_svc.on( 'pushError', function()
                {
                    console.log( arguments );
                } );

                let overflows = { LIVE : 0,
                    '-internal:RLB': 0 };
                push_svc.on( 'queueOverflow', function( ident, count )
                {
                    overflows[ident] += count;
                } );

                PushFace.register( as, ccm, 'pfl', executor, null, { executor: liveExecutor } );
                PushFace.register( as, ccm, 'pfr', executor, null, { executor: reliableExecutor } );

                push_svc._event_history = { queue: [],
                    queue_count: 0,
                    chunk_size: 1000 };
                let events_expected = 0;
                let last_id = '20001';
                const call_count = 20;

                const live_rcv_svc = {
                    _count: 0,
                    _call_count: 0,
                    _last_id: '0',
                    _as: null,
                    _inter_as: null,
                    onEvents: function( as, reqinfo )
                    {
                        this._call_count += 1;
                        const events = reqinfo.params().events;

                        this._count += events.length;
                        this._last_id = events[events.length-1].id;

                        if ( this._last_id === last_id && this._as )
                        {
                            this._as.success();
                            this._as = null;
                        }

                        if ( this._inter_as )
                        {
                            this._inter_as.success();
                            this._inter_as = null;
                        }

                        reqinfo.result( true );
                    },
                };
                const reliable_rcv_svc = {};
                Object.assign( reliable_rcv_svc, live_rcv_svc );
                liveExecutor.register( as, receiver_face, live_rcv_svc );
                reliableExecutor.register( as, receiver_face, reliable_rcv_svc );

                as.setTimeout( 10e3 );
                as.setCancel( ( as ) =>
                {
                    console.log( live_rcv_svc );
                    console.log( reliable_rcv_svc );
                } );

                as.add( ( as ) =>
                {
                    const pfl = ccm.iface( 'pfl' );
                    pfl.readyToReceive( as, 'LIVE' );
                    const pfr = ccm.iface( 'pfr' );
                    pfr.readyToReceive( as, 'RLB' );

                    as.repeat( call_count, ( as, i ) =>
                    {
                        const events = [];

                        for ( let j = 0; j < ( 1000 / ( i % 3 + 1 ) ); ++j )
                        {
                            last_id = `${events_expected + j + 1}`;
                            events.push( {
                                id: last_id,
                                type: 'EVT',
                                data: 2,
                                ts: moment.utc().format(),
                            } );
                        }

                        if ( !events.length ) return;

                        events_expected += events.length;
                        push_svc._onEvents( events );
                    } );
                    as.add( ( as ) =>
                    {
                        if ( reliable_rcv_svc._last_id !== last_id )
                        {
                            as.waitExternal();
                            reliable_rcv_svc._as = as;
                        }
                    } );
                } );
                as.add( ( as ) =>
                {
                    expect( live_rcv_svc._count )
                        .to.be.equal( events_expected - overflows.LIVE );
                    expect( reliable_rcv_svc._count )
                        .to.equal( events_expected - overflows['-internal:RLB'] );
                    expect( live_rcv_svc._call_count )
                        .to.be.below( call_count+1 );
                    expect( reliable_rcv_svc._call_count )
                        .to.be.below( call_count * 2 );

                    ccm.once( 'close', () => as.success() );
                    as.waitExternal();

                    executor.close();
                    reliableExecutor.close();
                    liveExecutor.close();
                    ccm.close();
                } );
                as.add( ( as ) => done() );
            },
            ( as, err ) =>
            {
                console.log( err );
                console.log( as.state.error_info );
                done( as.state.last_exception || 'Fail' );
            }
        ).execute();
    } );

    it( 'should handle event filters', function( done )
    {
        this.timeout( 15e3 );

        const ccm = new AdvancedCCM();
        const executor = new Executor( ccm );
        const execAB = new Executor( ccm, { specDirs: main.specDirs } );
        const execBC = new Executor( ccm, { specDirs: main.specDirs } );

        executor.on( 'notExpected', function()
        {
            console.log( 'executor' );
            console.dir( arguments );
        } );
        execAB.on( 'notExpected', function()
        {
            console.log( 'execAB' );
            console.dir( arguments );
        } );
        execBC.on( 'notExpected', function()
        {
            console.log( 'execBC' );
            console.dir( arguments );
        } );

        $as().add(
            ( as ) =>
            {
                SpecTools.once( 'error', ( err ) => console.log( err ) );

                const push_svc = MockPushService.register( as, executor );
                push_svc.on( 'pushError', function()
                {
                    console.log( arguments );
                } );

                const ab_svc = {
                    _count: 0,
                    _as: null,

                    onEvents: function( as, reqinfo )
                    {
                        const events = reqinfo.params().events;
                        this._count += events.length;

                        events.forEach( ( v ) =>
                        {
                            if ( v.type !== 'AEVT' && v.type !== 'BEVT' )
                            {
                                console.log( v );
                                as.error( 'Fail' );
                            }
                        } );

                        reqinfo.result( true );

                        if ( this._count >= 10 && this._as )
                        {
                            this._as.success();
                            this._as = null;
                        }
                    },
                };
                execAB.register( as, receiver_face, ab_svc );
                const bc_svc = {
                    _count: 0,
                    _as: null,

                    onEvents: function( as, reqinfo )
                    {
                        const events = reqinfo.params().events;
                        this._count += events.length;

                        events.forEach( ( v ) =>
                        {
                            if ( v.type !== 'CEVT' && v.type !== 'BEVT' )
                            {
                                console.log( v );
                                as.error( 'Fail' );
                            }
                        } );

                        reqinfo.result( true );

                        if ( this._count >= 7 && this._as )
                        {
                            this._as.success();
                            this._as = null;
                        }
                    },
                };
                execBC.register( as, receiver_face, bc_svc );

                PushFace.register( as, ccm, 'ab', executor, null, { executor: execAB } );
                PushFace.register( as, ccm, 'bc', executor, null, { executor: execBC } );
                PushFace.register( as, ccm, 'ee', executor, null, { executor: execBC } );

                as.add( ( as ) =>
                {
                    ccm.iface( 'ab' ).readyToReceive( as, 'LIVE', [ 'AEVT', 'BEVT' ] );
                    ccm.iface( 'bc' ).readyToReceive( as, 'RLB', [ 'BEVT', 'CEVT' ] );
                    ccm.iface( 'ee' ).readyToReceive( as, 'RLB', [ 'EEVT' ] );
                } );

                as.add( ( as ) =>
                {
                    const data = null;
                    const ts = moment.utc().format();

                    push_svc._onEvents( [
                        { id:'1',
                            type:'AEVT',
                            data,
                            ts },
                        { id:'2',
                            type:'BEVT',
                            data,
                            ts },
                        { id:'3',
                            type:'CEVT',
                            data,
                            ts },
                        { id:'4',
                            type:'DEVT',
                            data,
                            ts },
                        { id:'5',
                            type:'AEVT',
                            data,
                            ts },
                        { id:'6',
                            type:'BEVT',
                            data,
                            ts },
                        { id:'7',
                            type:'BEVT',
                            data,
                            ts },
                        { id:'8',
                            type:'CEVT',
                            data,
                            ts },
                        { id:'9',
                            type:'CEVT',
                            data,
                            ts },
                        { id:'10',
                            type:'CEVT',
                            data,
                            ts },
                    ] );
                } );


                as.add( ( as ) =>
                {
                    if ( bc_svc._count < 7 )
                    {
                        bc_svc._as = as;
                        as.waitExternal();
                    }
                } );

                as.add( ( as ) =>
                {
                    execBC.close();
                } );

                as.add( ( as ) =>
                {
                    const data = null;
                    const ts = moment.utc().format();

                    push_svc._onEvents( [
                        { id:'11',
                            type:'AEVT',
                            data,
                            ts },
                        { id:'12',
                            type:'BEVT',
                            data,
                            ts },
                        { id:'13',
                            type:'CEVT',
                            data,
                            ts },
                        { id:'14',
                            type:'DEVT',
                            data,
                            ts },
                        { id:'15',
                            type:'AEVT',
                            data,
                            ts },
                        { id:'16',
                            type:'BEVT',
                            data,
                            ts },
                        { id:'17',
                            type:'BEVT',
                            data,
                            ts },
                        { id:'18',
                            type:'CEVT',
                            data,
                            ts },
                        { id:'19',
                            type:'CEVT',
                            data,
                            ts },
                        { id:'20',
                            type:'CEVT',
                            data,
                            ts },
                    ] );
                } );

                as.add( ( as ) =>
                {
                    if ( ab_svc._count < 10 )
                    {
                        ab_svc._as = as;
                        as.waitExternal();
                    }
                } );

                as.add( ( as ) =>
                {
                    expect( ab_svc._count ).to.equal( 10 );
                    expect( bc_svc._count ).to.equal( 7 );

                    ccm.once( 'close', () => as.success() );
                    as.waitExternal();

                    executor.close();
                    execAB.close();
                    ccm.close();
                } );
                as.add( ( as ) => done() );
            },
            ( as, err ) =>
            {
                console.log( err );
                console.log( as.state.error_info );
                done( as.state.last_exception || 'Fail' );
            }
        ).execute();
    } );

    it( 'should handle allow only fine tune', function( done )
    {
        this.timeout( 15e3 );

        const ccm = new AdvancedCCM();
        const executor = new Executor( ccm );
        const clientExecutor = new Executor( ccm );

        executor.on( 'notExpected', function()
        {
            console.log( 'executor' );
            console.dir( arguments );
        } );


        $as().add(
            ( as ) =>
            {
                SpecTools.once( 'error', ( err ) => console.log( err ) );

                const push_svc = MockPushService.register( as, executor, {
                    allow_reliable: false,
                } );
                push_svc.on( 'pushError', function()
                {
                    console.log( arguments );
                } );


                PushFace.register( as, ccm, 't', executor, null, { executor: clientExecutor } );

                as.add(
                    ( as ) =>
                    {
                        ccm.iface( 't' ).readyToReceive( as, 'RLB' );
                        as.add( ( as ) => as.error( 'Fail' ) );
                    },
                    ( as, err ) =>
                    {
                        expect( err ).to.equal( 'SecurityError' );
                        expect( as.state.error_info ).to.equal( 'Only LIVE delivery is allowed' );
                        as.success();
                    }
                );
                as.add( ( as ) => ccm.iface( 't' ).readyToReceive( as, 'LIVE' ) );

                as.add( ( as ) =>
                {
                    ccm.once( 'close', () => as.success() );
                    as.waitExternal();

                    executor.close();
                    clientExecutor.close();
                    ccm.close();
                } );
                as.add( ( as ) => done() );
            },
            ( as, err ) =>
            {
                console.log( err );
                console.log( as.state.error_info );
                done( as.state.last_exception || 'Fail' );
            }
        ).execute();
    } );
} );

describe( 'ReliableReceiver', function()
{
    const ReliableReceiver = require( '../ReliableReceiver' );

    it( 'should handle disconnects', function( done )
    {
        const ccm = new AdvancedCCM();
        const archiver = new class extends ReliableReceiver
        {
            constructor()
            {
                super( ccm );
            }

            _registerReceiver( as, _executor )
            {
                const res = {};
                return res;
            }
        };

        archiver.once( 'workerError', ( err ) =>
        {
            try
            {
                expect( err ).to.equal( 'Disconnect' );
            }
            catch ( e )
            {
                done( e );
                return;
            }

            setTimeout( () =>
            {
                archiver.stop();
                done();
            }, 0 );
        } );
        archiver.start( 'wss://127.0.0.1:12345/api', 'login:pass' );
    } );
} );

describe( 'ReliableReceiverService', function()
{
    const ReliableReceiverService = require( '../ReliableReceiverService' );

    it( 'should handle out-of-order requests', function( done )
    {
        const as = $as();
        const ccm = new AdvancedCCM();
        const executor = new Executor( ccm );

        class TestService extends ReliableReceiverService
        {
            _onEvents( as, _reqinfo, events )
            {
                this._received = this._received || [];
                this._received.push( events[0] );
            }
        }

        as.add(
            ( as ) =>
            {
                const svc = TestService.register( as, executor );
                ccm.register( as, 'rcvr', receiver_face,
                    executor, null, { specDirs: main.specDirs } );

                as.add( ( as ) =>
                {
                    ccm.iface( 'rcvr' ).onEvents(
                        as,
                        0,
                        [ { id: '100',
                            type: 'T',
                            data: null,
                            ts:'2000-01-01T12:00:00Z' } ]
                    );
                } );

                //---
                const p = as.parallel();
                p.add( ( as ) =>
                {
                    ccm.iface( 'rcvr' ).onEvents(
                        as,
                        3,
                        [ { id: '400',
                            type: 'T',
                            data: null,
                            ts:'2000-01-01T12:00:00Z' } ]
                    );
                } );
                p.add( ( as ) =>
                {
                    ccm.iface( 'rcvr' ).onEvents(
                        as,
                        1,
                        [ { id: '200',
                            type: 'T',
                            data: null,
                            ts:'2000-01-01T12:00:00Z' } ]
                    );
                } );
                p.add( ( as ) =>
                {
                    ccm.iface( 'rcvr' ).onEvents(
                        as,
                        2,
                        [ { id: '300',
                            type: 'T',
                            data: null,
                            ts:'2000-01-01T12:00:00Z' } ]
                    );
                } );

                //---
                as.add( ( as ) =>
                {
                    ccm.iface( 'rcvr' ).onEvents(
                        as,
                        4,
                        [ { id: '500',
                            type: 'T',
                            data: null,
                            ts:'2000-01-01T12:00:00Z' } ]
                    );
                } );
                //----
                as.add( ( as ) =>
                {
                    expect( svc._received ).to.eql( [
                        { id: '100',
                            type: 'T',
                            data: null,
                            ts:'2000-01-01T12:00:00Z' },
                        { id: '200',
                            type: 'T',
                            data: null,
                            ts:'2000-01-01T12:00:00Z' },
                        { id: '300',
                            type: 'T',
                            data: null,
                            ts:'2000-01-01T12:00:00Z' },
                        { id: '400',
                            type: 'T',
                            data: null,
                            ts:'2000-01-01T12:00:00Z' },
                        { id: '500',
                            type: 'T',
                            data: null,
                            ts:'2000-01-01T12:00:00Z' },
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
        as.add( ( as ) =>
        {
            ccm.close();
            done();
        } );
        as.execute();
    } );

    it( 'should throw error', function( done )
    {
        const as = $as();
        const ccm = new AdvancedCCM();
        const executor = new Executor( ccm );

        as.add(
            ( as ) =>
            {
                const svc = ReliableReceiverService.register( as, executor );
                ccm.register( as, 'rcvr', receiver_face,
                    executor, null, { specDirs: main.specDirs } );

                as.add(
                    ( as ) =>
                    {
                        ccm.iface( 'rcvr' ).onEvents(
                            as,
                            0,
                            [ { id: '100',
                                type: 'T',
                                data: null,
                                ts:'2000-01-01T12:00:00Z' } ]
                        );
                        as.add( ( as ) => as.error( 'Fail' ) );
                    },
                    ( as, err ) =>
                    {
                        if ( err === 'NotImplemented' )
                        {
                            as.success();
                        }
                    }
                );
            },
            ( as, err ) =>
            {
                console.log( err );
                console.log( as.state.error_info );
                done( as.state.last_exception || 'Fail' );
            }
        );
        as.add( ( as ) =>
        {
            ccm.close();
            done();
        } );
        as.execute();
    } );
} );
