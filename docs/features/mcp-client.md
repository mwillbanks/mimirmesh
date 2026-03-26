# MCP Client

This document describes the current client-side behavior for the Srclight-backed MímirMesh runtime.
Srclight is the only active code-intelligence engine; `codebase-memory-mcp` is retired and no longer appears in config, discovery, or routing.

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

The MCP client and CLI now use a session-scoped tool-surface policy. A fresh
session starts with unified tools plus the deferred-management tools:

- `load_deferred_tools`
- `refresh_tool_surface`
- `inspect_tool_schema`

## Server Resolution

Resolution order:

1. `MIMIRMESH_SERVER_BIN` when it points to an existing binary
2. `<projectRoot>/dist/mimirmesh-server`
3. `bun run apps/server/src/index.ts`

This lets the client work against either the built workspace artifacts or an installed binary.

## Tool Naming

The client accepts canonical names such as:

- `search_code`
- `srclight_search_symbols`
- `adr_discover_existing_adrs`

Before transport, it converts `.` and `/` to `_`, so unified names and published passthrough names flow through the same stdio MCP surface.

If a caller uses a retired `mimirmesh`-prefixed passthrough alias such as `mimirmesh.srclight.search_symbols`, the client receives an explicit replacement error naming the published engine-native tool.

Deferred engine groups are not listed as passthrough tools until the active
session loads them. The CLI surfaces the current session state through:

- `mimirmesh mcp list-tools`
- `mimirmesh mcp load-tools <engine>`
- `mimirmesh mcp tool-schema <tool> --view compressed|full|debug`

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

- `list-tools` returns transport-safe names only and distinguishes core vs loaded tools in machine-readable output
- `search_code` can be invoked directly from the client without the caller knowing which engine won routing
- `document_architecture` merges ADR architecture analysis with document evidence when both live routes are available
- unified results include provenance so the caller can see which engine executed the request
- `inspect_tool_schema` returns compressed or fuller per-tool schema detail without a custom MCP protocol

## Srclight Passthrough Behavior

Srclight passthrough routes appear only when the runtime has discovered them from the live engine,
and they become visible to a session only after that session loads the deferred `srclight` group.

Representative names:

- `srclight_codebase_map`
- `srclight_search_symbols`
- `srclight_get_symbol`
- `srclight_get_callers`
- `srclight_get_tests_for`
- `srclight_get_type_hierarchy`
- `srclight_get_platform_variants`
- `srclight_platform_conditionals`
- `srclight_hybrid_search`
- `srclight_index_status`
- `srclight_list_projects`
- `srclight_reindex`
- `srclight_changes_to`
- `srclight_embedding_status`

The router also normalizes arguments for these tools. For example, search-like tools accept `query` or `max_results`, and symbol tools collapse caller input into the `symbol` field expected by Srclight.

## Runtime-Dependent Results

The client does not fake engine availability.

Expected runtime-sensitive behavior:

- if Docker or Compose is unavailable, `runtime_status` reports failure or degradation with explicit reasons
- if Srclight is healthy and discovered, `mimirmesh mcp load-tools srclight` can expose Srclight passthrough tools for the current session
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
- `mimirmesh-client tool load_deferred_tools '{"engine":"srclight"}'`
- `mimirmesh-client tool inspect_tool_schema '{"toolName":"search_code","view":"full"}'`
- `mimirmesh-client tool srclight_search_symbols '{"query":"ToolRouter"}'`
- `mimirmesh-client tool mimirmesh.srclight.search_symbols '{"query":"ToolRouter"}'`
- `mimirmesh runtime status`
- `mimirmesh mcp list-tools`
- `mimirmesh mcp load-tools srclight`
- `mimirmesh mcp tool-schema search_code --view full`
- `mimirmesh mcp tool <tool> '{"key":"value"}' --json`

## Guided Tool Selection

`mimirmesh mcp tool` supports guided tool selection in interactive terminals
when the tool name is omitted. In non-interactive contexts, the CLI does not
attempt to guess the tool name and instead returns a failed workflow outcome
with the required automation-safe invocation.
