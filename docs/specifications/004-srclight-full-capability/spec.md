# Feature Specification: Srclight Full Capability Enablement

**Feature Branch**: `004-srclight-full-capability`  
**Created**: 2026-03-18  
**Status**: Draft  
**Input**: User description: "Srclight Full Capability Enablement — GPU passthrough, Ollama integration, and full 29-tool routing coverage for the srclight MCP engine inside MímirMesh."

## Clarifications

### Session 2026-03-18

- Q: Does `defaultEmbedModel` drive the `--embed` bootstrap flag automatically, or is it a suggestion-only field that never activates embedding? → A: `defaultEmbedModel` is a fallback activator — if `embedModel` is null but `defaultEmbedModel` is non-null and `ollamaBaseUrl` is non-null, embedding is automatically activated using the default model.
- Q: When `inspect_platform_code` is called, how is dispatch between `get_platform_variants` (symbol arg) and `platform_conditionals` (zero-arg) determined? → A: Input-driven — symbol name present in input routes to `get_platform_variants(symbol_name)`; empty/absent input routes to `platform_conditionals()`.
- Q: How should GPU runtime selection avoid host failures while still enabling acceleration when available? → A: Use a global MímirMesh setting `gpuMode` with values `auto|on|off` and default `auto`. In `auto`, detect NVIDIA runtime availability and select CUDA runtime only when available; otherwise select CPU runtime.
- Q: Where should `gpuMode` resolution happen? → A: Resolve once in the runtime orchestration layer, then pass resolved per-engine GPU decisions to adapters and compose rendering.
- Q: Should legacy `gpuEnabled` config be mapped as a fallback when `gpuMode` is introduced? → A: No fallback mapping is required. `gpuMode` is authoritative and legacy compatibility behavior is out of scope for this feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete Srclight Tool Surface Accessible To Agents (Priority: P1)

As an AI agent using MímirMesh for repository intelligence, I need all 29 srclight tools to be reachable through the unified routing layer with correct input normalization so that I receive structured, accurate results for every code-intelligence operation srclight supports — including test discovery, type hierarchy inspection, platform-conditional analysis, index refresh, and workspace project listing — without having to issue raw passthrough calls or construct tool-specific argument shapes manually.

**Why this priority**: The routing gaps mean agents today silently miss 9 of 29 tools in unified dispatch. `changes_to` already exists in the git-probe logic but is absent from routing rules, `embedding_status` is in `emptyInputToolNames` but never surfaced via `evaluate_codebase`, and 7 others have zero routing coverage. Closing these gaps is the highest-value change because it directly expands what agents can accomplish through the existing MCP surface without any container or config change.

**Independent Test**: Can be fully tested by starting the runtime against a real repository, calling each of the 5 new unified tools (`list_workspace_projects`, `find_tests`, `inspect_type_hierarchy`, `inspect_platform_code`, `refresh_index`) through the MCP server, verifying that `changes_to` and `embedding_status` now resolve through `investigate_issue` and `evaluate_codebase` respectively, and confirming that `setup_guide`, `server_stats`, and `restart_server` are reachable as zero-argument passthrough calls.

**Acceptance Scenarios**:

1. **Given** the srclight engine is healthy and the repository has been indexed, **When** an agent calls the `find_tests` unified tool with a symbol name, **Then** MímirMesh routes the call to `get_tests_for` in srclight and returns the covering test functions for that symbol.
2. **Given** the srclight engine is healthy, **When** an agent calls `inspect_type_hierarchy` with a type name, **Then** MímirMesh routes to `get_type_hierarchy` and returns the inheritance tree without the agent needing to know the underlying tool name.
3. **Given** the srclight engine is healthy, **When** an agent calls `inspect_platform_code` with a symbol name, **Then** MímirMesh routes to `get_platform_variants` and returns the platform-conditional code blocks for that symbol. **When** an agent calls `inspect_platform_code` with no input, **Then** MímirMesh routes to `platform_conditionals` and returns all platform-conditional blocks in the repository.
4. **Given** the srclight engine is healthy, **When** an agent calls `list_workspace_projects`, **Then** MímirMesh routes to `list_projects` and returns all workspace projects with their stats.
5. **Given** the srclight engine is healthy, **When** an agent calls `refresh_index`, **Then** MímirMesh routes to `reindex` and triggers an incremental re-index of the repository.
6. **Given** the srclight engine is healthy and the repository has git history, **When** an agent calls `investigate_issue` with a symbol name, **Then** `changes_to` is included among the candidate tool calls used to resolve the investigation.
7. **Given** embeddings are configured and indexed, **When** an agent calls `evaluate_codebase`, **Then** `embedding_status` is included among the candidate tools surfaced in the evaluation result.
8. **Given** the srclight engine is healthy, **When** an agent issues a raw passthrough call for `setup_guide`, `server_stats`, or `restart_server`, **Then** the call succeeds and the empty-argument contract is applied correctly.

---

### User Story 2 - GPU-Accelerated Vector Search Available When Hardware Is Present (Priority: P2)

As an operator running MímirMesh on different host types (GPU and non-GPU), I need MímirMesh to select the correct runtime automatically so that srclight uses CUDA when NVIDIA runtime is available and safely falls back to CPU when it is not, while still allowing explicit policy control when required.

**Why this priority**: Srclight advertises GPU-accelerated vector search as a primary feature and `srclight[all]` already installs cupy for it, but the current `python:3.12-slim` container base has the CUDA libraries stripped, so cupy silently falls back to CPU numpy regardless of hardware. This matters most for repositories with large symbol indexes where semantic search latency is noticeable.

**Independent Test**: Can be fully tested by setting global `gpuMode` to `auto`, `on`, and `off` in separate runs, rendering Docker Compose, verifying runtime/image selection behavior and GPU reservation emission, and confirming non-GPU hosts remain healthy in `auto` and `off` modes.

**Acceptance Scenarios**:

1. **Given** global `gpuMode` is `auto`, **When** MímirMesh detects NVIDIA runtime availability, **Then** it selects the CUDA runtime for `mm-srclight` and emits an NVIDIA GPU reservation under `deploy.resources.reservations.devices`.
2. **Given** global `gpuMode` is `auto`, **When** NVIDIA runtime is not available, **Then** MímirMesh selects the CPU runtime for `mm-srclight`, emits no GPU reservation, and the service starts healthy.
3. **Given** global `gpuMode` is `off`, **When** MímirMesh renders and starts runtime services, **Then** CPU runtime is selected regardless of hardware and GPU reservation is not emitted.
4. **Given** global `gpuMode` is `on`, **When** NVIDIA runtime is unavailable, **Then** startup fails with an explicit GPU requirement error instead of an opaque image/platform failure.
5. **Given** an existing project config file that does not contain `gpuMode`, **When** MímirMesh loads that config, **Then** `gpuMode` defaults to `auto` without a validation error or migration step required.

---

### User Story 3 - Ollama Embeddings Reachable By Default Without Manual URL Configuration (Priority: P3)

As an operator who wants to enable semantic search in srclight, I need the Ollama base URL to default to the Docker host bridge address so that I only need to set the embedding model name in config to activate semantic indexing — without also having to discover and enter the correct host-reachable URL — and I need the srclight container to be able to reach a host-running Ollama instance using the same host-bridge mechanism that `document-mcp` already uses.

**Why this priority**: Today `ollamaBaseUrl` defaults to `null`, so operators who enable an embedding model still get a partial configuration error until they also set the URL. The URL itself is a known constant for all Docker host scenarios. Defaulting it correctly removes unnecessary friction and aligns with the existing `document-mcp` pattern already in the codebase.

**Independent Test**: Can be fully tested by checking that a freshly initialized project config has `ollamaBaseUrl: "http://host.docker.internal:11434"` by default, rendering the Docker Compose file and verifying `extra_hosts: host.docker.internal:host-gateway` appears in the mm-srclight service block, then setting only `embedModel: "nomic-embed-text"` in config and confirming embedding is treated as fully configured rather than partially configured.

**Acceptance Scenarios**:

1. **Given** a freshly initialized MímirMesh project, **When** the project config is written, **Then** `srclight.settings.ollamaBaseUrl` defaults to `"http://host.docker.internal:11434"` and `defaultEmbedModel` defaults to `"nomic-embed-text"`.
2. **Given** the runtime config is rendered to Docker Compose, **When** the rendered YAML is inspected for the `mm-srclight` service, **Then** an `extra_hosts` entry mapping `host.docker.internal` to `host-gateway` is present.
3. **Given** only `embedModel` is set in config and `ollamaBaseUrl` retains its default value, **When** the srclight config is translated, **Then** embedding is treated as fully configured and no partial-configuration degraded warning is emitted.
4. **Given** neither `embedModel` nor `ollamaBaseUrl` is explicitly set by the operator (both remain at their schema defaults), **When** the srclight config is translated, **Then** `defaultEmbedModel` and the default `ollamaBaseUrl` together activate embedding automatically using `nomic-embed-text` as the indexing model.

---

### Edge Cases

- What happens when global `gpuMode` is `auto` and NVIDIA runtime is not installed? MímirMesh selects CPU runtime and does not emit GPU reservation for srclight.
- What happens when runtime executes on an ARM64 host with global `gpuMode` set to `auto`? MímirMesh selects CPU runtime by default and avoids CUDA-image selection failure. With `gpuMode: on`, startup fails with an explicit unsupported-platform or missing-NVIDIA-runtime message.
- What happens when `inspect_platform_code` is called with no input on a repository with no platform-conditional code? The empty-input path routes to `platform_conditionals`, which returns an empty result set. MímirMesh passes it through unchanged.
- What happens when `restart_server` is called in stdio transport mode? Srclight documents restart as SSE-only. The call fails at the srclight level; MímirMesh passes the failure back through the normal bridge error path.
- What happens when `reindex` is triggered while srclight is already indexing? Srclight handles concurrent indexing internally; MímirMesh passes the call through and returns whatever srclight returns.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The unified routing layer MUST include routing rules for all 29 srclight MCP tools such that every tool is either mapped to an existing or new unified tool or is explicitly exposed as a discovery-backed zero-arg passthrough.
- **FR-002**: Five new unified tool names MUST be added: `list_workspace_projects`, `find_tests`, `inspect_type_hierarchy`, `inspect_platform_code`, `refresh_index`. Each MUST be registered wherever the canonical unified tool name set is declared in `packages/mcp-core`.
- **FR-003**: The `investigate_issue` routing rule MUST include `changes_to` as a candidate tool pattern so that git history for a symbol's file is available through the standard investigation unified tool.
- **FR-004**: The `evaluate_codebase` routing rule MUST include `embedding_status` as a candidate tool pattern alongside the existing `embedding_health` pattern.
- **FR-005**: `platform_conditionals`, `reindex`, `setup_guide`, `server_stats`, and `restart_server` MUST be added to the `emptyInputToolNames` set so they receive a zero-argument payload.
- **FR-006**: `prepareSrclightToolInput` MUST include input normalization branches for all five new unified tool dispatches: `find_tests` → `get_tests_for`, `inspect_type_hierarchy` → `get_type_hierarchy`, `inspect_platform_code` → `get_platform_variants` (when symbol name is present) or `platform_conditionals` (when input is absent), `list_workspace_projects` → `list_projects`, `refresh_index` → `reindex`.
- **FR-007**: `executeSrclightUnifiedTool` MUST include execution branches for all five new unified tools, following the same single-step execution pattern used by existing tools.
- **FR-008**: MímirMesh config schema MUST include a global `gpuMode` setting with enum values `auto`, `on`, and `off`, defaulting to `auto`.
- **FR-008A**: The feature MUST NOT implement legacy compatibility mapping from `srclight.settings.gpuEnabled` to global `gpuMode`.
- **FR-009**: In `gpuMode: auto`, runtime orchestration MUST detect NVIDIA runtime availability and choose CUDA runtime/image only when available; otherwise it MUST choose CPU runtime/image.
- **FR-010**: In `gpuMode: on`, runtime orchestration MUST require NVIDIA runtime and emit `deploy.resources.reservations.devices` for `mm-srclight`; if unavailable, startup MUST fail with an explicit GPU requirement error.
- **FR-011**: In `gpuMode: off`, runtime orchestration MUST force CPU runtime/image selection and MUST NOT emit GPU reservation for `mm-srclight`.
- **FR-011A**: GPU policy resolution MUST occur in a single global runtime resolver that computes per-engine effective GPU decisions before adapter translation and compose rendering.
- **FR-012**: `srclightSettingsSchema` MUST include a `defaultEmbedModel` string field that defaults to `"nomic-embed-text"`.
- **FR-013**: The default value for `ollamaBaseUrl` in `packages/config/src/defaults/index.ts` MUST be changed from `null` to `"http://host.docker.internal:11434"`.
- **FR-014**: The Docker Compose render for `mm-srclight` MUST include `extra_hosts: ["host.docker.internal:host-gateway"]` so the srclight container can reach a host-running Ollama instance.
- **FR-015**: When `ollamaBaseUrl` is non-null AND either `embedModel` is non-null or `defaultEmbedModel` is non-null, embedding MUST be treated as fully configured and no partial-configuration degraded warning MUST be emitted. The effective indexing model MUST be `embedModel` if set, falling back to `defaultEmbedModel` otherwise.
- **FR-016**: The effective GPU policy for srclight MUST be passed into container env (for example `SRCLIGHT_GPU_MODE` and/or resolved `SRCLIGHT_GPU_ENABLED`) after global `gpuMode` resolution.

### Runtime Truth and Validation Requirements

- **RTV-001**: Engine-owned capabilities MUST be discovered from live runtime endpoints and exercised successfully in acceptance scenarios.
- **RTV-002**: The system MUST NOT rely on hard-coded engine tool inventories to represent runtime availability. New routing rules are matched against live-discovered tool inventories only.
- **RTV-003**: Required bootstrap/indexing steps MUST run automatically and MUST be verified before readiness is reported healthy.
- **RTV-004**: Degraded mode MUST report proven root cause, affected capabilities, and corrective actions based on live checks.
- **RTV-005**: Configuration-dependent limitations (partial embedding config, GPU unavailable) MUST be classified only after execution-based validation against the active runtime.
- **RTV-006**: Local/private execution MUST be preferred. Ollama runs on the operator's host machine; the srclight container connects via the host bridge URL. No cloud embedding provider is used by default.
- **RTV-007**: Feature documentation under `docs/features/` and `docs/specifications/001-local-code-intelligence/contracts/` MUST be updated to reflect the full 29-tool surface, GPU requirements, and Ollama host integration.

### Key Entities

- **Unified Tool**: A named MímirMesh MCP tool that routes to one or more engine-specific tools based on live discovery. Five new ones are added: `list_workspace_projects`, `find_tests`, `inspect_type_hierarchy`, `inspect_platform_code`, `refresh_index`.
- **Srclight Routing Rule**: A record mapping a unified tool name to one or more regex patterns matched against discovered srclight tool names, with a numeric priority. This feature adds 5 new rules and amends 2 existing rules.
- **Engine Contract Env**: The key-value environment block produced by `translateSrclightConfig` and passed to the Docker Compose renderer. This feature adds resolved GPU policy env such as `SRCLIGHT_GPU_MODE` and optionally `SRCLIGHT_GPU_ENABLED`.
- **GPU Policy**: Global runtime policy (`auto|on|off`) that determines whether each GPU-capable engine uses CUDA runtime or CPU runtime.
- **GPU Resolver**: A runtime-level policy resolver that evaluates global `gpuMode`, host GPU capability, and engine support to produce an effective per-engine GPU decision.
- **GPU Deploy Block**: A Docker Compose `deploy.resources.reservations.devices` section emitted when resolved policy requires GPU for `mm-srclight`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 29 srclight MCP tools are reachable — 26 via unified routing rules and 3 (`setup_guide`, `server_stats`, `restart_server`) as zero-argument discovery-backed passthrough only — confirmed by routing rule test coverage. (`platform_conditionals` and `reindex` are in unified routing via `inspect_platform_code` and `refresh_index` respectively.)
- **SC-002**: An operator can activate srclight semantic search on a freshly initialized project either by setting only `embedModel` (using default Ollama URL) or by relying on default model plus default URL fallback behavior, with no manual host URL configuration required.
- **SC-003**: The Docker Compose render reflects global GPU policy resolution: `auto` emits GPU reservation only when NVIDIA is available, `on` always emits it and errors when unavailable, and `off` never emits it.
- **SC-004**: Srclight runtime selection avoids default startup failures on non-GPU hosts by selecting CPU runtime under `gpuMode: auto`.
- **SC-005**: Zero changes to routing dispatch logic in `packages/mcp-core` are required — all new routing rules and tool registrations are confined to the srclight adapter (`packages/mcp-adapters/srclight/`) and the unified tool name registry in `packages/mcp-core`.

### Runtime Validation Outcomes

- **RVO-001**: Tool discovery reports only live-discovered srclight capabilities. The 5 new unified tool names appear in routing table output only when the corresponding srclight tools are discovered at runtime.
- **RVO-002**: Runtime readiness behavior is unchanged — bootstrap still gates on `srclight index /workspace` completion before the engine is marked healthy.
- **RVO-003**: With global `gpuMode: auto` (default), non-GPU hosts remain healthy via CPU runtime selection. With `gpuMode: on`, non-GPU hosts fail early with explicit GPU requirement diagnostics.
- **RVO-004**: Documentation under `docs/specifications/001-local-code-intelligence/contracts/srclight-routing.md` and `docs/features/mcp-server.md` lists all 29 tools with their unified route mappings after this feature lands.

## Assumptions

- Srclight 0.18.x exposes exactly the 29 tools described in the upstream README. If the discovered tool inventory differs at runtime, routing rules that do not match simply produce no routes — no error.
- `reindex()`, `setup_guide()`, `server_stats()`, `restart_server()`, and `platform_conditionals()` are zero-argument tools in srclight 0.18.x.
- NVIDIA CUDA 12.6 is the correct base. The implementation may use a later compatible 12.x minor if available.
- The NVIDIA CUDA base image supports linux/amd64 only; ARM64 flows rely on CPU runtime selection under default `gpuMode: auto`.
- No legacy compatibility mapping from `srclight.settings.gpuEnabled` is required in this feature; global `gpuMode` is the only supported policy input.
- The default embed model `nomic-embed-text` runs on CPU without VRAM. It is the automatic fallback embedding model when no explicit `embedModel` is set by the operator.
- `defaultEmbedModel` is a fallback activator: when `embedModel` is null, `defaultEmbedModel` is non-null, and `ollamaBaseUrl` is non-null, embedding activates automatically using `defaultEmbedModel` as the effective indexing model. Setting `embedModel` explicitly overrides `defaultEmbedModel`.
