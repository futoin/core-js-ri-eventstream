'use strict';

const $as = require( 'futoin-asyncsteps' );
const AdvancedCCM = require( 'futoin-invoker/AdvancedCCM' );
const Executor = require( 'futoin-executor/Executor' );
const ee = require( 'event-emitter' );

const PushFace = require( './PushFace' );

class EventArchiver
{
    /**
     * Initialize event archiver.
     * 
     * @param {AdvancedCCM} executor_ccm - CCM for executor
     */
    constructor( executor_ccm )
    {
        this._executor_ccm = executor_ccm;
        this._worker_as = null;

        ee( this );
    }

    /**
     * Start receiving events for archiving
     * 
     * @param {*} endpoint - see PushFace
     * @param {*} [credentials=null] - see PushFace
     * @param {*} [options={}] - see PushFace
     * 
     * @note options.executor is overridden
     */
    start( endpoint, credentials=null, options={} )
    {
        if ( this._worker_as )
        {
            return;
        }

        options = Object.assign( {}, options );
        options.component = options.component || 'ARCHIVER';

        const was = $as();
        this._worker_as = was;
        was.loop( ( as ) => as.add(
            ( as ) =>
            {
                //---
                const executor = new Executor( this._executor_ccm );
                this._executor_ccm.once( 'close', () => executor.close() );
                executor.on( 'notExpected', ( ...args ) => this.emit( 'receiverError', ...args ) );
                options.executor = executor;

                //---
                const ccm = new AdvancedCCM();

                //---
                as.setCancel( ( as ) =>
                {
                    executor.close();
                    ccm.close();
                } );

                //---
                const receiver = this._registerReceiver( as, executor );
                receiver.on( 'newEvents', ( ...args ) => this.emit( 'newEvents', ...args ) );

                PushFace.register(
                    as, ccm, 'pusher',
                    endpoint, credentials, options );

                //---
                let wait_as = true;

                as.add( ( as ) =>
                {
                    ccm.iface( 'pusher' ).once( 'disconnect', () =>
                    {
                        this.emit( 'workerError', 'Disconnect', 'Lost connection' );

                        if ( wait_as === true )
                        {
                            wait_as = false;
                        }
                        else if ( wait_as.state )
                        {
                            wait_as.success();
                        }

                        executor.close();
                        ccm.close();
                    } );

                    ccm.iface( 'pusher' ).registerConsumer( as, options.component );
                    ccm.iface( 'pusher' ).readyToReceive( as, options.component );
                } );
                as.add( ( as ) =>
                {
                    if ( wait_as )
                    {
                        wait_as = as;
                        as.waitExternal();
                    }
                } );
            },
            ( as, err ) =>
            {
                this._onWorkerError( as, err );
                as.success();
            }
        ) );
        was.execute();
    }

    /**
     * Stop receiving events
     */
    stop()
    {
        if ( this._worker_as )
        {
            this._worker_as.cancel();
            this._worker_as = null;
        }
    }

    _registerReceiver( as, _executor )
    {
        as.error( 'NotImplemented' );
    }

    _onWorkerError( as, err )
    {
        this.emit( 'workerError', err, as.state.error_info, as.state.last_exception );
    }
}

module.exports = EventArchiver;

/**
 * Emitted on not expected receiver errors
 * @event EventArchiver#receiverError
 */

/**
 * Emitted on worker errors
 * @event EventArchiver#workerError
 */

/**
 * Emitted after new events being pushed to DWH
 * @event EventArchiver#newEvents
 */
