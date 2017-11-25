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

const GenFace = require( './GenFace' );
const SpecTools = require( 'futoin-invoker/SpecTools' );
const { DB_EVTTABLE } = require( './common' );

/**
 * GenFace for DB backend.
 *
 * The only difference to original GenFace is native DB-specific API.
 */
class DBGenFace extends GenFace
{
    /**
     * Easy access to DB event table name
     * @returns {string} raw table name
     */
    get DB_EVENT_TABLE()
    {
        return DB_EVTTABLE;
    }

    /**
     * Helper to add event generation into DB transaction
     * @param {XferBuilder} xb - instance of transaction builder
     * @param {string} type - event type
     * @param {*} data - any data
     * @param {string} [table=evt_queue] - event queue
     */
    addXferEvent( xb, type, data, table=DB_EVTTABLE )
    {
        const check = SpecTools.checkType( this._raw_info, 'EventType', type );

        if ( !check )
        {
            throw new Error( `Invalid event type: ${type}` );
        }

        xb.insert( table, { affected: 1 } )
            .set( 'type', type )
            .set( 'data', JSON.stringify( data ) )
            .set( 'ts', xb.helpers().now() );
    }
}

module.exports = DBGenFace;
