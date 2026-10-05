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

The command exits with `1` for unreadable files, invalid JSON, or JSON contract
schema errors. Schema errors identify the invalid field on stderr without a
stack trace or partial report. It exits with `2` when a well-formed contract has
blocking findings, making it suitable for preflight scripts. Exact JSON input
field types and defaults are documented in [the contract schema](docs/CONTRACT_SCHEMA.md).
Guidance and expected parser behavior for GitHub issue templates and pull request
descriptions are in the [adapter guide](docs/ADAPTERS.md).

## Safety Notes

This package reads a local brief and writes the report to stdout by default. The
optional `--output <path>` flag instead writes the report to that local file. It
does not send messages, post content, change repositories, or request approvals
on your behalf; local report creation is its only optional side effect.

Contract validation treats send, publish, upload, and similar actions as external side effects that require an approval requirement. Unqualified `write`, `writes`, `writing`, `wrote`, and `written` actions are treated as potentially durable, while writes explicitly limited to local files, local reports, or stdout are local-only and do not trigger an approval gap. That exemption applies only to the matching write clause: adding a local report to a description does not exempt a separate shared or unqualified write.

Only affirmative requirements satisfy that gate. Constraints such as `approval
is required`, `ask for confirmation`, and `until approval is granted` are
recognized; denials such as `no approval is required`, `approval is not needed`,
or an instruction to act `without approval` leave an approval gap. A prohibition
such as `do not publish without approval` still states an approval requirement.
Approval must control the action before it happens: `publish only after approval`
is valid, while `get approval after publishing` is not. Post-action approval
wording leaves a machine-checkable `approval_gap`, and the CLI exits with `2`.
Approval scope is checked per external action: approval to publish does not also
cover an unrelated deletion in the same brief. A requirement that explicitly
guards `any external side effect` covers the complete action set.
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

Markdown parsing is deterministic and matches section names exactly (case
insensitively): `Outcome`, `Goal`, `Mission`, or `Summary`; `Inputs`, `Context`,
`Required Inputs`, or `Available Context`; `Constraints`, `Limits`,
`Requirements`, or `Safety`; `Actions`, `Tasks`, `Workflow`, `Steps`, or `MVP`;
and `Verification`, `Checks`, `Done`, or `Acceptance Criteria`. Optional closing
ATX hashes are ignored, so `## Inputs ##` is equivalent to `## Inputs`.
Decorated, compound, prefixed, and negated names such as `Inputs (required)`,
`Inputs and constraints`, `Pre-verification`, and `Non-inputs` intentionally do
not route content into contract fields.

Side-effect detection evaluates the requested outcome, action sections, and
constraints that combine an approval guard with an action. Input/context and
verification items describe data and checks, so noun-only values such as
`Email address` do not become requested side effects.

Content inside valid
CommonMark-style backtick or tilde fenced code blocks is treated as an example,
not executable brief content, so it is excluded from item, side-effect, approval,
and open-question extraction. Fences may have info strings and up to three leading
spaces; a closing fence must use the same character and be at least as long as its
opener. LF, CRLF, and CR line endings are accepted equivalently. JSON input is
parsed without Markdown line-ending normalization. For unusual templates, prefer
JSON input or add a fixture before relying on the result.
