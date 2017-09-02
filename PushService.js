'use strict';

const PingFace = require( 'futoin-invoker/PingFace' );
const PollService = require( './PollService' );
const PushFace = require( './PushFace' );


/**
 * Event Stream - Push Service Base
 */
class PushService extends PollService
{
    /**
     * Register futoin.evt.push interface with Executor
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {PushService} instance
     */
    static register( as, executor, options )
    {
        const ifacever = 'futoin.evt.poll:' + PushFace.LATEST_VERSION;
        const impl = new this( options );
        const spec_dirs = [ PushFace.spec(), PingFace.spec( PushFace.PING_VERSION ) ];

        executor.register( as, ifacever, impl, spec_dirs );
        executor.once( 'close', () => impl._close() );

        return impl;
    }

    _close()
    {
    }
}

module.exports = PushService;
