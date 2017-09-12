'use strict';

module.exports = {
    FTN18_VERSION : '1.0',
    PING_VERSION : '1.0',
    DB_IFACEVER : 'futoin.db.l2:1.0',
    DB_EVTTABLE : 'evt_queue',
    DB_EVTCONSUMERS : 'evt_consumers',
    DB_EVTHISTORY : 'evt_history',

    cmpIds: function( a, b )
    {
        const a_len = a.length;
        const b_len = b.length;

        if ( a_len === b_len )
        {
            return a.localeCompare( b );
        }
        else
        {
            return a_len - b_len;
        }
    },
};
