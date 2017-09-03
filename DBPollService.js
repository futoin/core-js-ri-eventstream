'use strict';

const PollService = require( './PollService' );
const { DB_IFACEVER } = require( './common' );

class DBPollService extends PollService
{
    constructor( _as, executor, _options )
    {
        super();
        executor.ccm().assertIface( '#db.evt', DB_IFACEVER );
    }
}

module.exports = DBPollService;
