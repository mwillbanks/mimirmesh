# ADR 0005: Spec Kit Governs Delivery Workflow

- Status: Accepted
- Date: 2026-03-12
- Sources: `AGENTS.md`, `docs/specifications/README.md`, `README.md`

## Context

MímirMesh provides repository intelligence, reports, document scaffolding, and agent-facing workflows. Without a clear boundary, that could drift into an ad hoc planning system that conflicts with the repository’s intended delivery discipline.

Both the implementation specification and the repository instructions require spec-driven development through Spec Kit.

## Decision

Spec Kit is the governing workflow for delivery work in this repository.

MímirMesh may:

- detect whether Spec Kit is initialized
- assist with `speckit init`, status, and doctor flows
- surface Spec Kit status in reports and agent-facing tooling

MímirMesh may not:

- invent a competing task/spec management system
- treat generated docs or notes as substitutes for an accepted specification

## Consequences

Positive:

- implementation work remains governed by explicit specifications
- MímirMesh stays focused on project intelligence and orchestration rather than replacing delivery process
- docs and runbooks can support Spec Kit without fragmenting workflow ownership

Tradeoffs:

- feature work requires an accepted spec before implementation
- agent workflows must respect repository process even when implementation shortcuts would be faster
