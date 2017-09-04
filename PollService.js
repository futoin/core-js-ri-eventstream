'use strict';

const PingService = require( 'futoin-executor/PingService' );
const PingFace = require( 'futoin-invoker/PingFace' );
const PollFace = require( './PollFace' );


/**
 * Event Stream - Poll Service Base
 */
class PollService extends PingService
{
    get MAX_EVENTS()
    {
        return 1000;
    }

    /**
     * Register futoin.evt.poll interface with Executor
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {PollService} instance
     */
    static register( as, executor, options={} )
    {
        const ifacever = 'futoin.evt.poll:' + PollFace.LATEST_VERSION;
        const impl = new this( as, executor, options );
        const spec_dirs = [ PollFace.spec(), PingFace.spec( PollFace.PING_VERSION ) ];

        executor.register( as, ifacever, impl, spec_dirs );
        executor.once( 'close', () => impl._close() );

        return impl;
    }

    _close()
    {
    }
}

module.exports = PollService;
