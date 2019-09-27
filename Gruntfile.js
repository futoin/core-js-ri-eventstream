'use strict';

/**
 * @file
 *
 * Copyright 2017 FutoIn Project (https://futoin.org)
 * Copyright 2017 Andrey Galkin <andrey@futoin.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var fs = require( 'fs' );

module.exports = function( grunt )
{
    grunt.initConfig( {
        pkg: grunt.file.readJSON( 'package.json' ),

        eslint: {
            options: { fix: true,
                ignore: false },
            target: [ '*.js', 'lib/**/*.js', 'test/**/*.js' ],
        },
        jsdoc2md: {
            README: {
                src: [ '*.js', 'lib/**/*.js' ],
                dest: "README.md",
                options: { template: fs.readFileSync( 'misc/README.hbs', 'utf8' ) },
            },
        },
        replace: {
            README: {
                src: "README.md",
                overwrite: true,
                replacements: [
                    {
                        from: "$$pkg.version$$",
                        to: "<%= pkg.version %>",
                    },
                ],
            },
        },
        nyc: {
            cover: {
                options: {
                    cwd: '.',
                    exclude: [
                        'coverage/**',
                        'dist/**',
                        'es5/**',
                        'examples/**',
                        'test/**',
                        '.eslintrc.js',
                        'Gruntfile.js',
                        'webpack.*.js',
                    ],
                    reporter: [ 'lcov', 'text-summary' ],
                    reportDir: 'coverage',
                    all: true,
                },
                cmd: false,
                args: [ 'mocha', 'test/*test.js' ],
            },
            report: {
                options: {
                    reporter: 'text-summary',
                },
            },
        },
    } );

    grunt.loadNpmTasks( 'grunt-eslint' );
    grunt.loadNpmTasks( 'grunt-simple-nyc' );

    grunt.registerTask( 'check', [ 'eslint' ] );

    grunt.registerTask( 'node', [ 'nyc' ] );
    grunt.registerTask( 'test', [
        'check',
        'node',
        'doc',
    ] );

    grunt.loadNpmTasks( 'grunt-jsdoc-to-markdown' );
    grunt.loadNpmTasks( 'grunt-text-replace' );
    grunt.registerTask( 'doc', [ 'jsdoc2md:README', 'replace:README' ] );

    grunt.registerTask( 'default', [ 'check' ] );
};
