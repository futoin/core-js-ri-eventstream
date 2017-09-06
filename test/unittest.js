'use strict';

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
