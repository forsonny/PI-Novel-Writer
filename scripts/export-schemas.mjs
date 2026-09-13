#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { schemaCatalogue } from '../extensions/llgf/catalogue.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
const check = process.argv.includes('--check');
const dir = path.join(root, 'schemas');
if (!check) fs.mkdirSync(dir, { recursive: true });
for (const [name, schema] of Object.entries(schemaCatalogue)) {
  const file = path.join(dir, name + '.schema.json');
  const text = JSON.stringify(schema, null, 2) + '\n';
  if (check) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) throw new Error(`Stale schema export: ${name}`);
  } else fs.writeFileSync(file, text, 'utf8');
}
console.log(`${check ? 'Verified' : 'Exported'} ${Object.keys(schemaCatalogue).length} structural schemas. Domain checks remain required.`);
