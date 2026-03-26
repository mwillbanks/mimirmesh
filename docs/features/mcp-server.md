# MCP Server

This document describes the current Srclight-backed MCP server behavior that MímirMesh validates through runtime state, integration tests, and workflow smoke tests.
Srclight is the only active code-intelligence engine; `codebase-memory-mcp` is retired and excluded from live runtime surfaces.

## Server Role

`mimirmesh-server` is the stdio MCP surface for the project-local runtime. It:

- registers the unified MímirMesh tools
- keeps passthrough tools session-scoped and deferred by default
- adds passthrough tools from live engine discovery only when a session loads the owning engine group
- publishes engine-native passthrough tool names while preserving the internal routing table truth
- executes unified and passthrough calls through the same routing table used by the CLI

The server does not embed engine logic. It reads `.mimirmesh/config.yml`, loads `.mimirmesh/runtime/routing-table.json`, and exposes whatever the live runtime has actually discovered.

The human-facing CLI surfaces that inspect or invoke MCP tools now present the
same explicit workflow language as the rest of the product: step progress,
warnings, degraded outcomes, and next actions by default, with `--json`
available only when a caller explicitly wants the serialized workflow envelope.

Each server session also exposes three management tools as part of the core
surface:

- `load_deferred_tools`
- `refresh_tool_surface`
- `inspect_tool_schema`

When the live router advertises the deterministic skill registry tools, the
server publishes them through the same registration path as every other unified
tool. The CLI mirrors that contract with direct `mimirmesh skills find|read|resolve|refresh|create|update` commands, so server and CLI surfaces stay aligned even when the underlying skill backend evolves.

For the six `skills.*` tools specifically, the startup surface now preserves a
concise `description` field for every published tool definition. The transport
surface for those tools is also intentionally lean: the human-facing message is
returned as plain text content, while the structured payload carries one compact
object with `tool`, `success`, `degraded`, warnings, optional `nextAction`, and
the tool-specific `data` body. The server no longer duplicates the same skill
payload into item content, item metadata, and a second transport envelope.

## Tool Naming

Internal routing entries can remain dotted legacy identifiers such as `mimirmesh.srclight.search_symbols`, but the public MCP surface now publishes engine-native passthrough names such as `srclight_search_symbols`.

Retired `mimirmesh`-prefixed passthrough aliases are hidden from `tools/list`. When a caller invokes one directly, the server returns an explicit replacement message naming the published `<engine>_<tool>` form.

The public unified aliases are also first-class MCP tools, not discovery-only conveniences. The server manifest registers direct schemas for the friendly tools that callers are expected to use for multi-engine routing, including:

- `explain_project`
- `explain_subsystem`
- `find_symbol`
- `find_tests`
- `inspect_type_hierarchy`
- `inspect_platform_code`
- `list_workspace_projects`
- `refresh_index`
- `search_code`
- `search_docs`
- `trace_dependency`
- `trace_integration`
- `investigate_issue`
- `evaluate_codebase`
- `generate_adr`

The routed surface is the deliberate agent-facing contract. Use the unified tools first for navigation, investigation, architecture, and integration work, then escalate to passthrough tools only when the routed result leaves a concrete gap such as history evidence or engine-specific deployment detail.

## Runtime Preconditions

The server is useful only after the project runtime has been rendered and discovery has executed.

Required runtime artifacts:

- `.mimirmesh/runtime/docker-compose.yml`
- `.mimirmesh/runtime/connection.json`
- `.mimirmesh/runtime/health.json`
- `.mimirmesh/runtime/routing-table.json`
- `.mimirmesh/runtime/bootstrap-state.json`
- `.mimirmesh/runtime/engines/srclight.json`
- `.mimirmesh/runtime/mcp-server.json`
- `.mimirmesh/runtime/mcp-sessions/*.json`

If Docker or Compose is unavailable, the server still starts, but runtime-backed tools reflect that failed or degraded state instead of inventing readiness.

The deterministic skill registry also depends on the runtime PostgreSQL service
for repository-scoped indexed state. `skills.find`, `skills.read`, and
`skills.resolve` operate from the persisted skill registry snapshot, and
`skills.refresh` is the only path that mutates or rebuilds that state. Before a
repository has been indexed, the skills tools report degraded readiness with an
explicit refresh action instead of silently reparsing the filesystem on every
call.

When the selected embeddings provider is local `llama_cpp`, runtime rendering
materializes the bundled `docker/images/llama-cpp/Dockerfile` asset into the
project-scoped `.mimirmesh/runtime/images/llama-cpp/Dockerfile` path and uses
that Dockerfile to build a Compose image around an official
`ghcr.io/ggml-org/llama.cpp` base image. This replaces the fragile host-native
llama.cpp assumption in installer-managed flows, which is especially important
on macOS.

## Srclight Runtime Path

Srclight is the preferred code-intelligence engine when its capabilities are discovered.

Observed runtime contract:

- service name: `mm-srclight`
- bridge transport: `sse`
- published passthrough prefix: `srclight_`
- repo mounted at `/workspace`
- runtime variant selected from a global `runtime.gpuMode` policy (`auto|on|off`)
- Git-backed repository history requires the container image to include `git` and the mounted repository metadata to be visible at `/workspace/.git`
- native index state kept in the repository-local `.srclight/` directory
- bootstrap state recorded in `.mimirmesh/runtime/bootstrap-state.json`

When Srclight is configured for base search only, no hosted API key is required. Local embedding support uses `embedModel ?? defaultEmbedModel`, defaults `ollamaBaseUrl` to `http://host.docker.internal:11434`, and adds the same host bridge mapping used by `document-mcp`.

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

The routing table remains discovery-backed. If a required Srclight capability is not discovered, the server uses whatever lower-priority live route still matches the unified tool.

For `document_architecture`, the router now combines live architecture context from the ADR engine with document evidence from `document-mcp` document search when both engines are discovered. Neither `document-mcp` nor ADR currently has a separate required bootstrap job; they are treated as discovery-backed engines whose readiness comes from live service health and published tool inventory.

ADR passthrough calls also normalize the canonical ADR directory for the active repository. On this repository the effective path is `docs/adr`, even when upstream ADR tool schemas still advertise a legacy default such as `docs/adrs`.

Bridge-backed passthrough calls also normalize mount-aware paths before invocation. Host-absolute repository paths and repo-relative paths are translated to the runtime container contract (`/workspace/...` and `/mimirmesh/...`) for fields such as `projectPath`, `filePath`, `adrPath`, `todoPath`, `outputPath`, `repo_path`, and `rootPath`. Structured result payloads are normalized back to host paths where possible before the router merges them.

## Passthrough Exposure

Srclight passthrough tools are never registered from a static catalog. They are
discovered from the running engine and remain hidden from `tools/list` until the
current session loads the owning deferred group.

Representative passthrough tools validated in tests and routing rules:

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

Lazy-load contract:

- session start publishes unified tools plus the management tools above
- `load_deferred_tools` refreshes discovery for one engine group and updates only that session’s visible tool list
- the server emits MCP `notifications/tools/list_changed` after a successful surface change
- `inspect_tool_schema` returns compressed or full detail for visible tools without a custom wire protocol
- already-loaded groups remain stable across live policy changes until `refresh_tool_surface` is invoked

## Failure Classification

The server depends on the runtime’s truthful health model.

Current classification rules:

- Docker or Compose unavailable: runtime status is failed or degraded with explicit reasons
- Srclight bridge or bootstrap failure: engine health is unhealthy and the runtime reports the root cause
- `runtime.gpuMode=on` without NVIDIA runtime support: startup fails early with an explicit GPU requirement diagnostic
- `runtime.gpuMode=auto` without NVIDIA runtime support: Srclight selects the CPU image and omits GPU reservation
- missing `git` or invisible repository metadata: base index data can remain available, but Git-backed Srclight tools degrade with explicit runtime evidence and doctor output
- embedding bootstrap failure with otherwise valid defaults: base Srclight remains usable and capability warnings describe the semantic limitation
- healthy non-code engines remain callable even when Srclight is degraded

This same truth model is what the CLI surfaces in `mimirmesh mcp list-tools`
and `mimirmesh mcp tool`; neither surface invents tool availability when the
runtime is not actually ready.

Runtime status and CLI machine-readable payloads now also surface:

- session id
- policy version
- compression level
- loaded engine groups
- deferred engine groups
- recent lazy-load diagnostics

When the runtime is stale, the surfaced tools now return explicit warning codes and remediation messages instead of generic bridge failures. Current machine-readable warning codes are:

- `runtime_restart_required`
- `mcp_server_stale`
- `bridge_unhealthy`
- `upstream_tool_fallback_used`

## Validation Snapshot

The current lazy-surface and schema-compression validation fixtures record these observed results:

| Validation target | Result |
|-------------------|--------|
| Default tool-surface payload vs eager passthrough baseline | 41.44% smaller |
| Session with one engine group already visible vs eager baseline | 27.78% smaller |
| Representative compressed schema payload vs full schema payload | 40.93% smaller |
| Lazy-load latency target | pass under the `< 2s` guard in integration validation |
| Policy refresh visibility target | pass under the workflow refresh validation suite |

These checks are enforced by:

- `packages/mcp-core/tests/registry/router.performance.test.ts`
- `tests/integration/mcp/lazy-load-latency.test.ts`
- `tests/workflow/mcp-policy-refresh.test.ts`
- `apps/server/tests/startup/start-server.test.ts`

## Repository Ignore Semantics

Repository-local scanning and routed result filtering respect repository-owned ignore sources in this order:

- `.gitignore`
- `.ignore`
- `.mimirmeshignore`

MímirMesh uses those sources when it walks the repository for local analysis and when it filters routed MCP results before merging them for the caller. This keeps transient runtime artifacts, backups, and other ignored repository content out of the friendly unified surface without hardcoding repository-specific path exceptions into the router.

## Related Files

- `.mimirmesh/runtime/health.json`
- `.mimirmesh/runtime/routing-table.json`
- `.mimirmesh/runtime/bootstrap-state.json`
- `.mimirmesh/runtime/engines/srclight.json`
- `.mimirmesh/runtime/mcp-server.json`
- `.mimirmesh/runtime/mcp-sessions/`
