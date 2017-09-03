'use strict';

const expect = require( 'chai' ).expect;

const Executor = require('futoin-executor/Executor');
const GenFace = require('../GenFace');
const DBGenService = require('../DBGenService');

module.exports = function(describe, it, vars) {
    describe('GenFace', function() {
        let as;
        let ccm;
        let executor;
        
        beforeEach('specific', function() {
            ccm = vars.ccm;
            as = vars.as;
            executor = new Executor(ccm);
            
            executor.on('notExpected', function() {
                console.dir(arguments);
            });
            
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
            as.add(
                (as) => {
                    const iface = ccm.iface('evtgen');
                    
                    iface.addEvent(as, 'AB_C', null);
                    iface.addEvent(as, 'AB_C', false);
                    iface.addEvent(as, 'AB_C', 'dt');
                    iface.addEvent(as, 'X', 1);
                    iface.addEvent(as, 'ABCDEFHIJ_KLMN_O', {});
                    iface.addEvent(as, 'ABCDEFHIJ_KLMN_O', { some: 'data' });
                    as.add( (as, res) => {
                        expect(res).to.equal('6');
                    });
                    
                    ccm.db('evt')
                        .select('EvtQueue')
                        .get(['id', 'type', 'data'])
                        .order('id')
                        .executeAssoc(as);
                    as.add( ( as, res ) => {
                        res = res.map( (v) => ({
                            id: parseInt(v.id),
                            type: v.type,
                            data: JSON.parse(v.data),
                        }));
                        expect(res).to.eql([
                            { id: 1, type: 'AB_C', data: null },
                            { id: 2, type: 'AB_C', data: false },
                            { id: 3, type: 'AB_C', data: "dt" },
                            { id: 4, type: 'X', data: 1 },
                            { id: 5, type: 'ABCDEFHIJ_KLMN_O', data: {} },
                            { id: 6, type: 'ABCDEFHIJ_KLMN_O', data: {"some": "data"} },
                        ]);
                    } );
                },
                (as, err) => {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception);
                }
            );
            as.add((as) => done() );
            as.execute();
        });
    });
};
