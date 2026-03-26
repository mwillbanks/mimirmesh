---
name: mimirmesh-agent-router
description: Classify ambiguous MímirMesh engineering requests into the cheapest sufficient workflow. Use when the user has not clearly said whether they need code navigation, issue investigation, Spec Kit delivery, architecture delivery, or integration analysis.
metadata:
  bundle: core
  owner: mimirmesh
  role: router
---

# Mimirmesh Agent Router

Use this as the default entry skill for broad or ambiguous engineering requests in a MímirMesh repository.

## Routing rule

- Prefer unified routed MCP tools before passthrough tools.
- Prefer the cheapest sufficient retrieval step before broad analysis or generation.
- Prefer evidence collection before systemic diagnosis.
- Prefer retrieving existing docs and ADR context before generating new architecture artifacts.

## Workflow selection

- Route to `mimirmesh-code-navigation` for symbol lookup, implementation lookup, usages, tests, or "where is X?"
- Route to `mimirmesh-code-investigation` for bugs, regressions, broken behavior, failures, RCA, or suspicious changes.
- Route to `mimirmesh-speckit-delivery` for new features, cross-cutting changes, significant refactors, API changes, or multi-component fixes.
- Route to `mimirmesh-architecture-delivery` for subsystem design, architecture changes, ADR-worthy work, architecture docs, or runbook closeout.
- Route to `mimirmesh-integration-analysis` for deployments, CI/CD, service boundaries, external contracts, rollout impact, or system topology.
- Route questions about MCP tool-surface shape, deferred engine groups, session-scoped visibility, or schema-compression behavior to `mimirmesh-architecture-delivery` unless the request is a localized bug, in which case use `mimirmesh-code-investigation`.

## Cheapest sufficient sequence

1. If the request names a symbol, type, API, command, or file-level concern, start with `find_symbol` or `search_code`.
2. If the request is a failure or regression, start with `investigate_issue`.
3. If the request is about repository-wide structure or boundaries, start with `explain_project`.
4. If the request is about deployment, runtime wiring, or external systems, start with `trace_integration`.
5. If the request is about architecture intent or existing design documentation, start with `document_architecture` after retrieving repo context.

## Escalation thresholds

- Stop after one or two precise routed calls when the answer is already localized.
- Escalate from lookup to dependency tracing only when callers, callees, or blast radius matter.
- Escalate from localized evidence to `evaluate_codebase` only when the problem appears systemic, architectural, or repeated across subsystems.
- Escalate to passthrough history tools only when the routed result proves you need blame, change history, or engine-specific detail.
- Escalate to ADR generation only after retrieving existing architecture context and confirming the change crosses an ADR threshold.

## Guardrails

- Do not start with `evaluate_codebase` for simple lookup or single-bug localization.
- Do not jump to passthrough tools when a routed tool already covers the question.
- Do not generate architecture docs or ADRs without checking existing docs, ADRs, and code reality first.
- Do not route trivial bounded fixes into a full Spec Kit delivery flow.

## Output expectation

- State the selected workflow.
- State the first routed tool to call and why it is the cheapest sufficient step.
- State the next escalation step only if the first result is likely insufficient.
