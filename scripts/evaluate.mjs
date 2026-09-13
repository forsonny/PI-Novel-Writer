#!/usr/bin/env node
// Offline preparation/description of supplied, frozen outputs. Never calls a model.
import fs from 'node:fs';
import path from 'node:path';
import { prepareReaderPackets, describeTrials, describeResponses } from '../extensions/llgf/evaluation.ts';
const [action, configPath, recordsPath, outputPath] = process.argv.slice(2);
const read = file => {
  if (!file || !fs.statSync(file).isFile() || fs.statSync(file).size > 128 * 1024 * 1024) throw new Error('Expected a local input file smaller than 128 MiB');
  return fs.readFileSync(file, 'utf8');
};
const rows = file => read(file).split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
try {
  if (!['prepare', 'describe', 'responses'].includes(action) || !outputPath) throw new Error('Usage: node --experimental-strip-types scripts/evaluate.mjs <prepare|describe|responses> <study-or-key.json> <records.jsonl> <new-output-path>');
  const config = JSON.parse(read(configPath)), records = rows(recordsPath);
  if (action === 'prepare') {
    const key = prepareReaderPackets(config, records, path.resolve(outputPath));
    console.log(JSON.stringify({ output: path.resolve(outputPath), packetId: key.packetId, pairs: key.pairs.length, warning: 'Distribute readers/ only. Keep private/ and source data restricted. No reader responses have been collected.' }, null, 2));
  } else {
    const result = action === 'describe' ? describeTrials(config, records) : describeResponses(config, records);
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log('Descriptive output written without replacing an existing file. Statistical inference was not performed.');
  }
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
