#!/usr/bin/env node
import { loadTaskBrief, renderMarkdown, toJsonReport, validateContract } from './index.js';

const args = process.argv.slice(2);
const file = args.find(arg => !arg.startsWith('-'));
const format = valueAfter(args, '--format') || 'json';
if (!file || args.includes('--help')) {
  console.log('Usage: skill-input-contract <brief.md|brief.json> [--format json|markdown]');
  process.exit(file ? 0 : 1);
}

try {
  const contract = loadTaskBrief(file);
  const validation = validateContract(contract);
  if (format === 'markdown') console.log(renderMarkdown(contract, validation));
  else console.log(JSON.stringify(toJsonReport(contract), null, 2));
  process.exit(validation.status === 'fail' ? 2 : 0);
} catch (error) {
  console.error(`skill-input-contract: ${error.message}`);
  process.exit(1);
}

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}
