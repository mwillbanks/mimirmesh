# MCP Client

This document describes the current client-side behavior for the Srclight-backed MímirMesh runtime.

## Client Role

`mimirmesh-client` is a local stdio MCP client. It:

- resolves how to launch `mimirmesh-server`
- connects over stdio with MCP SDK transports
- lists the server’s transport-safe tool names
- invokes unified or passthrough tools and returns structured output

The CLI command family `mimirmesh mcp ...` shares the same routing and runtime state.
The operator-facing `mimirmesh mcp ...` commands also share the same workflow
renderer as the rest of the CLI: human-readable progress and outcomes by
default, with `--json` reserved for explicit machine consumption.

## Server Resolution

Resolution order:

1. `MIMIRMESH_SERVER_BIN` when it points to an existing binary
2. `<projectRoot>/dist/mimirmesh-server`
3. `bun run apps/server/src/index.ts`

This lets the client work against either the built workspace artifacts or an installed binary.

## Tool Naming

The client accepts canonical names such as:

- `search_code`
- `mimirmesh.srclight.search_symbols`
- `mimirmesh.adr.discover_existing_adrs`

Before transport, it converts `.` and `/` to `_`, so canonical and transport-safe forms both work.

## Unified Tool Behavior

For code-intelligence flows, unified tools should prefer Srclight whenever its live discovery exposes a matching capability.

Relevant unified tools:

- `explain_project`
- `find_tests`
- `inspect_type_hierarchy`
- `inspect_platform_code`
- `list_workspace_projects`
- `refresh_index`
- `find_symbol`
- `search_code`
- `document_architecture`
- `trace_dependency`
- `trace_integration`
- `investigate_issue`
- `evaluate_codebase`
- `runtime_status`

Observed client contract:

- `list-tools` returns transport-safe names only
- `search_code` can be invoked directly from the client without the caller knowing which engine won routing
- `document_architecture` merges ADR architecture analysis with document evidence when both live routes are available
- unified results include provenance so the caller can see which engine executed the request

## Srclight Passthrough Behavior

Srclight passthrough routes appear only when the runtime has discovered them from the live engine.

Representative names:

- `mimirmesh.srclight.codebase_map`
- `mimirmesh.srclight.search_symbols`
- `mimirmesh.srclight.get_symbol`
- `mimirmesh.srclight.get_callers`
- `mimirmesh.srclight.get_tests_for`
- `mimirmesh.srclight.get_type_hierarchy`
- `mimirmesh.srclight.get_platform_variants`
- `mimirmesh.srclight.platform_conditionals`
- `mimirmesh.srclight.hybrid_search`
- `mimirmesh.srclight.index_status`
- `mimirmesh.srclight.list_projects`
- `mimirmesh.srclight.reindex`
- `mimirmesh.srclight.changes_to`
- `mimirmesh.srclight.embedding_status`

The router also normalizes arguments for these tools. For example, search-like tools accept `query` or `max_results`, and symbol tools collapse caller input into the `symbol` field expected by Srclight.

## Runtime-Dependent Results

The client does not fake engine availability.

Expected runtime-sensitive behavior:

- if Docker or Compose is unavailable, `runtime_status` reports failure or degradation with explicit reasons
- if Srclight is healthy and discovered, Srclight passthrough tools appear in `list-tools`
- if `runtime.gpuMode=on` is set on a host without NVIDIA runtime support, startup fails before the client can treat Srclight as available
- if `runtime.gpuMode=auto` runs on a non-GPU host, the client still sees the CPU-backed Srclight service and unified routes
- if Srclight cannot reach Git metadata inside the container, history-aware passthrough tools remain discovered but runtime status and doctor report that `recent_changes`, `whats_changed`, `git_hotspots`, and `blame_symbol` are degraded
- if Srclight is degraded only for embeddings, base code search and symbol queries remain callable while semantic capability warnings surface through runtime state
- if a unified route falls back to another live engine, provenance reflects that actual engine choice

## Retry And Timeout Behavior

The client uses long-running MCP timeouts appropriate for indexing and code search:

- `listTools`: `180s`
- `callTool`: `300s`

Bridge-backed requests reconnect once and retry once on timeout, abort, `502`, and `503`. This prevents a poisoned bridge session from breaking all subsequent client calls while still surfacing persistent failures.

## Related Validation Paths

- `mimirmesh-client list-tools`
- `mimirmesh-client tool search_code '{"query":"export"}'`
- `mimirmesh-client tool mimirmesh.srclight.search_symbols '{"query":"ToolRouter"}'`
- `mimirmesh runtime status`
- `mimirmesh mcp list-tools`
- `mimirmesh mcp tool <tool> '{"key":"value"}' --json`

## Guided Tool Selection

`mimirmesh mcp tool` supports guided tool selection in interactive terminals
when the tool name is omitted. In non-interactive contexts, the CLI does not
attempt to guess the tool name and instead returns a failed workflow outcome
with the required automation-safe invocation.
