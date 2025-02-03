/**
 * A script for loading dbGaP XML files into a DuckDB database that can be loaded by Serval.
 */

import { program } from 'commander';

program
    .argument('<dbgap-xml-dir-or-file>', 'Directory or file containing dbGaP XML files');

program.parse();

const [ dbgapXmlDirOrFile ] = program.args;

// TODO: fancy code to turn dbGaPXmlDirOrFile into a list of files.

console.log(`Reading dbGaP XML files from ${dbgapXmlDirOrFile}`);
