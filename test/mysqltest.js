'use strict';

const child_process = require( 'child_process' );
const $as = require( 'futoin-asyncsteps' );
const AdvancedCCM = require( 'futoin-invoker/AdvancedCCM' );
const DBAutoConfig = require( 'futoin-database/AutoConfig' );
const integration_suite = require( './integrationsuite' );

const DB_PORT = process.env.MYSQL_PORT || '3307';

describe( 'MySQL', function()
{
    before( function( done )
    {
        this.timeout( 30e3 );
        const ccm = new AdvancedCCM();

        $as().add(
            ( as ) =>
            {
                DBAutoConfig( as, ccm, null, {
                    DB_TYPE: 'mysql',
                    DB_HOST: '127.0.0.1',
                    DB_PORT: DB_PORT,
                    DB_USER: 'ftntest',
                } );
                as.add( ( as ) =>
                {
                    ccm.db().query( as, 'DROP DATABASE IF EXISTS evtactive' );
                    ccm.db().query( as, 'DROP DATABASE IF EXISTS evthistory' );
                    ccm.db().query( as, 'CREATE DATABASE evtactive' );
                    ccm.db().query( as, 'CREATE DATABASE evthistory' );
                    ccm.db().query( as, 'SET GLOBAL innodb_flush_log_at_trx_commit=0' );
                    ccm.db().query( as, 'SET GLOBAL sync_binlog=0' );
                } );
                as.add( ( as ) =>
                {
                    let res;

                    res = child_process.spawnSync(
                        'cid',
                        [
                            'tool', 'exec', 'flyway', '--',
                            'migrate',
                            `-url=jdbc:mysql://127.0.0.1:${DB_PORT}/evtactive`,
                            '-user=ftntest',
                            `-locations=filesystem:${__dirname}/../sql/active/mysql`,
                        ]
                    );

                    if ( res.status )
                    {
                        console.log( res.stderr.toString() );
                        as.error( 'Fail' );
                    }

                    res = child_process.spawnSync(
                        'cid',
                        [
                            'tool', 'exec', 'flyway', '--',
                            'migrate',
                            `-url=jdbc:mysql://127.0.0.1:${DB_PORT}/evthistory`,
                            '-user=ftntest',
                            `-locations=filesystem:${__dirname}/../sql/dwh/mysql`,
                        ]
                    );

                    if ( res.status )
                    {
                        console.log( res.stderr.toString() );
                        as.error( 'Fail' );
                    }

                    ccm.close();
                } );
            },
            ( as, err ) =>
            {
                console.log( err );
                console.log( as.state.error_info );
                done( as.state.last_exception || 'Fail' );
            }
        ).add( ( as ) => done() )
            .execute();
    } );

    const vars = {
        as: null,
        ccm: null,
    };

    beforeEach( 'specific', function()
    {
        const ccm = new AdvancedCCM();
        const as = $as();
        vars.ccm = ccm;
        vars.as = as;

        as.add(
            ( as ) =>
            {
                DBAutoConfig( as, ccm, {
                    evt: {},
                    evtdwh: {},
                }, {
                    DB_EVT_TYPE: 'mysql',
                    DB_EVT_HOST: '127.0.0.1',
                    DB_EVT_PORT: DB_PORT,
                    DB_EVT_USER: 'ftntest',
                    DB_EVT_DB: 'evtactive',
                    DB_EVTDWH_TYPE: 'mysql',
                    DB_EVTDWH_HOST: '127.0.0.1',
                    DB_EVTDWH_PORT: DB_PORT,
                    DB_EVTDWH_USER: 'ftntest',
                    DB_EVTDWH_DB: 'evthistory',
                } );
            },
            ( as, err ) =>
            {
                console.log( err );
                console.log( as.state.error_info );
                console.log( as.state.last_exception );
            }
        );
    } );

    afterEach( function()
    {
        vars.ccm.close();
        vars.ccm = null;
    } );

    integration_suite( describe, it, vars );
} );
