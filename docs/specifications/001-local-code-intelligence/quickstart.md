# Quickstart: Validate Srclight In MímirMesh

## 1. Prepare local prerequisites

- Docker and Docker Compose available
- Python is only needed inside the container image; no host Python dependency is required for the base runtime flow
- Optional semantic search: local Ollama reachable and a local embedding model pulled, such as `qwen3-embedding` or `nomic-embed-text`

## 2. Configure the project runtime

- Ensure `srclight` is enabled in `.mimirmesh/config.yml`
- Ensure `codebrain` is absent or disabled
- Leave embedding settings unset for the default base validation path
- Set embedding model and local Ollama base URL only when validating semantic enhancement behavior

## 3. Start the runtime

Run the normal runtime start flow:

- `mimirmesh runtime start`
- `mimirmesh runtime status`

Verify that:

- the Srclight image builds from `docker/images/srclight`
- the `mm-srclight` service starts as a real engine container
- the bridge becomes healthy
- bootstrap state is recorded for Srclight
- readiness is derived from runtime evidence rather than assumed
- the container can execute `git` and can read repository metadata from `/workspace/.git` when Git-backed repository intelligence is expected

## 4. Verify runtime state

Inspect live runtime evidence:

- `.mimirmesh/runtime/engines/srclight.json`
- `.mimirmesh/runtime/bootstrap-state.json`
- `.mimirmesh/runtime/routing-table.json`
- `.mimirmesh/runtime/health.json`

Expected base outcome:

- `srclight.json` exists even when the runtime is degraded
- `bridge.transport` is `sse`
- `runtimeEvidence.bootstrapMode` records the actual bootstrap path
- repo-local `.srclight` evidence is captured when present
- no third-party hosted API key required for healthy base operation

## 5. Verify discovered passthrough tools

Use the server or client tool-list flow and confirm live-discovered `mimirmesh.srclight.*` tools appear.

Representative passthrough validations:

- `mimirmesh.srclight.codebase_map`
- `mimirmesh.srclight.search_symbols`
- `mimirmesh.srclight.get_callers`
- `mimirmesh.srclight.index_status`
- `mimirmesh.srclight.recent_changes`
- `mimirmesh.srclight.git_hotspots`

## 6. Verify unified routing

Run representative unified tool calls and confirm the routing table prefers Srclight where its capabilities are discovered:

- `search_code`
- `find_symbol`
- `trace_dependency`
- `evaluate_codebase`

Validation result should include provenance. When Srclight is discovered for the relevant capability, the provenance should name `srclight`.

## 7. Verify degraded behavior

Base degraded scenario:

- break Srclight startup or bootstrap intentionally
- confirm runtime status shows a proven root cause and affected code-intelligence capabilities
- remove Git access inside the Srclight container or validate against a non-Git working tree and confirm runtime status reports the degraded Git-backed capabilities explicitly

Embedding degraded scenario:

- set only one side of the embedding configuration, or make Ollama unreachable after enabling embeddings
- confirm base engine state still exists and non-semantic queries remain callable
- confirm capability degradation is recorded without pretending the whole engine is healthy

## 8. Update runtime-facing docs from observed behavior

After live validation, update:

- `docs/features/mcp-server.md`
- `docs/features/mcp-client.md`

Documentation must record:

- startup requirements
- actual transport mode used between bridge and Srclight
- bootstrap/indexing flow
- runtime evidence files used for diagnosis
- optional embedding configuration
- validated passthrough and unified tool behavior
- degraded outcomes observed during testing
