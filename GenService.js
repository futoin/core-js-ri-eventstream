'use strict';

const PingService = require( 'futoin-executor/PingService' );
const PingFace = require( 'futoin-invoker/PingFace' );
const GenFace = require( './GenFace' );


/**
 * Event Stream - Generator Service Base
 */
class GenService extends PingService
{
    /**
     * Register futoin.evt.gen interface with Executor
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {GenService} instance
     */
    static register( as, executor, options )
    {
        const ifacever = 'futoin.evt.gen:' + GenFace.LATEST_VERSION;
        const impl = new this( as, executor, options );
        const spec_dirs = [ GenFace.spec(), PingFace.spec( GenFace.PING_VERSION ) ];

        executor.register( as, ifacever, impl, spec_dirs );
        executor.once( 'close', () => impl._close() );

        return impl;
    }

    _close()
    {
    }
}

module.exports = GenService;
