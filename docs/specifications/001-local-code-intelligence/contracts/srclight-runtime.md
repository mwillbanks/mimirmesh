# Contract: Srclight Runtime Integration

## Purpose

Define the external runtime contract MímirMesh must satisfy to run Srclight as a real engine and report truthful health/readiness.

## Engine Identity

- Engine ID: `srclight`
- Display name: `Srclight`
- Compose service: `mm-srclight`
- Passthrough namespace: `mimirmesh.srclight`
- Runtime image locations:
  - CUDA: `docker/images/srclight/Dockerfile`
  - CPU: `docker/images/srclight/Dockerfile.cpu`

## Container Contract

The container must:

- run a real Srclight workload, not a placeholder process
- mount the active repository at `/workspace`
- mount project runtime state at `/mimirmesh`
- expose a stable upstream HTTP endpoint for the bridge when transport is SSE
- preserve repo-local `.srclight/` index files inside the mounted repository
- include `extra_hosts: host.docker.internal:host-gateway` for host-local Ollama access
- avoid any third-party hosted credential requirement for base startup

## Startup Contract

The runtime must translate project config into a deterministic startup definition:

- command: `srclight serve`
- default transport: `sse`
- default port: `8742`
- root path: `/workspace`
- runtime image variant selected from global `runtime.gpuMode` (`auto|on|off`)
- GPU reservation emitted only when the resolved Srclight runtime variant is CUDA
- effective embed configuration uses `embedModel ?? defaultEmbedModel`
- default local Ollama URL is `http://host.docker.internal:11434`

The bridge-facing runtime contract remains:

- `GET /health`
- `POST /discover`
- `POST /call`
- `POST /reconnect`

The bridge implementation may use `StreamableHTTPClientTransport` with `SSEClientTransport` fallback to reach the upstream Srclight server.

## Bootstrap Contract

When Srclight is enabled, MímirMesh must execute native bootstrap before readiness is healthy:

- base bootstrap command: `srclight index /workspace`
- embedding bootstrap extension: append `--embed <model>` when the effective local embedding configuration is enabled
- bootstrap result must be written into `.mimirmesh/runtime/bootstrap-state.json`
- bootstrap failure must mark the engine as degraded with the native command failure reason

## Health And Degraded-Mode Contract

Base engine health is healthy only when all of the following are true:

- the container is running
- the bridge can connect to the Srclight upstream transport
- live discovery succeeds
- required bootstrap completes successfully

Embedding limitations must be classified separately:

- base engine remains healthy if keyword/graph tools work and embeddings are not configured
- semantic capabilities are degraded if embeddings are configured but the local provider is unavailable or indexing fails
- degraded output must name the impacted capability set, such as `semantic_search`, `hybrid_search`, or embedding refresh

GPU limitations must also be classified truthfully:

- `runtime.gpuMode=auto` selects CPU when NVIDIA runtime support is unavailable
- `runtime.gpuMode=on` fails startup early when NVIDIA runtime support is unavailable
- `runtime.gpuMode=off` forces CPU regardless of host capability

## Runtime Evidence

The following files remain authoritative evidence for runtime truth:

- `.mimirmesh/runtime/connection.json`
- `.mimirmesh/runtime/health.json`
- `.mimirmesh/runtime/routing-table.json`
- `.mimirmesh/runtime/bootstrap-state.json`
- `.mimirmesh/runtime/engines/srclight.json`

Repo-local Srclight data remains native upstream state rather than runtime evidence:

- `.srclight/index.db`
- `.srclight/embeddings.npy`
- `.srclight/embeddings_norms.npy`
- `.srclight/embeddings_meta.json`
