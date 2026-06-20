# Orchestration

1. Collect the task brief, relevant files, and declared tool boundaries.
2. Run `skill-input-contract <brief> --format markdown`.
3. Treat `fail` findings as blockers before task execution.
4. Resolve `warn` findings or explicitly carry them into the agent plan.
5. Attach the JSON report to downstream run evidence when useful.

The tool is local-only and should run before any external write action.
