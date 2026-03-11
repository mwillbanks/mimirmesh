# MCP Server

This document describes the current Srclight-backed MCP server behavior that MímirMesh validates through runtime state, integration tests, and workflow smoke tests.

## Server Role

`mimirmesh-server` is the stdio MCP surface for the project-local runtime. It:

- registers the unified MímirMesh tools
- adds passthrough tools from live engine discovery only
- serves transport-safe MCP tool names while preserving canonical internal names
- executes unified and passthrough calls through the same routing table used by the CLI

The server does not embed engine logic. It reads `.mimirmesh/config.yml`, loads `.mimirmesh/runtime/routing-table.json`, and exposes whatever the live runtime has actually discovered.

## Tool Naming

Internal tool names remain canonical, for example `mimirmesh.srclight.search_symbols`.

The stdio MCP surface publishes transport-safe aliases such as `mimirmesh_srclight_search_symbols` because some clients reject dotted names. `mimirmesh-client` and the CLI map between the two forms automatically.

## Runtime Preconditions

The server is useful only after the project runtime has been rendered and discovery has executed.

Required runtime artifacts:

- `.mimirmesh/runtime/docker-compose.yml`
- `.mimirmesh/runtime/connection.json`
- `.mimirmesh/runtime/health.json`
- `.mimirmesh/runtime/routing-table.json`
- `.mimirmesh/runtime/bootstrap-state.json`
- `.mimirmesh/runtime/engines/srclight.json`

If Docker or Compose is unavailable, the server still starts, but runtime-backed tools reflect that failed or degraded state instead of inventing readiness.

## Srclight Runtime Path

Srclight is the preferred code-intelligence engine when its capabilities are discovered.

Observed runtime contract:

- service name: `mm-srclight`
- bridge transport: `sse`
- engine namespace: `mimirmesh.srclight.*`
- repo mounted at `/workspace`
- Git-backed repository history requires the container image to include `git` and the mounted repository metadata to be visible at `/workspace/.git`
- native index state kept in the repository-local `.srclight/` directory
- bootstrap state recorded in `.mimirmesh/runtime/bootstrap-state.json`

When Srclight is configured for base search only, no hosted API key is required. Optional embedding support is enabled only when both an embedding model and an Ollama base URL are configured.

## Bootstrap And Readiness

MímirMesh records Srclight bootstrap as runtime evidence rather than assuming the engine is ready.

Behavior:

- the preferred bootstrap path is native `srclight index /workspace`
- bootstrap mode is persisted on the engine state and bootstrap state files
- readiness is derived from live bridge health, discovery, and bootstrap outcome
- repo-local evidence such as `.srclight/index.db` and embedding artifacts is captured in the Srclight engine state
- Git capability evidence records whether `git` is installed in the container and whether the mounted repository is a valid work tree inside `/workspace`

If Srclight starts but an optional embedding configuration is incomplete or unavailable, MímirMesh preserves base code-intelligence behavior and records capability degradation instead of marking the entire runtime healthy by fiction or dead by overreaction.

## Unified Routing

When Srclight exposes matching tools, unified code-intelligence routes prefer it over lower-priority fallbacks.

Validated route classes:

- `explain_project`
- `find_symbol`
- `search_code`
- `trace_dependency`
- `trace_integration`
- `investigate_issue`
- `evaluate_codebase`

The routing table remains discovery-backed. If a required Srclight capability is not discovered, the server uses whatever lower-priority live route still matches the unified tool.

## Passthrough Exposure

Srclight passthrough tools are never registered from a static catalog. They appear only when the bridge discovers them from the running engine.

Representative passthrough tools validated in tests and routing rules:

- `mimirmesh.srclight.codebase_map`
- `mimirmesh.srclight.search_symbols`
- `mimirmesh.srclight.get_symbol`
- `mimirmesh.srclight.get_callers`
- `mimirmesh.srclight.hybrid_search`
- `mimirmesh.srclight.index_status`

## Failure Classification

The server depends on the runtime’s truthful health model.

Current classification rules:

- Docker or Compose unavailable: runtime status is failed or degraded with explicit reasons
- Srclight bridge or bootstrap failure: engine health is unhealthy and the runtime reports the root cause
- missing `git` or invisible repository metadata: base index data can remain available, but Git-backed Srclight tools degrade with explicit runtime evidence and doctor output
- incomplete optional embedding config: base Srclight remains usable and capability warnings describe the semantic limitation
- healthy non-code engines remain callable even when Srclight is degraded

## Related Files

- `.mimirmesh/runtime/health.json`
- `.mimirmesh/runtime/routing-table.json`
- `.mimirmesh/runtime/bootstrap-state.json`
- `.mimirmesh/runtime/engines/srclight.json`
