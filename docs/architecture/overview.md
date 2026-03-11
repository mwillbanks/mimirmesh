# MímirMesh Architecture Overview

MímirMesh is implemented as a Bun workspace monorepo with strict separation between runnable apps and shared packages.

- `apps/cli`: user CLI surface
- `apps/server`: unified MCP server
- `apps/client`: MCP client/orchestration binary
- `packages/*`: shared config, runtime, routing, adapters, reports, templates, UI, installer, and testing helpers

The MCP server routes unified tools to adapter contributions, performs parallel fan-out where applicable, normalizes envelopes, deduplicates, ranks, and returns provenance metadata.
