---
name: mimirmesh-speckit-delivery
description: Apply MímirMesh's Spec Kit delivery workflow for features and significant changes. Use when work requires a spec, plan, tasks, analysis, and implementation rather than a trivial bounded fix.
compatibility: Requires a MímirMesh repository with `.specify/` and the upstream Spec Kit prompt or command flow available.
metadata:
  bundle: core
  owner: mimirmesh
  role: delivery
---

# Mimirmesh Speckit Delivery

MímirMesh is spec-driven. Use this skill for planned implementation work, not for trivial bounded edits.

## When Spec Kit is required

- New features.
- Cross-cutting changes touching multiple packages or apps.
- Significant refactors.
- API, CLI, MCP, or configuration contract changes.
- Multi-component bug fixes where the defect spans boundaries or changes behavior.

## When full Spec Kit is usually unnecessary

- A tightly bounded fix that stays within an existing pattern.
- A single-file or low-risk edit with no contract, architecture, or documentation fallout.
- Straightforward content-only documentation corrections.

## Repo-native flow

- If `.specify/` is missing or incomplete, initialize it with `mimirmesh speckit init`.
- Use the upstream Spec Kit lifecycle in order: `speckit.specify`, `speckit.plan`, `speckit.tasks`, `speckit.analyze`, `speckit.implement`.
- In this repository, matching prompt files already exist under `.codex/prompts/` and the constitution lives in `.specify/memory/constitution.md`.
- Keep feature artifacts under `docs/specifications/` in the canonical repository structure.

## Before implementation

- Retrieve related specs under `docs/specifications/`.
- Retrieve current architectural context from `docs/adr/`, `document_architecture`, `explain_project`, and `trace_integration` when relevant.
- Use `evaluate_codebase` when risk or subsystem quality affects the plan.
- Ensure the spec, plan, and tasks explicitly cover tests, docs, runtime validation, and CLI UX obligations when those surfaces change.
- When MCP behavior is in scope, ensure the plan and tasks explicitly cover deferred engine visibility, session isolation, MCP-compatible refresh notifications, compressed schema inspection, operator commands, and runtime diagnostics.

## Quality gates

- Do not implement before the plan and tasks are coherent.
- Require `speckit.analyze` or an equivalent review step before implementation for significant or cross-cutting work.
- Ensure closeout includes ADR, docs, and runbook synchronization when the change crosses those thresholds.

## Guardrails

- Do not force a full Spec Kit ceremony onto a trivial bounded fix.
- Do not skip the spec for new feature work or significant cross-boundary changes.
- Do not let the spec drift from the actual implementation.
- Do not treat ADR creation as automatic for every plan; use the architecture-delivery thresholds.

## Output expectation

- State whether the request requires full Spec Kit delivery or a bounded direct change.
- State the next lifecycle step and the artifact it should produce.
- State which architectural or operational closeout artifacts will be required if the change proceeds.
