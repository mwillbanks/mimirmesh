# ADR 0001: Adapter-Driven Unified MCP Routing

- Status: Accepted
- Date: 2026-03-12
- Sources: `INITIAL_SPEC.md`, `REMEDIATION_SPEC.md`, `docs/features/mcp-server.md`, `docs/features/mcp-client.md`

## Context

MímirMesh must expose a single MCP surface while integrating multiple engines with materially different capabilities, runtime contracts, and tool schemas. The initial production specification requires both unified tools and passthrough tools. The remediation specification further requires that passthrough registration come from live discovery rather than hard-coded registries.

This creates two constraints:

1. engine-specific behavior must stay encapsulated inside adapters
2. unified tools must route from discovered capability, not static assumptions

## Decision

MímirMesh exposes one unified MCP server that is built on the official Model Context Protocol TypeScript SDK and organized around adapter contributions.

The routing model is:

- adapters own engine-specific config translation, discovery, health, bootstrap, normalization, and routing contributions
- passthrough tools are registered from live discovery results captured from healthy engines
- unified tools resolve through policy-based routing over discovered capability
- fan-out calls execute in parallel where safe, then normalize, deduplicate, rank, and attach provenance metadata
- transport-restricted clients receive normalized tool aliases, while canonical dotted names remain the internal source of truth

## Consequences

Positive:

- engine-specific assumptions stay inside the adapter layer
- passthrough behavior remains truthful to what live engines actually expose
- unified tools can evolve without coupling to one engine implementation
- degraded engines can be excluded from routing without collapsing the entire MCP surface

Tradeoffs:

- runtime discovery and routing-table persistence become mandatory parts of readiness
- adapter contracts must remain disciplined so routing policy does not leak into unrelated layers
