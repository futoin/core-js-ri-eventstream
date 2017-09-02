'use strict';

const PollService = require( './PollService' );
const { DB_IFACEVER } = require( './common' );

class DBPollService extends PollService {
    constructor(as, executor, options) {
        executor.ccm().assertIface('#db.evt', DB_IFACEVER ):
    }
}

module.exports = DBPollService;
