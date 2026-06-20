# Contract Schema

The JSON report contains two top-level keys: `contract` and `validation`.

Required contract fields:

- `source`: input file path or logical source
- `title`: human-readable task title
- `outcome`: requested result
- `inputs`: required or available inputs
- `constraints`: operational and safety boundaries
- `requestedActions`: expected work steps
- `sideEffects`: actions that may affect external systems
- `approvalsRequired`: approval constraints found in the brief
- `openQuestions`: unresolved questions found in the brief
- `verification`: checks expected before completion

Validation status is `pass`, `warn`, or `fail`.
