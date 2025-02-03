/**
 * A script for loading dbGaP XML files into a DuckDB database that can be loaded by Serval.
 */

import * as fs from 'fs';
import { program } from 'commander';
import { XMLParser } from 'fast-xml-parser';

program
    .option('--duckdb <duckdb-db-path>', 'DuckDB database to load into', 'duckdb.duckdb')
    .argument('<dbgap-xml-dir-or-file>', 'Directory or file containing dbGaP XML files');

program.parse();

const { duckdb } = program.opts();
const [ dbgapXmlDirOrFile ] = program.args;

// TODO: fancy code to turn dbGaPXmlDirOrFile into a list of files.

console.log(`Loading dbGaP XML files from ${dbgapXmlDirOrFile} into DuckDB database ${duckdb}.`);

const fileAsString = fs.readFileSync(dbgapXmlDirOrFile).toString()
const parser = new XMLParser();
const parsed = parser.parse(fileAsString);
const data_table = parsed['data_table'];
const variables = data_table['variable'];

for (const variable of variables) {
    console.log('Variable: ', variable);
}
