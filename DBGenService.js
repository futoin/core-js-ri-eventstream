'use strict';

/**
 * @file
 *
 * Copyright 2017 FutoIn Project (https://futoin.org)
 * Copyright 2017 Andrey Galkin <andrey@futoin.org>
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

const GenService = require( './GenService' );
const { DB_IFACEVER, DB_EVTTABLE } = require( './common' );

const SYM_ADD_EVT = Symbol( 'AddEventQuery' );

/**
 * Database-specific event generation service
 */
class DBGenService extends GenService
{
    /**
     * Please use DBGenService.regster()
     *
     * @param {AsyncSteps} _as - async step interface
     * @param {Executor} executor - related Executor
     * @param {object} [options={}] - options
     * @param {string} [options.event_table=default] - events table
     */
    constructor( _as, executor, options )
    {
        super();

        const ccm = executor.ccm();
        ccm.assertIface( '#db.evt', DB_IFACEVER );

        const db = ccm.db( 'evt' );

        this._evt_table = db.queryBuilder().identifier(
            options.event_table || DB_EVTTABLE
        );
    }

    addEvent( as, reqinfo )
    {
        const db = reqinfo.executor().ccm().db( 'evt' );
        const params = reqinfo.params();

        const pq = db.getPrepared( SYM_ADD_EVT, ( db ) =>
        {
            const qb = db.insert( this._evt_table );
            qb.set( 'type', qb.param( 'type' ) )
                .set( 'data', qb.param( 'data' ) )
                .set( 'ts', qb.helpers().now() )
                .getInsertID( 'id' );
            return qb.prepare();
        } );

        pq.execute( as, {
            type: params.type,
            data: JSON.stringify( params.data ),
        } );

        as.add( ( as, res ) =>
        {
            reqinfo.result( `${res.rows[0][0]}` );
        } );
    }
}

module.exports = DBGenService;
