'use strict';

const Executor = require('futoin-executor/Executor');

module.exports = function(describe, it, vars) {
    describe('GenFace', function() {
        const GenFace = require('../GenFace');
        const DBGenService = require('../DBGenService');
        let as;
        let ccm;
        let executor;
        
        beforeEach('specific', function() {
            ccm = vars.ccm;
            as = vars.as;
            executor = new Executor(ccm);
            
            as.add(
                (as) => {
                    DBGenService.register(as, executor);
                    GenFace.register(as, ccm, 'evtgen', executor);
                },
                (as, err) => {
                    console.log(err);
                    console.log(as.state.error_info);
                    console.log(as.state.last_exception);
                }
            );
        });
        
        it('should generate events', function(done) {
            as.add((as) => done() );
            as.execute();
        });
    });
};
