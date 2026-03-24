---
name: mimirmesh-integration-analysis
description: Analyze MímirMesh deployment topology, CI/CD, service boundaries, external dependencies, and rollout impact. Use when the task is primarily about integrations rather than localized code lookup.
metadata:
  bundle: core
  owner: mimirmesh
  role: integration
---

# Mimirmesh Integration Analysis

Use this skill when the question is about how systems connect and what an operational change will affect.

## Default flow

1. Start with `trace_integration`.
2. Use `document_architecture` to retrieve the documented topology, subsystem responsibilities, and existing deployment context.
3. Use `evaluate_codebase` when implementation quality, coupling, or risk affects deployment or rollout confidence.
4. Use `explain_subsystem` when one package or service boundary needs deeper explanation.

## Narrow scope

- Focus on deployment paths, CI/CD flow, runtime boundaries, external systems, and contract impact.
- Prefer subsystem or path scoping when the integration concern is already localized.
- Keep the analysis operational. Do not drift into generic code search when the real question is topology or rollout risk.

## Passthrough escalation

- Use `srclight_get_build_targets` when build graph detail is required and `trace_integration` is too coarse.
- Use ADR deployment passthrough tools only when the routed result leaves a concrete gap in deployment guidance or rollout evidence.
- Replace any retired `mimirmesh.*` passthrough examples with the published `<engine>_<tool>` form before invoking them.
- Escalate to `mimirmesh-architecture-delivery` when the integration change crosses ADR or architecture-doc thresholds.

## Guardrails

- Do not start with code-level search unless the integration result points to a specific implementation hotspot.
- Do not use this skill for ordinary symbol lookup or isolated debugging.
- Do not generate deployment or runbook guidance without grounding it in retrieved architecture and code reality.

## Output expectation

- State the integration topology or boundary that was identified.
- State the affected systems, rollout risks, and validation points.
- State whether architecture or runbook closeout is required.
