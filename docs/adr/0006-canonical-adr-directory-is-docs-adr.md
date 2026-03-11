# ADR 0006: Canonical ADR Directory Is docs/adr

- Status: Accepted
- Date: 2026-03-12
- Sources: `INITIAL_SPEC.md`, `REMEDIATION_SPEC.md`, `docs/features/mcp-server.md`, `docs/features/mcp-client.md`

## Context

During live MCP validation, ADR behavior was weakened by mixed repository paths:

- `docs/decisions`
- `docs/adrs`
- `docs/adr`

That ambiguity caused the ADR engine and supporting documentation to rely on repo-specific exceptions rather than a clean canonical source of truth. It also made document collections noisier than necessary and increased the risk of drift between runtime defaults, generated content, and actual repository material.

## Decision

For the MímirMesh repository, `docs/adr` is the canonical ADR directory.

This decision applies to:

- hand-authored ADR content
- template-generated decision notes
- config defaults for newly initialized repositories
- repo-local runtime validation and documentation

MímirMesh still tolerates legacy ADR directory patterns when analyzing external repositories, but it no longer uses those legacy locations as the canonical source for this repository.

## Consequences

Positive:

- ADR discovery has one authoritative target on this repo
- generated decision documents and runtime defaults converge on the same path
- MCP documentation and live runtime behavior stay aligned

Tradeoffs:

- legacy ADR content must be migrated into `docs/adr` to avoid split sources of truth
- tests and docs must be updated anywhere they previously assumed `docs/decisions` or `docs/adrs`
