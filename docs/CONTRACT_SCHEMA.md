# Contract Schema

The JSON report contains two top-level keys: `contract` and `validation`.

JSON input must be an object. Its fields are optional because omitted fields
receive the defaults described below; supplied fields are strictly validated
before normalization:

- `source` (string): input file path or logical source; defaults to the input path
- `title` (string): human-readable task title; defaults to the input filename
- `outcome` (string): requested result; defaults to an empty string
- `inputs` (string[]): required or available inputs; defaults to `[]`
- `constraints` (string[]): operational and safety boundaries; defaults to `[]`
- `requestedActions` (string[]): expected work steps; defaults to `[]`
- `sideEffects` (string[]): requested actions that may affect external systems; defaults to `[]`
- `approvalsRequired` (string[]): approval constraints found in the brief; defaults to `[]`
- `openQuestions` (string[]): unresolved questions found in the brief; defaults to `[]`
- `verification` (string[]): checks expected before completion; defaults to `[]`
- `missing` (string[]): known missing contract details; defaults to `[]`

Wrong field types or non-string collection items are rejected. The CLI writes a
concise field-specific diagnostic to stderr, writes no report, and exits with
status `1`; it does not print a stack trace. A well-formed contract can still
exit with status `2` when semantic validation reports blocking findings.

Validation status is `pass`, `warn`, or `fail`.
