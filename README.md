# skill-input-contract

Generate a local, machine-checkable input contract before an agent starts work.

## Quickstart

```bash
npm install
npm run smoke
node src/cli.js fixtures/task-brief.md --format json
```

## Release Verification

Run the full release gate before tagging or publishing:

```bash
npm run release:check
```

The release gate runs syntax checks, tests, the fixture-backed CLI smoke, and a dry-run `npm pack` so shipped files can be reviewed before publication.

## CLI

```bash
skill-input-contract <brief.md|brief.json> [--format json|markdown] [--output <path>]
```

Options may appear before or after the input file. Supported formats are `json`
(the default) and `markdown`; invalid formats and missing option values exit with
a usage error. Each option may be supplied only once; duplicates are rejected
before the input is read or an output file is written.

The command exits with `2` when the contract has blocking findings, making it suitable for preflight scripts.

## Safety Notes

This package reads a local brief and writes the report to stdout by default. The
optional `--output <path>` flag instead writes the report to that local file. It
does not send messages, post content, change repositories, or request approvals
on your behalf; local report creation is its only optional side effect.

Contract validation treats send, publish, upload, and similar actions as external side effects that require an approval requirement. Unqualified `write`, `writes`, `writing`, `wrote`, and `written` actions are treated as potentially durable, while writes explicitly limited to local files, local reports, or stdout are local-only and do not trigger an approval gap.

Only affirmative requirements satisfy that gate. Constraints such as `approval
is required`, `ask for confirmation`, and `until approval is granted` are
recognized; denials such as `no approval is required`, `approval is not needed`,
or an instruction to act `without approval` leave an approval gap. A prohibition
such as `do not publish without approval` still states an approval requirement.
Approval guards such as `ask for confirmation before publishing` describe when
an action would be allowed, not a request to perform it, so they appear only in
`approvalsRequired`. If the same item separately requests an action—for example,
`ask for confirmation before publishing, then send the approved report`—the item
also appears in `sideEffects`.

Explicitly prohibited actions are not side effects: for example, `do not send`,
`never publish`, and `without uploading` describe boundaries rather than requested
external work. Negation applies within its clause; if the same item also contains
an affirmative action after `but`, `however`, or `yet`, or after a comma-delimited
`then` or `subsequently` transition, that action is still reported and requires
approval. A leading `without` participial clause also ends at its comma, so
`Without uploading the draft, publish the final report` still reports the
publication. Coordinated actions without a new clause retain their shared
negation, so `Do not send the draft or publish it` remains a boundary rather than
a side effect. Common tense and participle forms are recognized as whole words, so
`uploaded` and `written` are detected while names such as `uploader` and
`ghostwriter` are not.

## Limitations

Markdown parsing is deterministic and section-name based. For unusual templates, prefer JSON input or add a fixture before relying on the result.
