# ADR Policy

ADRs are required when a change records or revises an architectural decision rather than a local implementation detail.

## Required

- Runtime or orchestration model changes.
- Unified routed MCP surface changes that alter the operating contract.
- Cross-package behavior, schema, or configuration contract changes.
- Deployment, CI/CD, service-boundary, or external dependency model changes.
- Public CLI or MCP contract changes that affect how operators or agents use the system.

## Optional

- Internal refactors inside an accepted pattern.
- Localized maintenance work that does not change system design.
- Documentation-only clarification.

## Workflow

- Retrieve current architecture context first.
- Confirm whether an existing ADR should be updated instead of creating a new one.
- Use `generate_adr` only after the threshold decision is made.
- Keep ADRs in `docs/adr/`.
