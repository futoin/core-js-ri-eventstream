'use strict';

/**
 * @file
 *
 * Copyright 2017-2018 FutoIn Project (https://futoin.org)
 * Copyright 2017-2018 Andrey Galkin <andrey@futoin.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const $as = require( 'futoin-asyncsteps' );
const AdvancedCCM = require( 'futoin-invoker/AdvancedCCM' );
const Executor = require( 'futoin-executor/Executor' );
const $asyncevent = require( 'futoin-asyncevent' );

const PushFace = require( './PushFace' );
const ReliableReceiverService = require( './ReliableReceiverService' );

/**
 * Reliable Event Receiver helper to minimize boilerplate code in projects.
 */
class ReliableReceiver
{
    static get COMPONENT()
    {
        return 'LIVE';
    }

    /**
     * Initialize event archiver.
     *
     * @param {AdvancedCCM} executor_ccm - CCM for executor
     */
    constructor( executor_ccm )
    {
        this._executor_ccm = executor_ccm || new AdvancedCCM();
        this._worker_as = null;

        $asyncevent( this, [
            'receiverError',
            'workerError',
            'newEvents',
            'ready',
        ] );
    }

    /**
     * Start receiving events for archiving
     *
     * @param {*} endpoint - see PushFace
     * @param {*} [credentials=null] - see PushFace
     * @param {*} [options={}] - see PushFace
     * @param {string} [options.component] - component name
     * @param {array} [options.want] - "want" parameter for event filtering
     *
     * @note options.executor is overridden
     */
    start( endpoint, credentials=null, options={} )
    {
        if ( this._worker_as )
        {
            throw new Error( 'Already started!' );
        }

        options = Object.assign( {}, options );
        const {
            component = this.constructor.COMPONENT,
            want = null,
        } = options;

        const executor_ccm = this._executor_ccm;
        executor_ccm.once( 'close', () => this.stop() );

        const was = $as();
        this._worker_as = was;
        was.loop( ( as ) => as.add(
            ( as ) =>
            {
                //---
                const executor = new Executor( executor_ccm );
                executor.on( 'notExpected', ( ...args ) => this.emit( 'receiverError', ...args ) );
                options.executor = executor;

                //---
                const ccm = new AdvancedCCM();
                ccm.once( 'close', () => executor.close() );

                executor_ccm.once( 'close', () =>
                {
                    ccm.close();
                    executor.close();
                } );

                //---
                as.setCancel( ( as ) =>
                {
                    ccm.close();
                    executor.close();
                } );

                //---
                this._registerReceiver( as, executor, options );

                PushFace.register(
                    as, ccm, 'pusher',
                    endpoint, credentials, options );

                //---
                let wait_as = true;

                as.add( ( as ) =>
                {
                    const pusher = ccm.iface( 'pusher' );

                    pusher.once( 'disconnect', () =>
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

                        ccm.close();
                        executor.close();
                    } );

                    if ( component !== 'LIVE' )
                    {
                        pusher.registerConsumer( as, component );
                    }

                    pusher.readyToReceive( as, component, want );
                } );
                as.add( ( as ) =>
                {
                    this.emit( 'ready' );

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

    _onWorkerError( as, err )
    {
        this.emit( 'workerError', err, as.state.error_info, as.state.last_exception );
    }

    /**
     * Override to register custom instance of ReliableReceiverService.
     *
     * @param {AsyncSteps} as - async steps interface
     * @param {Executor} executor - Internal Executor instance
     * @param {object} options - passed options
     *
     * @returns {ReliableReceiverService} instance of service
     */
    _registerReceiver( as, executor, options )
    {
        const receiver = this;
        const svc_class = class extends ReliableReceiverService
        {
            _onEvents( as, _reqinfo, events )
            {
                receiver._onEvents( as, events );
            }
        };

        return svc_class.register( as, executor, options );
    }

    /**
     * Override to catch new events here instead of using `newEvents` event handler.
     * @param {AsyncSteps} as - async steps interface
     * @param {array} events - array of events
     */
    _onEvents( as, events )
    {
        this.emit( 'newEvents', events );
    }
}

module.exports = ReliableReceiver;

/**
 * Emitted on not expected receiver errors
 * @event ReliableReceiver#receiverError
 */

/**
 * Emitted on worker errors
 * @event ReliableReceiver#workerError
 */

/**
 * Emitted on new events
 * @event ReliableReceiver#newEvents
 */

/**
 * Emitted after event receiver is ready
 * @event ReliableReceiver#ready
 */
