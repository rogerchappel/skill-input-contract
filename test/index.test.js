import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTaskBrief, validateContract, renderMarkdown, scoreContract, toJsonReport } from '../src/index.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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

test('parses Markdown consistently across LF, CRLF, and CR line endings', () => {
  const lf = fs.readFileSync('fixtures/task-brief.md', 'utf8');
  const expected = parseTaskBrief(lf, 'brief.md');

  for (const separator of ['\r\n', '\r']) {
    const variant = lf.replaceAll('\n', separator);
    assert.deepEqual(parseTaskBrief(variant, 'brief.md'), expected);
    assert.equal(validateContract(parseTaskBrief(variant, 'brief.md')).status, 'pass');
  }
});

test('routes only exact canonical section headings and aliases', () => {
  const contract = parseTaskBrief(`# Exact section routing

## Outcome

Validate exact Markdown section routing.

## Non-inputs

- rejected input

## Inputs and constraints

- rejected compound item

## Verification (required)

- rejected decorated check

## Context ##

- accepted input

## Requirements

- accepted constraint

## Tasks

- accepted action

## Acceptance Criteria

- accepted check
`);

  assert.deepEqual(contract.inputs, ['accepted input']);
  assert.deepEqual(contract.constraints, ['accepted constraint']);
  assert.deepEqual(contract.requestedActions, ['accepted action']);
  assert.deepEqual(contract.verification, ['accepted check']);
  assert.equal(validateContract(contract).status, 'pass');
});

test('CLI does not populate contract fields from negative or decorated headings', () => {
  const result = spawnSync(process.execPath, ['src/cli.js', 'fixtures/negative-section-headings.md'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.contract.inputs, ['accepted input']);
  assert.deepEqual(report.contract.constraints, ['accepted constraint']);
  assert.deepEqual(report.contract.requestedActions, ['accepted action']);
  assert.deepEqual(report.contract.verification, ['accepted check']);
});

test('ignores executable-looking content inside CommonMark fenced code blocks', () => {
  const contract = parseTaskBrief(`# Local report

## Outcome

Write a local report.

## Inputs

- Repository path

## Actions

\`\`\`sh
- publish the release
- Should we notify customers?
\`\`\`

~~~text extra
Upload the report.
Who should receive it?
~~~

- Write the report locally

## Verification

- Inspect the local report
`);

  assert.deepEqual(contract.requestedActions, ['Write the report locally']);
  assert.deepEqual(contract.sideEffects, []);
  assert.deepEqual(contract.openQuestions, []);
  assert.equal(validateContract(contract).status, 'pass');
});

test('requires a matching fence character and sufficient closing length', () => {
  const contract = parseTaskBrief(`# Local report

## Outcome

Write a local report.

## Actions

~~~~ example
publish the release
~~~
still fenced?
~~~~~
- Write output locally

## Verification

- Inspect output
`);

  assert.deepEqual(contract.requestedActions, ['Write output locally']);
  assert.deepEqual(contract.sideEffects, []);
  assert.deepEqual(contract.openQuestions, []);
});

test('fails when side effects lack approvals', () => {
  const contract = parseTaskBrief(fs.readFileSync('fixtures/missing-approval.md', 'utf8'), 'fixtures/missing-approval.md');
  const result = validateContract(contract);
  assert.equal(result.status, 'fail');
  assert.ok(contract.sideEffects.some(item => item.includes('Send a notification email')));
  assert.ok(result.findings.some(item => item.code === 'approval_gap'));
});

test('fails when one of several side effects is not covered by approval', () => {
  const contract = parseTaskBrief(`# Mixed actions

## Outcome

Publish a report and remove an obsolete release.

## Inputs

- Release workspace

## Constraints

- Get approval before publishing

## Actions

- Publish the report
- Delete the obsolete release

## Verification

- Confirm the report and release state`, 'mixed.md');

  const result = validateContract(contract);
  assert.equal(result.status, 'fail');
  assert.ok(result.findings.some(item => item.code === 'approval_gap' && item.message.includes('Delete the obsolete release')));
});

test('preserves broad guards and covered single-action approval', () => {
  const broadGuard = parseTaskBrief(`# Guarded actions

## Outcome

Publish a report and delete an obsolete release.

## Inputs

- Release workspace

## Constraints

- Get approval before any external side effect

## Actions

- Publish the report
- Delete the obsolete release

## Verification

- Confirm the final state`, 'guarded.md');
  const singleAction = parseTaskBrief(`# Publish report

## Outcome

Publish the final report.

## Inputs

- Report draft

## Constraints

- Get approval before publishing

## Actions

- Publish the report

## Verification

- Confirm the published report`, 'single.md');

  assert.equal(validateContract(broadGuard).status, 'pass');
  assert.equal(validateContract(singleAction).status, 'pass');
});

test('CLI exits 2 and reports the uncovered mixed-action side effect', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-input-contract-'));
  const brief = path.join(directory, 'mixed.md');
  fs.writeFileSync(brief, `# Mixed actions

## Outcome

Publish a report and delete an obsolete release.

## Inputs

- Release workspace

## Constraints

- Get approval before publishing

## Actions

- Publish the report
- Delete the obsolete release

## Verification

- Confirm the final state\n`);

  try {
    const result = spawnSync(process.execPath, ['src/cli.js', brief, '--format', 'json'], { encoding: 'utf8' });
    assert.equal(result.status, 2);
    const report = JSON.parse(result.stdout);
    assert.ok(report.validation.findings.some(item => item.code === 'approval_gap' && item.message.includes('Delete the obsolete release')));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('does not treat denied approval language as a requirement', () => {
  const constraints = [
    'No approval is required',
    'Publish without approval',
    'Approval is not required'
  ];

  for (const constraint of constraints) {
    const contract = parseTaskBrief(`# Publish report\n\n## Outcome\n\nPublish the report.\n\n## Inputs\n\n- report\n\n## Constraints\n\n- ${constraint}\n\n## Verification\n\n- inspect publication`);
    const result = validateContract(contract);

    assert.deepEqual(contract.approvalsRequired, [], constraint);
    assert.equal(result.status, 'fail', constraint);
    assert.ok(result.findings.some(item => item.code === 'approval_gap'), constraint);
  }
});

test('extracts affirmative approval and confirmation requirements', () => {
  const constraints = [
    'Approval is required before publishing',
    'Ask for confirmation before publishing',
    'Local-only until approval is granted',
    'Do not publish without approval'
  ];

  for (const constraint of constraints) {
    const contract = parseTaskBrief(`# Publish report\n\n## Outcome\n\nPublish the report.\n\n## Inputs\n\n- report\n\n## Constraints\n\n- ${constraint}\n\n## Verification\n\n- inspect publication`);

    assert.deepEqual(contract.approvalsRequired, [constraint], constraint);
    assert.equal(validateContract(contract).status, 'pass', constraint);
  }
});

test('rejects explicitly post-action approval requirements', () => {
  const constraints = [
    'Get approval after publishing the report',
    'Ask for confirmation once the email is sent',
    'Write the audit record before requesting permission'
  ];

  for (const constraint of constraints) {
    const contract = parseTaskBrief(`# External action\n\n## Outcome\n\nPublish and write the report.\n\n## Inputs\n\n- report\n\n## Constraints\n\n- ${constraint}\n\n## Verification\n\n- inspect result`);
    const result = validateContract(contract);

    assert.deepEqual(contract.approvalsRequired, [], constraint);
    assert.equal(result.status, 'fail', constraint);
    assert.ok(result.findings.some(item => item.code === 'approval_gap'), constraint);
  }
});

test('retains approval-before and approval-until guards', () => {
  const constraints = [
    'After approval is granted, publish the report',
    'Publish the report only after confirmation',
    'Do not write the audit record until permission is granted'
  ];

  for (const constraint of constraints) {
    const contract = parseTaskBrief(`# External action\n\n## Outcome\n\nPublish the report.\n\n## Inputs\n\n- report\n\n## Constraints\n\n- ${constraint}\n\n## Verification\n\n- inspect result`);

    assert.deepEqual(contract.approvalsRequired, [constraint], constraint);
    assert.ok(!validateContract(contract).findings.some(item => item.code === 'approval_gap'), constraint);
  }
});

test('rejects a mixed constraint whose approval prerequisite is post-action', () => {
  const constraint = 'Prepare locally, publish the report, and request approval after publishing';
  const contract = parseTaskBrief(`# Publish report\n\n## Outcome\n\nPublish the report.\n\n## Inputs\n\n- report\n\n## Constraints\n\n- ${constraint}\n\n## Verification\n\n- inspect publication`);

  assert.deepEqual(contract.approvalsRequired, []);
  assert.ok(validateContract(contract).findings.some(item => item.code === 'approval_gap'));
});

test('keeps approval guards separate from requested side effects', () => {
  const contract = parseTaskBrief(fs.readFileSync('fixtures/approval-guard.md', 'utf8'), 'fixtures/approval-guard.md');

  assert.deepEqual(contract.sideEffects, []);
  assert.deepEqual(contract.approvalsRequired, [
    'Ask for confirmation before publishing the draft',
    'Approval is required before emailing the report'
  ]);
  assert.equal(validateContract(contract).status, 'pass');
});

test('retains requested actions alongside approval guards', () => {
  const contract = parseTaskBrief(fs.readFileSync('fixtures/approval-guard-mixed.md', 'utf8'), 'fixtures/approval-guard-mixed.md');

  assert.deepEqual(contract.sideEffects, [
    'Ask for confirmation before publishing the draft, then send the approved report'
  ]);
  assert.deepEqual(contract.approvalsRequired, [
    'Ask for confirmation before publishing the draft, then send the approved report'
  ]);
  assert.equal(validateContract(contract).status, 'pass');
});

test('CLI renders guard-only constraints as approval requirements, not side effects', () => {
  const result = spawnSync(process.execPath, ['src/cli.js', 'fixtures/approval-guard.md', '--format', 'markdown'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /## Side Effects\n\n- None listed/);
  assert.match(result.stdout, /## Approval Requirements\n\n- Ask for confirmation before publishing the draft/);
});

test('CLI makes post-action approval gaps machine-checkable', () => {
  const result = spawnSync(process.execPath, ['src/cli.js', 'fixtures/post-action-approval.md'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.contract.approvalsRequired, []);
  assert.ok(report.validation.findings.some(item => item.code === 'approval_gap'));
});

test('allows explicitly local report writes without an approval requirement', () => {
  const contract = parseTaskBrief('# Local report\n\n## Outcome\n\nWrite a report locally.\n\n## Inputs\n\n- source file\n\n## Constraints\n\n- Do not access external systems\n\n## Verification\n\n- inspect report');
  const result = validateContract(contract);

  assert.deepEqual(contract.sideEffects, []);
  assert.equal(result.status, 'pass');
  assert.ok(!result.findings.some(item => item.code === 'approval_gap'));
});

test('does not let a local write exempt a separate durable write', () => {
  const outcomes = [
    'Write a local report, then write a shared artifact.',
    'Write a local file and write release notes.',
    'Write to stdout; write a summary.'
  ];

  for (const outcome of outcomes) {
    const contract = parseTaskBrief(`# Mixed writes\n\n## Outcome\n\n${outcome}\n\n## Inputs\n\n- source file\n\n## Verification\n\n- inspect outputs`);
    const result = validateContract(contract);

    assert.deepEqual(contract.sideEffects, [outcome], outcome);
    assert.ok(result.findings.some(item => item.code === 'approval_gap'), outcome);
  }
});

test('still classifies unqualified durable writes as side effects', () => {
  const contract = parseTaskBrief('# Persist report\n\n## Outcome\n\nWrite a report.\n\n## Inputs\n\n- source file\n\n## Verification\n\n- inspect report');
  const result = validateContract(contract);

  assert.deepEqual(contract.sideEffects, ['Write a report.']);
  assert.ok(result.findings.some(item => item.code === 'approval_gap'));
});

test('classifies common durable-write inflections as whole-word side effects', () => {
  const outcomes = [
    'Write a report.',
    'Writes a report.',
    'Writing a report.',
    'Wrote a report.',
    'Written a report.'
  ];

  for (const outcome of outcomes) {
    const contract = parseTaskBrief(`# Persist report\n\n## Outcome\n\n${outcome}\n\n## Inputs\n\n- source file\n\n## Verification\n\n- inspect report`);

    assert.deepEqual(contract.sideEffects, [outcome], outcome);
    assert.ok(validateContract(contract).findings.some(item => item.code === 'approval_gap'), outcome);
  }
});

test('keeps local-only and negated durable-write inflections out of side effects', () => {
  const outcomes = [
    'Writes a local report.',
    'Writing to stdout.',
    'Wrote the output locally.',
    'Never written the report.',
    'Do not write the report.',
    'Did not write the report.'
  ];

  for (const outcome of outcomes) {
    const contract = parseTaskBrief(`# Local report\n\n## Outcome\n\n${outcome}\n\n## Inputs\n\n- source file\n\n## Verification\n\n- inspect report`);

    assert.deepEqual(contract.sideEffects, [], outcome);
    assert.ok(!validateContract(contract).findings.some(item => item.code === 'approval_gap'), outcome);
  }
});

test('retains an affirmative durable write alongside a negated write', () => {
  const outcome = 'Do not write the draft, but write the final report.';
  const contract = parseTaskBrief(`# Persist final report\n\n## Outcome\n\n${outcome}\n\n## Inputs\n\n- source file\n\n## Verification\n\n- inspect report`);

  assert.deepEqual(contract.sideEffects, [outcome]);
  assert.ok(validateContract(contract).findings.some(item => item.code === 'approval_gap'));
});

test('does not match durable-write names as substrings', () => {
  const outcome = 'Configure a typewriter and ghostwriter.';
  const contract = parseTaskBrief(`# Local tools\n\n## Outcome\n\n${outcome}\n\n## Inputs\n\n- source file\n\n## Verification\n\n- inspect configuration`);

  assert.deepEqual(contract.sideEffects, []);
});

test('CLI rejects durable-write inflections without approval', () => {
  const result = spawnSync(process.execPath, ['src/cli.js', 'fixtures/durable-write-inflections.md'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.contract.sideEffects, [
    'Writes the summary.',
    'Writing the audit record.',
    'Wrote the manifest.',
    'Written the release notes.'
  ]);
  assert.ok(report.validation.findings.some(item => item.code === 'approval_gap'));
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

test('scopes a leading participial negation before an affirmative action', () => {
  const outcome = 'Without uploading the draft, publish the final report.';
  const contract = parseTaskBrief(`# Publish final report\n\n## Outcome\n\n${outcome}\n\n## Inputs\n\n- final report\n\n## Verification\n\n- inspect publication`);
  const result = validateContract(contract);

  assert.deepEqual(contract.sideEffects, [outcome]);
  assert.equal(result.status, 'fail');
  assert.ok(result.findings.some(item => item.code === 'approval_gap'));
});

test('CLI rejects an affirmative action after a leading participial negation', () => {
  const result = spawnSync(process.execPath, ['src/cli.js', 'fixtures/participial-negation.md'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.contract.sideEffects, ['Without uploading the draft, publish the final report.']);
  assert.ok(report.validation.findings.some(item => item.code === 'approval_gap'));
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

test('parses a valid JSON contract and defaults omitted fields', () => {
  const contract = parseTaskBrief(JSON.stringify({
    title: 'JSON brief',
    outcome: 'Validate the supplied task brief.',
    inputs: ['brief.json'],
    verification: ['Run the release checks']
  }), 'brief.json');

  assert.equal(contract.source, 'brief.json');
  assert.deepEqual(contract.constraints, []);
  assert.deepEqual(contract.missing, []);
  assert.equal(validateContract(contract).status, 'pass');
});

test('preserves escaped carriage returns in JSON string values', () => {
  const contract = parseTaskBrief(JSON.stringify({
    title: 'JSON brief',
    outcome: 'Validate\rthe supplied task brief.'
  }), 'brief.json');

  assert.equal(contract.outcome, 'Validate\rthe supplied task brief.');
});

test('rejects non-object JSON contracts', () => {
  for (const value of [null, [], 'brief', 42, true]) {
    assert.throws(() => parseTaskBrief(JSON.stringify(value), 'brief.json'), /Invalid JSON contract: expected an object/);
  }
});

test('rejects wrong JSON scalar field types', () => {
  for (const field of ['source', 'title', 'outcome']) {
    assert.throws(
      () => parseTaskBrief(JSON.stringify({ [field]: 42 }), 'brief.json'),
      error => error.message === `Invalid JSON contract field "${field}": expected a string`
    );
  }
});

test('rejects wrong JSON collection types and items', () => {
  const fields = ['inputs', 'constraints', 'requestedActions', 'sideEffects', 'approvalsRequired', 'openQuestions', 'verification', 'missing'];
  for (const field of fields) {
    assert.throws(
      () => parseTaskBrief(JSON.stringify({ [field]: 'not-an-array' }), 'brief.json'),
      error => error.message === `Invalid JSON contract field "${field}": expected an array of strings`
    );
    assert.throws(
      () => parseTaskBrief(JSON.stringify({ [field]: ['valid', 42] }), 'brief.json'),
      error => error.message === `Invalid JSON contract field "${field}[1]": expected a string`
    );
  }
});

test('CLI reports malformed JSON contracts without a stack trace', () => {
  const result = spawnSync(process.execPath, ['src/cli.js', 'fixtures/invalid-contract.json'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'skill-input-contract: Invalid JSON contract field "inputs": expected an array of strings\n');
  assert.doesNotMatch(result.stderr, /(?:\s+at\s|TypeError)/);
});

test('CLI renders the valid JSON fixture in both report formats', () => {
  for (const format of ['json', 'markdown']) {
    const result = spawnSync(process.execPath, ['src/cli.js', 'fixtures/contract.json', '--format', format], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, `${format}: ${result.stderr}`);
    assert.match(result.stdout, format === 'json' ? /"score": 100/ : /# Validate release notes/);
  }
});
