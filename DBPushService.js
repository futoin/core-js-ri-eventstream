'use strict';

const _defaults = require( 'lodash/defaults' );
const DBPollService = require( './DBPollService' );
const PushService = require( './PushService' );

class DBPushService extends PushService
{
    readyToReceive( as, reqinfo )
    {
        void reqinfo;
    }
}

_defaults( DBPushService.prototype, DBPollService.prototype );

module.exports = DBPushService;
