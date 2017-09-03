'use strict';

const GenService = require( './GenService' );
const { DB_IFACEVER } = require( './common' );

class DBGenService extends GenService
{
    constructor( _as, executor, _options )
    {
        super();
        executor.ccm().assertIface( '#db.evt', DB_IFACEVER );
    }
}

module.exports = DBGenService;
