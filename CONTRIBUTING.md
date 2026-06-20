# Contributing

Keep changes fixture-backed and deterministic. Add or update a fixture for every new parser rule, then run:

```bash
npm run build
```

Avoid network dependencies in tests so the skill remains usable in restricted agent environments.
