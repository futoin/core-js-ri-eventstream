'use strict';

/**
 * @file
 *
 * Copyright 2018 FutoIn Project (https://futoin.org)
 * Copyright 2018 Andrey Galkin <andrey@futoin.org>
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

const { AdvancedCCM } = require( 'futoin-invoker' );
const { Executor } = require( 'futoin-executor' );
const DBAutoConfig = require( 'futoin-database/AutoConfig' );

const DBGenFace = require( './DBGenFace' );
const DBGenService = require( './DBGenService' );
const PushFace = require( './PushFace' );
const DBPushService = require( './DBPushService' );

const DBEventArchiver = require( './DBEventArchiver' );
const DBEventDiscarder = require( './DBEventDiscarder' );

const {
    GEN_FACE,
    POLL_FACE,
    PUSH_FACE,
} = require( './common' );

/**
 * All-in-one DB EventStream initialization
 */
class DBServiceApp
{
    /**
     * C-tor
     *
     * @param {AsyncSteps} as - AsyncSteps interface
     * @param {object} options={} - options
     * @param {AdvancedCCM} [options.ccm] - external CCM instance
     * @param {Executor} [options.executor] - external private executor instance
     * @param {object} [options.ccmOptions] - auto-CCM options
     * @param {callable} [options.notExpectedHandler] - 'notExpected' error handler
     * @param {object} [options.executorOptions] - private auto-Executor options
     * @param {object} [options.evtOptions] - eventstream options
     * @param {object} [options.discarderOptions] - discarder options
     * @param {boolean} [options.enableDiscarder] - enable discarder, if true
     * @param {object} [options.archiverOptions] - discarder options
     * @param {boolean} [options.enableArchiver] - enable archiver, if true
     */
    constructor( as, options = {} )
    {
        let {
            ccm,
            executor,
            notExpectedHandler,
            databaseConfig = {},
            enableDiscarder,
            enableArchiver,
            evtOptions = {},
        } = options;

        if ( !ccm )
        {
            ccm = new AdvancedCCM( options.ccmOptions );
        }

        ccm.once( 'close', () =>
        {
            this._ccm = null;
            this.close();
        } );


        if ( !notExpectedHandler )
        {
            notExpectedHandler = function()
            {
                // eslint-disable-next-line no-console
                console.log( arguments );
            };
        }

        if ( !executor )
        {
            executor = new Executor( ccm, options.executorOptions );
            executor.on( 'notExpected', notExpectedHandler );
        }

        this._ccm = ccm;
        this._executor = executor;

        // Common database
        if ( 'DB_EVT_TYPE' in databaseConfig )
        {
            DBAutoConfig( as, ccm, {
                evt: {},
            }, databaseConfig );
        }

        if ( 'DB_EVTDWH_TYPE' in databaseConfig )
        {
            DBAutoConfig( as, ccm, {
                evtdwh: {},
            }, databaseConfig );
        }

        as.add( ( as ) =>
        {
            DBGenService.register( as, executor, evtOptions );
            DBGenFace.register( as, ccm, GEN_FACE, executor );
            DBPushService.register( as, executor, evtOptions );
            PushFace.register( as, ccm, PUSH_FACE, executor );
            ccm.alias( PUSH_FACE, POLL_FACE );
        } );

        if ( enableDiscarder )
        {
            const discarder = new DBEventDiscarder();
            discarder.on( 'workerError', notExpectedHandler );

            this._discarder = discarder;

            as.add( ( as ) => discarder.start( ccm, options.discarderOptions ) );
        }

        if ( enableArchiver )
        {
            const archiver = new DBEventArchiver( ccm );
            archiver.on( 'workerError', notExpectedHandler );

            this._archiver = archiver;

            const opts = options.archiverOptions;
            as.add( ( as ) => archiver.start( executor, null, opts ) );
        }
    }

    /**
     * CCM instance accessor
     * @returns {AdvancedCCM} instance
     */
    ccm()
    {
        return this._ccm;
    }

    /**
     * Executor instance accessor
     * @returns {Executor} instance
     */
    executor()
    {
        return this._executor;
    }

    /**
     * Shutdown of app and related instances
     * @param {callable} [done] - done callback
     */
    close( done=null )
    {
        if ( this._ccm )
        {
            this._ccm.close();
            this._ccm = null;

            this._executor.close( done );
        }

        this._executor = null;
    }
}

module.exports = DBServiceApp;
