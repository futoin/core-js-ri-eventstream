'use strict';

const _defaults = require( 'lodash/defaults' );
const DBPollService = require( './DBPollService' );
const PushService = require( './PushService' );

class DBPushService extends PushService
{

}

_defaults( DBPushService.prototype, DBPollService.prototype );

module.exports = DBPushService;
