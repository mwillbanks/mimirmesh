# Contract: Srclight Unified And Passthrough Routing

## Purpose

Define how live-discovered Srclight capabilities appear through MímirMesh passthrough and unified tool surfaces.

## Passthrough Exposure

Srclight passthrough tools are registered only from live discovery and exposed under `mimirmesh.srclight.*`.

Expected high-value passthrough tools include:

- `mimirmesh.srclight.codebase_map`
- `mimirmesh.srclight.search_symbols`
- `mimirmesh.srclight.get_symbol`
- `mimirmesh.srclight.get_signature`
- `mimirmesh.srclight.symbols_in_file`
- `mimirmesh.srclight.get_callers`
- `mimirmesh.srclight.get_callees`
- `mimirmesh.srclight.get_dependents`
- `mimirmesh.srclight.get_implementors`
- `mimirmesh.srclight.get_tests_for`
- `mimirmesh.srclight.get_type_hierarchy`
- `mimirmesh.srclight.semantic_search`
- `mimirmesh.srclight.hybrid_search`
- `mimirmesh.srclight.index_status`
- `mimirmesh.srclight.reindex`
- `mimirmesh.srclight.embedding_status`
- `mimirmesh.srclight.embedding_health`

No Srclight passthrough tool may be registered from a static catalog.

## Unified Routing Expectations

When the corresponding Srclight capability is discovered, unified tools should prefer Srclight over `codebrain` and any lower-priority fallback route.

Planned mappings:

| Unified Tool | Preferred Srclight Capability | Notes |
|--------------|-------------------------------|-------|
| `explain_project` | `codebase_map` | Primary repository orientation surface |
| `explain_subsystem` | `get_symbol`, `symbols_in_file`, `search_symbols` | Adapter may combine steps for subsystem summaries |
| `find_symbol` | `search_symbols`, `get_symbol`, `get_signature` | Prefer exact/fuzzy symbol lookup over generic grep-style search |
| `search_code` | `hybrid_search`, `search_symbols`, `semantic_search` | Use semantic capability only when live discovery and config support it |
| `trace_dependency` | `get_callers`, `get_callees`, `get_dependents` | Relationship navigation should come from Srclight graph tools |
| `trace_integration` | `get_dependents`, `get_implementors`, `get_build_targets` when available | Fallback to discovered dependency-adjacent tools only |
| `investigate_issue` | `hybrid_search`, `whats_changed`, `recent_changes`, `blame_symbol` | Likely requires adapter-managed multi-step execution |
| `evaluate_codebase` | `codebase_map`, `git_hotspots`, `index_status`, build-aware tools | Prefer Srclight evidence over legacy codebrain health |

## Fallback Rules

- If Srclight is healthy but a specific tool is not discovered, routing may fall back to another discovered engine for that unified tool.
- If Srclight is unhealthy, its unified routes must be absent from the live routing table.
- If Srclight is healthy but embeddings are unavailable, semantic-only routes must degrade or fall back without misreporting the entire engine as down.

## Validation Requirements

Validation must prove:

- passthrough tools appear only after successful discovery
- unified tool routes point to Srclight for overlapping code-intelligence capabilities
- degraded semantic capability does not erase healthy base routes
- stale `codebrain` routes are absent after the replacement is complete