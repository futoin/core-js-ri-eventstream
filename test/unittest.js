'use strict';

const expect = require('chai').expect;

const Executor = require('futoin-executor/Executor');
const AdvancedCCM = require( 'futoin-invoker/AdvancedCCM' );
const $as = require( 'futoin-asyncsteps' );

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
});
