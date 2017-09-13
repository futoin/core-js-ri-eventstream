'use strict';

const _defaults = require( 'lodash/defaults' );
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
     * @param {boolean} [options.allow_reliable=true] - allow reliable consumers
     * @param {boolean} [options.allow_polling=true] - allow polling calls
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

    constructor( as, _executor, options )
    {
        super();
        _defaults( options, {
            allow_reliable: true,
            allow_polling: true,
        } );
        this._allow_reliable = options.allow_reliable;
        this._allow_polling = options.allow_polling;
    }

    _close()
    {
    }

    registerConsumer( as, reqinfo )
    {
        const component = reqinfo.params().component;

        if ( component === 'LIVE' )
        {
            as.error( 'LiveNotAllowed',
                'Live consumer should not register' );
        }

        if ( !this._allow_reliable )
        {
            as.error( 'SecurityError', 'Registration is not allowed' );
        }

        const user_id = reqinfo.info.USER_INFO.localID();
        const ident = `${user_id}:${component}`;

        reqinfo.result( true ); // set in advance
        this._registerConsumer( as, reqinfo.executor(), ident );
    }

    _registerConsumer( as, _executor, _ident )
    {
        as.error( 'NotImplemented', 'Please override PollService#_registerConsumer' );
    }

    pollEvents( as, reqinfo )
    {
        if ( !this._allow_polling )
        {
            as.error( 'SecurityError', 'Only event push is allowed' );
        }

        const params = reqinfo.params();
        const component = params.component;
        const user_id = reqinfo.info.USER_INFO.localID();
        const ident = `${user_id}:${component}`;
        let last_id = params.last_id || '0';
        const want = params.want;
        const is_reliable = ( component !== 'LIVE' );

        if ( is_reliable && !this._allow_reliable )
        {
            as.error( 'SecurityError', 'Reliable delivery is disabled' );
        }

        this._pollEvents( as, reqinfo.executor(), ident, last_id, want, is_reliable );
        as.add( ( as, res ) => reqinfo.result( res ) );
    }

    _pollEvents( as, _executor, _ident, _last_id, _want, _is_reliable )
    {
        as.error( 'NotImplemented', 'Please override PollService#_pollEvents' );
    }
}

module.exports = PollService;
