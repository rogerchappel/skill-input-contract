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
skill-input-contract <brief.md|brief.json> [--format json|markdown]
```

The command exits with `2` when the contract has blocking findings, making it suitable for preflight scripts.

## Safety Notes

This package reads local files and writes reports to stdout only. It does not send messages, post content, change repositories, or request approvals on your behalf.

## Limitations

Markdown parsing is deterministic and section-name based. For unusual templates, prefer JSON input or add a fixture before relying on the result.
