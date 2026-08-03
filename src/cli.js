#!/usr/bin/env node
import { loadTaskBrief, renderMarkdown, toJsonReport, validateContract } from './index.js';
import fs from 'node:fs';

const args = process.argv.slice(2);
const usage = 'Usage: skill-input-contract <brief.md|brief.json> [--format json|markdown] [--output <path>]';

if (args.includes('--help')) {
  console.log(usage);
  process.exit(0);
}

let options;
try {
  options = parseArgs(args);
} catch (error) {
  console.error(`skill-input-contract: ${error.message}`);
  console.error(usage);
  process.exit(1);
}

try {
  const contract = loadTaskBrief(options.file);
  const validation = validateContract(contract);
  const report = options.format === 'markdown'
    ? renderMarkdown(contract, validation)
    : JSON.stringify(toJsonReport(contract), null, 2);
  if (options.output) fs.writeFileSync(options.output, `${report}\n`);
  else console.log(report);
  process.exit(validation.status === 'fail' ? 2 : 0);
} catch (error) {
  console.error(`skill-input-contract: ${error.message}`);
  process.exit(1);
}

function parseArgs(args) {
  const options = { format: 'json' };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--format' || arg === '--output') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`missing value for ${arg}`);
      }
      if (arg === '--format') options.format = value;
      else options.output = value;
      index += 1;
    } else if (arg.startsWith('-')) {
      throw new Error(`unknown option: ${arg}`);
    } else if (options.file) {
      throw new Error(`unexpected positional argument: ${arg}`);
    } else {
      options.file = arg;
    }
  }

  if (!options.file) throw new Error('missing input file');
  if (!['json', 'markdown'].includes(options.format)) {
    throw new Error(`unsupported format: ${options.format}`);
  }
  return options;
}
