# Contract: Global GPU Policy Resolution

## Purpose

Define the project-wide runtime contract for GPU policy so any GPU-capable engine (current and future) can share one deterministic decision model.

## Inputs

- Config field: `runtime.gpuMode` (enum `auto|on|off`, default `auto`)
- Host capability probe:
  - NVIDIA container runtime availability
  - compatible host/platform for selected GPU runtime image
- Engine metadata:
  - whether engine supports GPU acceleration
  - CPU and CUDA runtime variants

## Resolution Semantics

1. `gpuMode=auto`
   - If host NVIDIA runtime is available and engine supports GPU: resolve `effectiveUseGpu=true`.
   - Otherwise resolve `effectiveUseGpu=false`.
2. `gpuMode=on`
   - Engine must resolve `effectiveUseGpu=true`.
   - If NVIDIA runtime is unavailable: fail startup with explicit GPU requirement error.
3. `gpuMode=off`
   - Resolve `effectiveUseGpu=false` regardless of host capability.

## Outputs

Per engine resolution object includes:

- `effectiveUseGpu` (boolean)
- `runtimeVariant` (`cuda` or `cpu`)
- `resolutionReason` (machine-readable + human-readable)

## Compose Contract

- When `effectiveUseGpu=true`, service includes GPU device reservation:
  - `deploy.resources.reservations.devices`
  - `driver: nvidia`
  - `capabilities: [gpu]`
- When `effectiveUseGpu=false`, no GPU reservation is emitted.

## Adapter/Env Contract

- Resolved policy is passed to adapter/container environment as:
  - `SRCLIGHT_GPU_MODE` (required)
  - `SRCLIGHT_GPU_ENABLED` (optional derived signal)

## Failure Contract

- `gpuMode=on` + unavailable NVIDIA runtime must fail fast with explicit diagnostic.
- `gpuMode=auto` + unavailable NVIDIA runtime must not fail; CPU variant is selected.

## Non-goals

- Legacy compatibility mapping from `srclight.settings.gpuEnabled`.
