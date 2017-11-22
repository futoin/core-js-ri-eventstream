'use strict';

const child_process = require( 'child_process' );
const $as = require( 'futoin-asyncsteps' );
const AdvancedCCM = require( 'futoin-invoker/AdvancedCCM' );
const DBAutoConfig = require( 'futoin-database/AutoConfig' );
const integration_suite = require( './integrationsuite' );

const DB_PORT = process.env.POSTGRESQL_PORT || '5433';

describe( 'PostgreSQL', function()
{
    before( function( done )
    {
        this.timeout( 30e3 );
        const ccm = new AdvancedCCM();

        $as().add(
            ( as ) =>
            {
                DBAutoConfig( as, ccm, null, {
                    DB_TYPE: 'postgresql',
                    DB_HOST: '127.0.0.1',
                    DB_PORT: DB_PORT,
                    DB_USER: 'ftntest',
                    DB_PASS: 'test',
                    DB_DB: 'postgres',
                } );
                as.add( ( as ) =>
                {
                    ccm.db().query( as, 'DROP DATABASE IF EXISTS evtactive' );
                    ccm.db().query( as, 'DROP DATABASE IF EXISTS evthistory' );
                    ccm.db().query( as, 'CREATE DATABASE evtactive' );
                    ccm.db().query( as, 'CREATE DATABASE evthistory' );
                } );
                as.add( ( as ) =>
                {
                    let res;

                    res = child_process.spawnSync(
                        'cid',
                        [
                            'tool', 'exec', 'flyway', '--',
                            'migrate',
                            `-url=jdbc:postgresql://127.0.0.1:${DB_PORT}/evtactive`,
                            '-user=ftntest',
                            '-password=test',
                            `-locations=filesystem:${__dirname}/../sql/active/postgresql`,
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
                            `-url=jdbc:postgresql://127.0.0.1:${DB_PORT}/evthistory`,
                            '-user=ftntest',
                            '-password=test',
                            `-locations=filesystem:${__dirname}/../sql/dwh/postgresql`,
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
                    DB_EVT_TYPE: 'postgresql',
                    DB_EVT_HOST: '127.0.0.1',
                    DB_EVT_PORT: DB_PORT,
                    DB_EVT_USER: 'ftntest',
                    DB_EVT_DB: 'evtactive',
                    DB_EVT_PASS: 'test',
                    DB_EVTDWH_TYPE: 'postgresql',
                    DB_EVTDWH_HOST: '127.0.0.1',
                    DB_EVTDWH_PORT: DB_PORT,
                    DB_EVTDWH_USER: 'ftntest',
                    DB_EVTDWH_DB: 'evthistory',
                    DB_EVTDWH_PASS: 'test',
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
