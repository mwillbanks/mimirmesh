---
name: mimirmesh-architecture-delivery
description: Drive MímirMesh architecture work, ADR creation, architecture documentation, and closeout. Use when a change affects subsystem design, cross-package contracts, operational runbooks, or documented architectural decisions.
metadata:
  bundle: core
  owner: mimirmesh
  role: architecture
---

# Mimirmesh Architecture Delivery

This skill owns architecture planning, ADR thresholds, architecture documentation, and architecture closeout.

## Default flow

1. Start with `explain_project` or `explain_subsystem` to establish the current repository and subsystem boundaries.
2. Retrieve existing design context with `document_architecture`.
3. Use `evaluate_codebase` to assess maintainability, design risk, or architectural debt when that affects the proposed change.
4. Use `trace_integration` if the change touches runtime wiring, deployment, service boundaries, CI/CD, or external contracts.
5. Use `generate_adr` only after retrieval shows the change crosses an ADR threshold.
6. Update architecture docs, feature docs, and runbooks only after the code and decision context are real.

## ADR required threshold

- Runtime or orchestration model changes.
- Unified routed tool surface or adapter contract changes.
- Cross-package configuration, schema, or behavior contracts.
- Deployment, CI/CD, service-boundary, or external-integration model changes.
- Public CLI or MCP behavior changes that alter the documented operating model.

## ADR optional threshold

- Internal refactors that preserve the existing architecture and operator-facing behavior.
- Localized implementation cleanup inside an accepted pattern.
- Documentation-only clarification with no architectural change.

## Documentation and runbook closeout

- Update `docs/architecture/` or `docs/features/` when the subsystem design or user/operator understanding changes.
- Update `docs/runbooks/` when operational steps, rollout checks, recovery procedures, or troubleshooting change.
- Keep docs tied to real code, real runtime behavior, and accepted decisions. Do not generate prose blindly.

## Guardrails

- Retrieve existing architectural context before generating new ADRs or architecture docs.
- Do not treat `generate_adr` as a substitute for design retrieval and judgment.
- Do not update runbooks unless the operator procedure actually changed.
- Do not duplicate ADR policy prose across specs or feature docs when a single ADR or doc update is the right source of truth.

## Output expectation

- State the current architectural context that was retrieved.
- State whether an ADR is required, optional, or unnecessary.
- State which docs and runbooks must change as part of closeout.
