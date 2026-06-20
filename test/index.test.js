import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTaskBrief, validateContract, renderMarkdown, scoreContract, toJsonReport } from '../src/index.js';
import fs from 'node:fs';

test('extracts inputs, verification, side effects, and approvals', () => {
  const contract = parseTaskBrief(fs.readFileSync('fixtures/task-brief.md', 'utf8'), 'fixtures/task-brief.md');
  assert.equal(contract.title, 'Publish Launch Notes');
  assert.ok(contract.inputs.includes('Repository path'));
  assert.ok(contract.verification.some(item => item.includes('links')));
  assert.ok(contract.sideEffects.some(item => item.includes('send an email')));
  assert.ok(contract.approvalsRequired.some(item => item.includes('approval')));
  assert.equal(validateContract(contract).status, 'pass');
});

test('fails when side effects lack approvals', () => {
  const contract = parseTaskBrief(fs.readFileSync('fixtures/missing-approval.md', 'utf8'), 'fixtures/missing-approval.md');
  const result = validateContract(contract);
  assert.equal(result.status, 'fail');
  assert.ok(result.findings.some(item => item.code === 'approval_gap'));
});

test('renders markdown report', () => {
  const contract = parseTaskBrief('# Demo\n\n## Outcome\n\nValidate a reusable skill request.\n\n## Inputs\n\n- Task brief\n\n## Verification\n\n- Run fixture test', 'demo.md');
  const report = renderMarkdown(contract);
  assert.match(report, /## Outcome/);
  assert.match(report, /Task brief/);
});

test('includes a bounded readiness score in JSON reports', () => {
  const contract = parseTaskBrief(fs.readFileSync('fixtures/task-brief.md', 'utf8'), 'fixtures/task-brief.md');
  assert.equal(scoreContract(contract), 100);
  assert.equal(toJsonReport(contract).score, 100);
});
