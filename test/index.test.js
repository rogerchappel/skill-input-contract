import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTaskBrief, validateContract, renderMarkdown, scoreContract, toJsonReport } from '../src/index.js';
import fs from 'node:fs';

test('extracts inputs, verification, side effects, and approvals', () => {
  const contract = parseTaskBrief(fs.readFileSync('fixtures/task-brief.md', 'utf8'), 'fixtures/task-brief.md');
  assert.equal(contract.title, 'Publish Launch Notes');
  assert.ok(contract.inputs.includes('Repository path'));
  assert.ok(contract.verification.some(item => item.includes('links')));
  assert.ok(contract.sideEffects.some(item => item.includes('Write a launch post draft')));
  assert.ok(!contract.sideEffects.some(item => item.includes('do not send')));
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

test('ignores external actions that are explicitly negated', () => {
  const briefs = [
    'Do not send the report.',
    'Never publish the report.',
    'Prepare the report without uploading it.',
    'Do not send, post, or publish the report.'
  ];

  for (const outcome of briefs) {
    const contract = parseTaskBrief(`# Local preparation\n\n## Outcome\n\n${outcome}\n\n## Inputs\n\n- source file\n\n## Verification\n\n- inspect report`);
    const result = validateContract(contract);

    assert.deepEqual(contract.sideEffects, [], outcome);
    assert.ok(!result.findings.some(item => item.code === 'approval_gap'), outcome);
  }
});

test('detects affirmative external actions and documented inflections', () => {
  const actions = [
    'Sends the report.',
    'Posted the report.',
    'Publishing the report.',
    'Deleted the report.',
    'Pushing the branch.',
    'Merged the branch.',
    'Emailed the report.',
    'Notifying the team.',
    'Uploaded the report.'
  ];

  for (const outcome of actions) {
    const contract = parseTaskBrief(`# External action\n\n## Outcome\n\n${outcome}\n\n## Inputs\n\n- source file\n\n## Verification\n\n- inspect result`);
    assert.deepEqual(contract.sideEffects, [outcome], outcome);
    assert.ok(validateContract(contract).findings.some(item => item.code === 'approval_gap'), outcome);
  }
});

test('retains an affirmative external action alongside a negated action', () => {
  const outcome = 'Do not send the draft, but publish the approved report.';
  const contract = parseTaskBrief(`# Mixed actions\n\n## Outcome\n\n${outcome}\n\n## Inputs\n\n- source file\n\n## Verification\n\n- inspect publication`);

  assert.deepEqual(contract.sideEffects, [outcome]);
  assert.ok(validateContract(contract).findings.some(item => item.code === 'approval_gap'));
});

test('detects affirmative external actions after negated sequence steps', () => {
  const outcomes = [
    'Do not send the draft, then publish the report.',
    'Never upload a draft, subsequently email the final report.'
  ];

  for (const outcome of outcomes) {
    const contract = parseTaskBrief(`# Sequenced actions\n\n## Outcome\n\n${outcome}\n\n## Inputs\n\n- source file\n\n## Verification\n\n- inspect result`);
    const result = validateContract(contract);

    assert.deepEqual(contract.sideEffects, [outcome], outcome);
    assert.ok(result.findings.some(item => item.code === 'approval_gap'), outcome);
  }
});

test('keeps shared-negation conjunctions non-side-effects', () => {
  const outcome = 'Do not send the draft or publish it.';
  const contract = parseTaskBrief(`# Local preparation\n\n## Outcome\n\n${outcome}\n\n## Inputs\n\n- source file\n\n## Verification\n\n- inspect draft`);
  const result = validateContract(contract);

  assert.deepEqual(contract.sideEffects, []);
  assert.ok(!result.findings.some(item => item.code === 'approval_gap'));
});

test('does not match external action names as substrings', () => {
  const outcome = 'Prepare an emailer and a publisher summary.';
  const contract = parseTaskBrief(`# Local tools\n\n## Outcome\n\n${outcome}\n\n## Inputs\n\n- source file\n\n## Verification\n\n- inspect summary`);

  assert.deepEqual(contract.sideEffects, []);
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
