import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cli = path.resolve('src/cli.js');
const fixture = path.resolve('fixtures/task-brief.md');

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

test('accepts format options before or after the positional input', () => {
  for (const args of [
    ['--format', 'markdown', fixture],
    [fixture, '--format', 'markdown']
  ]) {
    const result = run(args);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^# Publish Launch Notes/m);
  }
});

test('writes JSON output with options before or after the positional input', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-input-contract-'));
  try {
    for (const [index, args] of [
      ['--output', path.join(directory, 'before.json'), fixture, '--format', 'json'],
      [fixture, '--format', 'json', '--output', path.join(directory, 'after.json')]
    ].entries()) {
      const result = run(args);
      assert.equal(result.status, 0, result.stderr);
      const outputPath = args[args.indexOf('--output') + 1];
      const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      assert.equal(report.validation.status, 'pass', `case ${index}`);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects unsupported formats with a usage error', () => {
  const result = run([fixture, '--format', 'yaml']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unsupported format: yaml/);
  assert.match(result.stderr, /Usage:/);
});

test('rejects missing option values with a usage error', () => {
  for (const flag of ['--format', '--output']) {
    const result = run([fixture, flag]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`missing value for ${flag}`));
    assert.match(result.stderr, /Usage:/);
  }
});

test('preserves validation failure exit code', () => {
  const result = run([path.resolve('fixtures/missing-approval.md'), '--format', 'json']);
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).validation.status, 'fail');
});

test('exits with an approval gap when approval wording is denied', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-input-contract-'));
  const brief = path.join(directory, 'denied-approval.md');
  try {
    fs.writeFileSync(brief, '# Publish report\n\n## Outcome\n\nPublish the report.\n\n## Inputs\n\n- report\n\n## Constraints\n\n- No approval is required\n\n## Verification\n\n- inspect publication\n');
    const result = run([brief, '--format', 'json']);
    const report = JSON.parse(result.stdout);

    assert.equal(result.status, 2);
    assert.deepEqual(report.contract.approvalsRequired, []);
    assert.equal(report.validation.status, 'fail');
    assert.ok(report.validation.findings.some(item => item.code === 'approval_gap'));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
