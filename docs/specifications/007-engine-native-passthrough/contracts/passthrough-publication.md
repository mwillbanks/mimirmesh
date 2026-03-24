# Contract: Passthrough Tool Publication And Legacy Alias Behavior

## Purpose

Define the externally published MCP passthrough naming contract for MímirMesh engines and the required behavior when callers invoke retired passthrough aliases.

## Publication Contract

For each live-discovered passthrough capability belonging to a passthrough-capable MímirMesh engine with a canonical engine ID:

- the externally published MCP tool name MUST be `<engine>_<tool>`
- `<engine>` MUST equal the canonical MímirMesh engine ID
- `<tool>` MUST be the normalized discovered engine tool name
- the tool MUST appear in MCP tool listings only when live discovery has succeeded for that engine

Examples:

- `srclight_search_symbols`
- `srclight_hybrid_search`
- `adr_validate_all_adrs`

## Non-Goals

- Unified tool names are not renamed by this feature.
- Arbitrary proxied external MCP servers without canonical MímirMesh engine IDs are not forced into this contract.
- Internal routing-table and runtime-state identifiers do not need to match the published MCP name as long as external behavior is correct.

## Invocation Contract

When a caller invokes a published passthrough tool name:

- the request MUST resolve to the correct live-discovered engine tool for that engine
- the request MUST preserve the existing passthrough execution semantics and provenance behavior
- the request MUST NOT require a second published compatibility alias

## Retired Alias Contract

When a caller invokes a retired `mimirmesh`-prefixed passthrough alias:

- the call MUST fail
- the failure MUST explicitly state that the alias is retired
- the failure MUST identify the replacement `<engine>_<tool>` name
- the retired alias MUST NOT be listed in the published MCP tool inventory

Example guidance shape:

- requested alias: `mimirmesh.srclight.search_symbols`
- outcome: retired alias failure
- replacement: `srclight_search_symbols`

## Validation Expectations

- MCP tool listings contain only published `<engine>_<tool>` passthrough names for eligible engines.
- Unified tools remain present under their existing names.
- Legacy alias invocation returns guidance rather than generic unknown-tool output.
- Documentation and skill examples use the same published passthrough names observed in validation.
