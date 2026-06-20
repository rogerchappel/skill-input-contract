# Skill Input Contract PRD

## Goal

Make implicit task assumptions visible before an agent starts a reusable skill workflow.

## Non-Goals

- No remote service calls
- No live approval collection
- No LLM dependency

## MVP Requirements

- Parse Markdown and JSON task briefs
- Produce deterministic JSON contracts
- Produce readable Markdown summaries
- Flag missing outcomes, missing verification, open questions, and side-effect approval gaps

## Success Metric

A maintainer can run the CLI on a fixture and decide whether the agent has enough input to proceed.
