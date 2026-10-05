# Issue and pull-request description adapters

The CLI accepts a Markdown document or a JSON contract; adapters are
normalization guidance for common GitHub sources, not separate runtime modes.
Pass the Markdown file directly to `skill-input-contract` after saving it
locally. Parsing remains deterministic and uses the exact section headings
listed in the README. Unrecognized headings do not populate contract fields.

## Issue templates

For a GitHub issue, preserve the issue title as the document title and map
fields as follows:

| Issue content | Contract section |
| --- | --- |
| Problem / requested result | `Outcome` |
| Environment, inputs, links | `Inputs` |
| Scope, permissions, safety boundaries | `Constraints` |
| Requested changes / reproduction steps | `Actions` |
| Definition of done | `Verification` |

Example `issue.md`:

```markdown
# Validate imported issue

## Outcome

Validate a supplied issue report without contacting its author.

## Inputs

- Issue title and body

## Constraints

- Do not send a message to the reporter

## Actions

- Parse the report locally

## Verification

- Check the parsed title and body
```

Expected behavior: `parseTaskBrief` returns the title `Validate imported issue`,
puts `Issue title and body` in `inputs`, and reports no side effects. The
negated message instruction is retained as a constraint, not classified as a
requested action. This adapter does not fetch issue data or interpret GitHub
form metadata; supply the desired fields as ordinary Markdown sections.

## Pull request descriptions

Map the PR title to the document title, summary to `Outcome`, changed areas or
review materials to `Inputs`, safeguards to `Constraints`, implementation
summary to `Actions`, and tests/reviewer checks to `Verification`. State any
external action affirmatively in `Actions` or `Outcome`; a verb in a test
instruction alone is not treated as a requested side effect.

Example `pull-request.md`:

```markdown
# Update parser documentation

## Outcome

Explain how imported pull request descriptions are normalized.

## Inputs

- Parser source and fixtures

## Constraints

- Do not publish a package

## Actions

- Update the adapter guide

## Verification

- Run the documentation fixture test
```

Expected behavior: the document title and sections populate their matching
contract fields, `sideEffects` is empty, and validation does not report an
approval gap. If an actual publication, upload, or other external action is
requested, state the required approval as a constraint; validation checks
approval coverage for detected actions.

## Verify an adapter fixture

From the repository root, run:

```sh
node --input-type=module -e "import fs from 'node:fs'; import assert from 'node:assert/strict'; import {parseTaskBrief, validateContract} from './src/index.js'; for (const file of ['issue.md', 'pull-request.md']) { const c = parseTaskBrief(fs.readFileSync('docs/fixtures/adapters/' + file, 'utf8'), file); assert.equal(c.sideEffects.length, 0); assert.notEqual(validateContract(c).status, 'fail'); }"
```

The fixtures are examples for verifying parser behavior, not templates that
fetch or submit GitHub content.
