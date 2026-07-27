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
  assert.ok(contract.sideEffects.some(item => item.includes('Send a notification email')));
  assert.ok(result.findings.some(item => item.code === 'approval_gap'));
});

test('allows explicitly local report writes without an approval requirement', () => {
  const contract = parseTaskBrief('# Local report\n\n## Outcome\n\nWrite a report locally.\n\n## Inputs\n\n- source file\n\n## Constraints\n\n- Do not access external systems\n\n## Verification\n\n- inspect report');
  const result = validateContract(contract);

  assert.deepEqual(contract.sideEffects, []);
  assert.equal(result.status, 'pass');
  assert.ok(!result.findings.some(item => item.code === 'approval_gap'));
});

test('still classifies unqualified durable writes as side effects', () => {
  const contract = parseTaskBrief('# Persist report\n\n## Outcome\n\nWrite a report.\n\n## Inputs\n\n- source file\n\n## Verification\n\n- inspect report');
  const result = validateContract(contract);

  assert.deepEqual(contract.sideEffects, ['Write a report.']);
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
