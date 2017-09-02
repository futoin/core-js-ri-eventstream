'use strict';

const mixin = require( 'mixin' );
const DBPollService = require( './DBPollService' );
const PushService = require( './PushService' );
const { DB_IFACEVER } = require( './common' );

class DBPushService extends mixin(PushService, DBPollService) {

}

module.exports = DBPushService;
