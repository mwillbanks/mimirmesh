# Data Model: Srclight Runtime Replacement

## Entity: SrclightEngineConfig

**Purpose**: Defines the repository-scoped configuration required to run Srclight as a MímirMesh engine.

**Fields**:
- `engineId`: stable identifier `srclight`
- `enabled`: whether the engine participates in runtime startup and discovery
- `required`: whether readiness may degrade when Srclight is unavailable
- `namespace`: public passthrough namespace prefix, planned as `mimirmesh.srclight`
- `serviceName`: Docker Compose service name, planned as `mm-srclight`
- `image`: runtime image contract including service, dockerfile path, context, and tag
- `bridge`: bridge port and bridge HTTP endpoint paths
- `mounts.repo`: active repository mount path inside the container
- `mounts.mimirmesh`: `.mimirmesh` mount path inside the container
- `settings.transport`: upstream transport mode used between bridge and Srclight (`sse` by default)
- `settings.port`: upstream Srclight HTTP port when SSE is enabled
- `settings.rootPath`: repository root path inside the container
- `settings.indexOnStart`: whether bootstrap must run native indexing before readiness
- `settings.embedModel`: optional local embedding model name
- `settings.ollamaBaseUrl`: optional local Ollama base URL
- `settings.embedRequestTimeoutSeconds`: timeout for embedding provider requests when configured

**Validation Rules**:
- `rootPath` must be non-empty and point at the mounted repository path.
- `transport` must be one of the bridge-supported upstream transport kinds.
- `embedModel` and `ollamaBaseUrl` must both be present to enable embedding indexing.
- Missing embedding settings must not invalidate base engine startup.

## Entity: SrclightBootstrapJob

**Purpose**: Captures the required native indexing step MímirMesh performs before declaring Srclight ready.

**Fields**:
- `engine`: `srclight`
- `required`: `true`
- `mode`: `command`
- `command`: native bootstrap command, planned as `srclight index`
- `args`: repository path plus optional `--embed <model>`
- `startedAt`
- `completedAt`
- `result`: `success`, `failed`, or `skipped`
- `failureReason`
- `inputHash`: hash of the bootstrap inputs used for change detection and evidence

**State Transitions**:
- `pending` → `running` when bootstrap begins
- `running` → `success` when native indexing completes with exit code 0
- `running` → `failed` when the command exits non-zero or times out
- `pending` → `skipped` only when the engine is disabled

## Entity: SrclightRuntimeState

**Purpose**: Runtime evidence persisted for status, docs, and degraded-mode diagnostics.

**Fields**:
- `engine`: `srclight`
- `enabled`
- `required`
- `namespace`
- `serviceName`
- `imageTag`
- `configHash`
- `discoveredTools`: live-discovered Srclight tools
- `health.state`: `healthy`, `unhealthy`, or `unknown`
- `health.message`: last proven engine health result
- `bridge.url`
- `bridge.healthy`
- `bridge.lastError`
- `lastStartupAt`
- `lastBootstrapAt`
- `lastBootstrapResult`
- `degradedReason`
- `capabilityWarnings`: optional notes for semantic-only degradation or embedding-specific limitations

**Validation Rules**:
- `discoveredTools` may be empty only when health is not healthy or the engine is disabled.
- `lastBootstrapResult=success` is required before runtime readiness can become healthy when the engine is enabled and required.
- `degradedReason` must be populated when health is unhealthy or bootstrap fails.

## Entity: CodeIntelligenceRouteMapping

**Purpose**: Represents how a unified MímirMesh tool maps to live-discovered Srclight passthrough tools.

**Fields**:
- `unifiedTool`: stable unified tool name such as `search_code` or `find_symbol`
- `engine`: `srclight`
- `engineTool`: discovered Srclight tool name
- `priority`: integer route priority
- `reason`: textual explanation of why the route exists

**Relationships**:
- Many `CodeIntelligenceRouteMapping` records reference one `SrclightRuntimeState`.
- Unified routes are generated only from `discoveredTools` in the current runtime state.

## Entity: CapabilityValidationRecord

**Purpose**: Tracks the live validation evidence used for docs and acceptance checks.

**Fields**:
- `surface`: `server`, `client`, or `runtime`
- `capability`: unified or passthrough capability being verified
- `input`: representative request payload
- `observedOutcome`: summary of actual result
- `validatedAt`
- `degraded`: whether the result showed a limitation
- `notes`: prerequisite or corrective-action notes captured from live behavior

**Relationships**:
- Many validation records can be attached to one `SrclightRuntimeState`.
- Documentation updates in `docs/features/*` are derived from these validated outcomes.