# Contract Schema

The JSON report contains two top-level keys: `contract` and `validation`.

Required contract fields:

- `source`: input file path or logical source
- `title`: human-readable task title
- `outcome`: requested result
- `inputs`: required or available inputs
- `constraints`: operational and safety boundaries
- `requestedActions`: expected work steps
- `sideEffects`: requested actions that may affect external systems
- `approvalsRequired`: approval constraints found in the brief; a guard is not
  itself a requested side effect
- `openQuestions`: unresolved questions found in the brief
- `verification`: checks expected before completion

Validation status is `pass`, `warn`, or `fail`.
