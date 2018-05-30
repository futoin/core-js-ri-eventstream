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

/**
 * Base storage neutral class for event archiving
 */
class EventArchiver
{
    static get COMPONENT()
    {
        return 'ARCHIVER';
    }

    /**
     * Initialize event archiver.
     *
     * @param {AdvancedCCM} executor_ccm - CCM for executor
     */
    constructor( executor_ccm )
    {
        this._executor_ccm = executor_ccm;
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
                executor_ccm.once( 'close', () => executor.close() );
                executor.on( 'notExpected', ( ...args ) => this.emit( 'receiverError', ...args ) );
                options.executor = executor;

                //---
                const ccm = new AdvancedCCM();
                ccm.once( 'close', () => executor.close() );
                executor_ccm.once( 'close', () => ccm.close() );

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

                        executor.close();
                        ccm.close();
                    } );

                    if ( component !== 'LIVE' )
                    {
                        pusher.registerConsumer( as, component );
                    }

                    pusher.readyToReceive( as, component, want );
                } );
                as.add( ( as ) =>
                {
                    if ( wait_as )
                    {
                        this.emit( 'ready' );

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

/**
 * Emitted after event receiver is ready
 * @event EventArchiver#ready
 */
