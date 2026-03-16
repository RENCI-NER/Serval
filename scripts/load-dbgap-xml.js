/**
 * A script for loading dbGaP XML files into a DuckDB database that can be loaded by Serval.
 */

import * as fs from 'fs';
import { program } from 'commander';
import { XMLParser } from 'fast-xml-parser';
import { DuckDBInstance } from '@duckdb/node-api';

program
    .option('--duckdb <duckdb-db-path>', 'DuckDB database to load into', 'duckdb.duckdb')
    .argument('<dbgap-xml-dir-or-file>', 'Directory or file containing dbGaP XML files');

program.parse();

const { duckdb } = program.opts();
const [ dbgapXmlDirOrFile ] = program.args;

// TODO: fancy code to turn dbGaPXmlDirOrFile into a list of files.

console.log(`Loading dbGaP XML files from ${dbgapXmlDirOrFile} into DuckDB database ${duckdb}.`);

// Read file as XML.
const fileAsString = fs.readFileSync(dbgapXmlDirOrFile).toString()
const parser = new XMLParser();
const parsed = parser.parse(fileAsString);
const data_table = parsed['data_table'];
const variables = data_table['variable'];

// Set up DuckDB database.
const duckdb_instance = await DuckDBInstance.create(duckdb);
const db = await duckdb_instance.connect();

// Set up databases.
await db.run('PRAGMA enable_progress_bar=true')
await db.run(`
    CREATE TABLE IF NOT EXISTS Texts (
        Source TEXT,
        DocumentID TEXT NOT NULL,
        SectionIndex LONG,
        SectionTitle TEXT,
        BodyText TEXT
    );`);

const prepared_insert = await db.prepare('INSERT INTO Texts VALUES ($1, $2, $3, $4, $5)');
for (let index = 0; index < variables.length; index++) {
    const variable = variables[index];

    // TODO: when we have a lot of data, we could consider a createAppender().

    prepared_insert.bindVarchar(1, dbgapXmlDirOrFile);

    // TODO: make sure the DocumentID is unique.
    prepared_insert.bindVarchar(2, variable['name']);

    prepared_insert.bindInteger(3, index);

    // TODO: when we do this for real, we should use filenames as section titles I guess.
    prepared_insert.bindVarchar(4, '');

    const values = ('value' in variable && Array.isArray(variable['value'])) ? variable['value'].join("\n") : '';
    prepared_insert.bindVarchar(5, `${variable['name'] || ''}\n${variable['description'] || ''}\n${values}`);

    await prepared_insert.run();
}

const reader = await db.runAndReadAll('SELECT COUNT(*) AS count FROM Texts');
const rows = reader.getRows();
console.log(`Created DuckDB file ${duckdb} with ${rows[0][0]} rows from ${dbgapXmlDirOrFile}`);
