# Contract: Srclight Unified Routing Coverage

## Purpose

Define the routing contract that covers the full Srclight tool surface while preserving discovery-backed behavior.

## Discovery Rule

- Routing rules are matched only against live-discovered Srclight tools.
- No static registration of engine-owned tool inventories is allowed.

## Coverage Contract

- 29 Srclight tools must be reachable.
- 26 tools are reachable through unified routing classes.
- 3 tools remain passthrough-only by design:
  - `setup_guide`
  - `server_stats`
  - `restart_server`

## Required Unified Additions

New unified tools:

- `list_workspace_projects` -> `list_projects`
- `find_tests` -> `get_tests_for`
- `inspect_type_hierarchy` -> `get_type_hierarchy`
- `inspect_platform_code` -> `get_platform_variants` or `platform_conditionals`
- `refresh_index` -> `reindex`

Existing route corrections:

- `investigate_issue` must include `changes_to`
- `evaluate_codebase` must include `embedding_status`

## Input Normalization Contract

- `inspect_platform_code` dispatch is input-driven:
  - symbol present -> `get_platform_variants(symbol_name, project?)`
  - input absent -> `platform_conditionals()`
- Empty-input tools include:
  - `platform_conditionals`
  - `reindex`
  - `setup_guide`
  - `server_stats`
  - `restart_server`

## Validation Contract

- Routing tests must assert:
  - each new unified tool resolves when matching Srclight tool is discovered
  - corrected `changes_to` and `embedding_status` paths are selected
  - passthrough-only tools remain callable with empty args
