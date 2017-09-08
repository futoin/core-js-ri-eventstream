'use strict';

const expect = require('chai').expect;
const moment = require('moment');

const main = require( '../main' );
const Executor = require('futoin-executor/Executor');
const AdvancedCCM = require( 'futoin-invoker/AdvancedCCM' );
const $as = require( 'futoin-asyncsteps' );
const SpecTools = require('futoin-invoker/SpecTools');

describe('PollService', function() {
    const PollService = require( '../PollService' );
    const PollFace = require( '../PollFace' );
    
    it('should throw NotImplemented', function(done) {
        const ccm = new AdvancedCCM();
        const executor = new Executor( ccm );
        
        $as().add(
            (as) =>
            {
                PollService.register( as, executor );
                PollFace.register(as, ccm, 'pf', executor );
                
                as.add(
                    (as) =>
                    {
                        ccm.iface('pf').registerConsumer( as, 'SC' );
                    },
                    (as, err) =>
                    {
                        if ( err === 'NotImplemented' &&
                             as.state.error_info === 'Please override PollService#_registerConsumer' )
                        {
                            as.success();
                        }
                    }
                );
                
                as.add(
                    (as) =>
                    {
                        ccm.iface('pf').pollEvents( as, 'SC', null, null );
                    },
                    (as, err) =>
                    {
                        if ( err === 'NotImplemented' &&
                             as.state.error_info === 'Please override PollService#_pollEvents' )
                        {
                            as.success();
                        }
                    }
                );
                
                as.add( (as) => done() );
            },
            (as, err) =>
            {
                console.log(err);
                console.log(as.state.error_info);
                done(as.state.last_exception);
            }
        ).execute();
    });
    
    it('should allow only live events, if configured', function(done) {
        const ccm = new AdvancedCCM();
        const executor = new Executor( ccm );
        
        $as().add(
            (as) =>
            {
                PollService.register( as, executor, { allow_reliable: false } );
                PollFace.register(as, ccm, 'pf', executor );
                
                as.add(
                    (as) =>
                    {
                        ccm.iface('pf').registerConsumer( as, 'SC' );
                    },
                    (as, err) =>
                    {
                        if ( err === 'SecurityError' &&
                             as.state.error_info === 'Registration is not allowed' )
                        {
                            as.success();
                        }
                    }
                );
                
                as.add(
                    (as) =>
                    {
                        ccm.iface('pf').pollEvents( as, 'SC', null, null );
                    },
                    (as, err) =>
                    {
                        if ( err === 'SecurityError' &&
                             as.state.error_info === 'Reliable delivery is disabled' )
                        {
                            as.success();
                        }
                    }
                );
                
                as.add( (as) => done() );
            },
            (as, err) =>
            {
                console.log(err);
                console.log(as.state.error_info);
                done(as.state.last_exception);
            }
        ).execute();
    });
});

describe( 'PushService', function() {
    const PushService = require( '../PushService' );
    const PushFace = require( '../PushFace' );
    
    class MockPushService extends PushService
    {
        _pokeWorker()
        {
        }

        _recordLastId( as, ident, _last_id )
        {
            as.add( (as) => {
                if ( ident !== '-internal:RLB') {
                    as.error('InternalError');
                }
            });
        }
        
        _registerConsumer( as, _executor, _ident )
        {
        }

        _pollEvents( as, executor, ident, last_id, want, is_reliable )
        {
            as.add( (as) => {
                as.success( this._next_events );
            });
        }
    };
    
    it('should properly trim chunks by last ID', function() {
        const test = ( chunk, last_id, after ) => {
            const before = chunk.slice();
            const res = PushService._trimChunk( chunk, last_id );
            expect( chunk ).to.eql( before );
            expect( res ).to.eql( after );
        };
        
        test(
            [{id: 1}],
            0,
            [{id: 1}]
        );
        test(
            [{id: 1}, {id: 2}],
            2,
            null
        );
        test(
            [{id: 1}, {id: 2}],
            3,
            null
        );
        
        test(
            [{id: 2}, {id: 3}],
            2,
            [{id: 3}]
        );
        test(
            [{id: 2}, {id: 3}, {id: 4}],
            2,
            [{id: 3}, {id: 4}]
        );
        
        test(
            [{id:2}, {id:3}, {id:4}, {id:10}, {id:20}, {id:30}, {id:31}],
            10,
            [{id:20}, {id:30}, {id:31}],
        );
        test(
            [{id:2}, {id:3}, {id:4}, {id:10}, {id:20}, {id:30}, {id:31}],
            11,
            [{id:20}, {id:30}, {id:31}],
        );
        test(
            [{id:2}, {id:3}, {id:4}, {id:10}, {id:20}, {id:30}, {id:31}],
            19,
            [{id:20}, {id:30}, {id:31}],
        );
        test(
            [{id:2}, {id:3}, {id:4}, {id:10}, {id:20}, {id:30}, {id:31}],
            20,
            [{id:30}, {id:31}],
        );
        test(
            [{id:2}, {id:3}, {id:4}, {id:10}, {id:20}, {id:30}, {id:31}],
            21,
            [{id:30}, {id:31}],
        );
        test(
            [{id:2}, {id:3}, {id:4}, {id:10}, {id:20}, {id:30}, {id:31}],
            3,
            [{id:4}, {id:10}, {id:20}, {id:30}, {id:31}],
        );
        test(
            [{id:2}, {id:3}, {id:4}, {id:10}, {id:20}, {id:30}, {id:31}],
            7,
            [{id:10}, {id:20}, {id:30}, {id:31}],
        );
    });
    
    it('should combine chunks in queue', function() {
        const test = ( queue, chunk, after ) => {
            const res = PushService._mergeQueue( queue, 1000 );
            expect( res ).to.eql( chunk );
            expect( queue ).to.eql( after );
        };
        
        const arr = [];
        for (let i = 0; i < 1000; ++i) {
            arr.push(i);
        }
        
        test(
            [ [1, 2,] ],
            [1, 2],
            []
        );
        
        test(
            [ [1, 2], [4, 8], [10, 20] ],
            [1, 2, 4, 8, 10, 20],
            []
        );
        
        test(
            [ arr, [1, 2,] ],
            arr,
            [ [1, 2] ]
        );
        
        test(
            [ [1, 2,], arr ],
            [1, 2],
            [ arr ]
        );
    });
    
    it('should process live events', function(done) {
        this.timeout(30e3);
        
        const ccm = new AdvancedCCM();
        const executor = new Executor( ccm );
        const liveExecutor = new Executor( ccm, { specDirs: main.specDirs } );
        
        executor.on('notExpected', function() {
            console.log('executor');
            console.dir(arguments);
        });
        liveExecutor.on('notExpected', function() {
            console.log('liveExecutor');
            console.dir(arguments);
        });
        
        $as().add(
            (as) => {
                const call_count = 100;
                SpecTools.once('error', (err) => console.log(err));
                
                const push_svc = MockPushService.register( as, executor, {
                    request_max : call_count,
                });
                push_svc.on('pushError', function() { console.log(arguments); } );
                PushFace.register( as, ccm, 'pfl', executor, null, { executor: liveExecutor } );
                
                push_svc._next_events = [];
                let events_expected = 0;
                
                const live_rcv_svc = {
                    _count: 0,
                    _call_count: 0,
                    _as: null,
                    _inter_as: null,
                    onEvents: function(as, reqinfo) {
                        this._count += reqinfo.params().events.length;
                        this._call_count += 1;
                        
                        if (this._count === events_expected && this._as ) {
                            this._as.success();
                            this._as = null;
                        }
                        
                        if (this._inter_as) {
                            this._inter_as.success();
                            this._inter_as = null;
                        }
                        
                        reqinfo.result(true);
                    },
                };

                liveExecutor.register( as, 'futoin.evt.receiver:1.0', live_rcv_svc );

                as.setTimeout( 10e3 );
                as.setCancel((as) => {
                    console.log(live_rcv_svc);
                });
                
                as.add( (as) => {
                    const pfl = ccm.iface('pfl');
                    pfl.readyToReceive(as, 'LIVE');
                    
                    as.repeat(call_count, (as, i) => {
                        const events = [];
                        for ( let j = 0; j < ((i + 1) * (1000 / call_count)); ++j ) {
                            events.push({
                                id: `${i * 1000 + j + 1}`,
                                type: 'EVT',
                                data: 1,
                                ts: moment.utc().format(),
                            });
                        }
                        events_expected += events.length;
                        push_svc._onEvents(events);
                    });
                    as.add( (as) => {
                        if (live_rcv_svc._count !== events_expected) {
                            as.waitExternal();
                            live_rcv_svc._as = as;
                        }
                    });
                });
                as.add( (as) => {
                    expect( live_rcv_svc._count )
                        .to.equal(events_expected);
                    expect( live_rcv_svc._call_count )
                        .to.be.below(call_count+1);
                } );
                as.add( (as) => done() );
            },
            (as, err) => {
                console.log(err);
                console.log(as.state.error_info);
                console.log(live_rcv_svc);
                console.log(push_svc._stats);
                done(as.state.last_exception);                
            }
        ).execute();
    });
    
    it('should process events', function(done) {
        this.timeout(30e3);
        
        const ccm = new AdvancedCCM();
        const executor = new Executor( ccm );
        const liveExecutor = new Executor( ccm, { specDirs: main.specDirs } );
        const reliableExecutor = new Executor( ccm, { specDirs: main.specDirs } );
        
        executor.on('notExpected', function() {
            console.log('executor');
            console.dir(arguments);
        });
        liveExecutor.on('notExpected', function() {
            console.log('liveExecutor');
            console.dir(arguments);
        });
        reliableExecutor.on('notExpected', function() {
            console.log('reliableExecutor');
            console.dir(arguments);
        });
        
        $as().add(
            (as) => {
                const call_count = 10;
                SpecTools.once('error', (err) => console.log(err));
                
                const push_svc = MockPushService.register( as, executor);
                push_svc.on('pushError', function() { console.log(arguments); } );
                
                PushFace.register( as, ccm, 'pfl', executor, null, { executor: liveExecutor } );
                PushFace.register( as, ccm, 'pfr', executor, null, { executor: reliableExecutor } );
                
                push_svc._next_events = [];
                let events_expected = 0;
                
                const live_rcv_svc = {
                    _count: 0,
                    _call_count: 0,
                    _as: null,
                    _inter_as: null,
                    onEvents: function(as, reqinfo) {
                        this._count += reqinfo.params().events.length;
                        this._call_count += 1;
                        
                        if (this._count === events_expected && this._as ) {
                            this._as.success();
                            this._as = null;
                        }
                        
                        if (this._inter_as) {
                            this._inter_as.success();
                            this._inter_as = null;
                        }
                        
                        reqinfo.result(true);
                    },
                };
                const reliable_rcv_svc = {};
                Object.assign( reliable_rcv_svc, live_rcv_svc );
                liveExecutor.register( as, 'futoin.evt.receiver:1.0', live_rcv_svc );
                reliableExecutor.register( as, 'futoin.evt.receiver:1.0', reliable_rcv_svc );
                
                as.setTimeout( 10e3 );
                as.setCancel((as) => {
                    console.log(live_rcv_svc);
                    console.log(reliable_rcv_svc);
                });
                
                as.add( (as) => {
                    const pfl = ccm.iface('pfl');
                    pfl.readyToReceive(as, 'LIVE');
                    const pfr = ccm.iface('pfr');
                    pfr.readyToReceive(as, 'RLB');
                    
                    as.repeat(call_count, (as, i) => {
                        const events = [];
                        for ( let j = 0; j < ((i + 1) * (1000 / call_count)); ++j ) {
                            events.push({
                                id: `${i * 1000 + j + 1}`,
                                type: 'EVT',
                                data: 1,
                                ts: moment.utc().format(),
                            });
                        }
                        events_expected += events.length;
                        push_svc._onEvents(events);
                        reliable_rcv_svc._inter_as = as;
                        as.waitExternal();
                    });
                    as.add( (as) => {
                        if (reliable_rcv_svc._count !== events_expected) {
                            as.waitExternal();
                            reliable_rcv_svc._as = as;
                        }
                    });
                });
                as.add( (as) => {
                    expect( live_rcv_svc._count )
                        .to.equal(events_expected);
                    expect( reliable_rcv_svc._count )
                        .to.equal(events_expected);
                    expect( live_rcv_svc._call_count )
                        .to.be.below(call_count+1);
                    expect( reliable_rcv_svc._call_count )
                        .to.be.below(call_count+1);
                } );
                as.add( (as) => done() );
            },
            (as, err) => {
                console.log(err);
                console.log(as.state.error_info);
                console.log(live_rcv_svc);
                console.log(reliable_rcv_svc);
                console.log(push_svc._stats);
                done(as.state.last_exception);                
            }
        ).execute();
    });
});
