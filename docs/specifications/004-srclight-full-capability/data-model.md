# Data Model: Srclight Full Capability Enablement

## Entity: GlobalRuntimeGpuPolicy

- Purpose: Project-level GPU execution policy shared by all GPU-capable engines.
- Fields:
  - `gpuMode` (enum: `auto` | `on` | `off`, default `auto`)
  - `resolvedAt` (ISO timestamp, runtime-evaluated)
- Validation rules:
  - Must be one of the three enum values.
  - Missing value defaults to `auto`.
- State transitions:
  - `configured` -> `resolved` once runtime evaluates host capability.

## Entity: EngineGpuResolution

- Purpose: Effective per-engine GPU decision produced by global resolver.
- Fields:
  - `engineId` (string, e.g., `srclight`)
  - `engineSupportsGpu` (boolean)
  - `hostNvidiaAvailable` (boolean)
  - `effectiveUseGpu` (boolean)
  - `resolutionReason` (string)
  - `runtimeVariant` (enum: `cuda` | `cpu`)
- Validation rules:
  - `runtimeVariant` must match `effectiveUseGpu` (`cuda` when true, `cpu` when false).
  - In `gpuMode=on`, `hostNvidiaAvailable=false` is invalid for GPU-capable engines and produces startup failure.
- State transitions:
  - `pending` -> `resolved` during runtime orchestration before compose render.

## Entity: SrclightRuntimeVariantContract

- Purpose: Runtime contract inputs selected by GPU resolution.
- Fields:
  - `serviceName` (`mm-srclight`)
  - `dockerfile` (CPU or CUDA Dockerfile path)
  - `emitGpuReservation` (boolean)
  - `envGpuMode` (string)
  - `envGpuEnabled` (optional boolean string)
- Validation rules:
  - GPU reservation emitted only when `emitGpuReservation=true`.
  - `dockerfile` path must correspond to selected runtime variant.

## Entity: EffectiveEmbeddingConfig

- Purpose: Final embedding activation state for Srclight bootstrap and degraded checks.
- Fields:
  - `embedModel` (nullable string)
  - `defaultEmbedModel` (string, default `nomic-embed-text`)
  - `effectiveEmbedModel` (string, derived `embedModel ?? defaultEmbedModel`)
  - `ollamaBaseUrl` (nullable string, default `http://host.docker.internal:11434`)
  - `embeddingEnabled` (boolean)
- Validation rules:
  - `embeddingEnabled=true` only when `effectiveEmbedModel` and `ollamaBaseUrl` are both non-empty.
  - Explicit `embedModel` overrides `defaultEmbedModel`.

## Entity: SrclightUnifiedCoverage

- Purpose: Mapping completeness for Srclight 29-tool surface through unified routing.
- Fields:
  - `toolName` (string)
  - `routeClass` (enum: `unified` | `passthrough-only`)
  - `unifiedTool` (nullable string)
  - `inputMode` (enum: `empty` | `normalized` | `raw`)
- Validation rules:
  - All discovered Srclight tools must be assigned a route class.
  - Exactly 3 tools remain passthrough-only: `setup_guide`, `server_stats`, `restart_server`.
  - `inspect_platform_code` dispatch must be input-driven for `get_platform_variants` vs `platform_conditionals`.
