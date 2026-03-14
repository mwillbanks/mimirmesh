# Quickstart: Srclight Full Capability Enablement

## Prerequisites

- Bun workspace dependencies installed
- Docker and Docker Compose available
- Optional for GPU path: NVIDIA container runtime installed on host
- Optional for embeddings: Ollama running on host (`http://host.docker.internal:11434`)

## 1. Set global GPU policy

In project config, set global runtime policy:

- `gpuMode: auto` (default, recommended)
- `gpuMode: on` (require GPU, fail if unavailable)
- `gpuMode: off` (force CPU runtime)

## 2. Configure Srclight embedding behavior

- `defaultEmbedModel` defaults to `nomic-embed-text`
- `ollamaBaseUrl` defaults to `http://host.docker.internal:11434`
- Effective model is `embedModel ?? defaultEmbedModel`

## 3. Start runtime

Start normal runtime lifecycle command for this repo.
Expected behavior:

- In `gpuMode:auto`, runtime resolves CPU or CUDA variant per host capability.
- Srclight service includes `extra_hosts` for host Ollama reachability.
- Required bootstrap (`srclight index`) runs before readiness becomes healthy.

## 4. Validate routing coverage

Verify unified tools resolve when discovered:

- `list_workspace_projects`
- `find_tests`
- `inspect_type_hierarchy`
- `inspect_platform_code`
- `refresh_index`

Validate corrected route classes:

- `investigate_issue` includes `changes_to`
- `evaluate_codebase` includes `embedding_status`

## 5. Validate passthrough-only tools

Confirm these remain callable as discovery-backed empty-input passthrough tools:

- `setup_guide`
- `server_stats`
- `restart_server`

## 6. Failure-mode checks

- `gpuMode:on` on non-GPU host: explicit GPU requirement failure
- `gpuMode:auto` on non-GPU host: CPU fallback and healthy startup
- stdio mode `restart_server`: explicit upstream-not-supported failure
