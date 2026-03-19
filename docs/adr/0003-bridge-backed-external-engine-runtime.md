# ADR 0003: Bridge-Backed External Engine Runtime

- Status: Accepted
- Date: 2026-03-12
- Sources: `AGENTS.md`, `docs/features/mcp-server.md`, `docs/features/mcp-client.md`, `docs/features/runtime-upgrade.md`

## Context

The external engines integrated by MímirMesh do not share a single runtime model. They include Node-based MCP servers, Python workloads launched with `uv`, and binary-backed servers. Most of them expose stdio-oriented MCP behavior rather than an HTTP control surface that MímirMesh can query uniformly for health, discovery, and tool invocation.

The remediation specification requires real runnable services, truthful readiness, dynamic tool discovery, and required bootstrap/index execution for engines such as `srclight`.

## Decision

MímirMesh runs each external engine in its own container and places a bridge process in front of the upstream MCP workload.

The bridge is responsible for:

- owning the upstream child process lifecycle
- reporting health and readiness
- exposing a consistent transport for discovery and tool invocation
- capturing failure states and making reconnect/retry behavior possible
- allowing runtime orchestration to gate readiness on discovery and bootstrap completion

The initial engine set is:

- `mm-srclight`
- `mm-document-mcp`
- `mm-adr-analysis`
- supporting runtime dependencies such as `mm-postgres` where required

## Consequences

Positive:

- heterogeneous engines can be managed through one operational model
- runtime health, discovery, and bootstrap state become explicit and inspectable
- per-engine failures degrade cleanly instead of hiding behind fake healthy containers

Tradeoffs:

- each engine needs a real Dockerfile and explicit config translation
- container logs and bridge diagnostics must be maintained as first-class runtime artifacts
