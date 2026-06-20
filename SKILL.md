# Skill Input Contract

Use this skill before a reusable agent workflow begins when the request may hide assumptions about inputs, tools, side effects, or approval needs.

## Required Inputs

- A Markdown or JSON task brief
- Any known tool boundaries or safety constraints
- Expected verification commands or evidence

## Side-Effect Boundaries

The skill is local-only. It may read the provided brief and print JSON or Markdown reports. It must not send messages, mutate external systems, publish content, or approve actions.

## Workflow

1. Run `skill-input-contract <brief> --format markdown`.
2. Resolve blocking findings before starting the downstream skill.
3. Carry warning findings into the agent plan if they cannot be resolved.
4. Save the JSON report as evidence when the run needs an audit trail.

## Examples

```bash
node src/cli.js fixtures/task-brief.md --format markdown
```

## Validation

Run `npm test`, `npm run check`, and `npm run smoke` before packaging or sharing changes.
