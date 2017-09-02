'use strict';

const GenService = require( './GenService' );
const { DB_IFACEVER } = require( './common' );

class DBGenService extends GenService {
    constructor(as, executor, options) {
        executor.ccm().assertIface('#db.evt', DB_IFACEVER ):
    }
}

module.exports = DBGenService;
