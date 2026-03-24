# Data Model: Engine-Native Passthrough Namespacing

## Entity: Published Passthrough Tool

**Purpose**: Represents the externally published MCP passthrough tool name that callers see and invoke.

**Fields**:

- `publishedName`: external tool name in the form `<engine>_<tool>`
- `engineId`: canonical MímirMesh engine ID used as the public prefix
- `engineTool`: live-discovered upstream tool name
- `normalizedToolSuffix`: normalized tool segment derived from the discovered engine tool name
- `description`: human-readable passthrough description surfaced to callers
- `published`: boolean indicating whether the tool is currently published from live discovery

**Validation Rules**:

- `publishedName` MUST begin with `engineId` followed by `_`
- `publishedName` MUST be derived only from live-discovered passthrough capabilities
- `published` MUST be false when the engine is disabled, unhealthy, or undiscovered

**Relationships**:

- Maps one-to-one to a live-discovered passthrough capability at publication time
- References one canonical engine identity

## Entity: Internal Passthrough Route

**Purpose**: Represents the existing routing-table entry used for internal resolution and bridge invocation.

**Fields**:

- `publicTool`: current routing-table identifier already used by internal router resolution
- `engine`: canonical MímirMesh engine ID
- `engineTool`: upstream-discovered tool name
- `inputSchema`: discovery-backed input schema when available
- `description`: discovery-backed description

**Validation Rules**:

- MUST continue to be sourced from live discovery
- MAY remain unchanged by this feature as long as external publication and invocation stay correct

**Relationships**:

- One internal passthrough route can back one published passthrough tool
- One internal passthrough route can also back one retired alias mapping for failure guidance

## Entity: Retired Alias Mapping

**Purpose**: Represents a legacy passthrough name that is no longer published but can still be recognized to produce guidance.

**Fields**:

- `legacyName`: retired `mimirmesh`-prefixed passthrough name
- `replacementName`: required `<engine>_<tool>` replacement
- `engineId`: canonical engine ID for the replacement
- `reason`: human-readable explanation that the alias is retired
- `published`: always false

**Validation Rules**:

- `legacyName` MUST NOT appear in the published tool inventory
- `replacementName` MUST match the current published passthrough naming contract
- Guidance MUST be deterministic for any legacy alias that the system recognizes

## Entity: Engine Publication Policy

**Purpose**: Captures whether an engine participates in the external passthrough naming contract.

**Fields**:

- `engineId`: canonical MímirMesh engine ID
- `hasCanonicalId`: whether the engine is modeled as a canonical MímirMesh engine
- `supportsPassthrough`: whether the engine publishes direct passthrough tools
- `publicationPrefix`: external prefix used when publication is enabled
- `eligibleForContract`: whether the engine must follow the `<engine>_<tool>` rule

**Validation Rules**:

- `publicationPrefix` MUST equal `engineId` when `eligibleForContract` is true
- `eligibleForContract` MUST be false for arbitrary proxied external MCP servers without canonical engine IDs

## State Transitions

### Published Passthrough Tool

1. `undiscovered` → `published`
   - Trigger: live discovery succeeds for a passthrough-capable engine
2. `published` → `unpublished`
   - Trigger: engine becomes unhealthy, disabled, or undiscovered

### Retired Alias Mapping

1. `recognized` → `guided-failure`
   - Trigger: caller invokes a retired alias
2. `recognized` remains non-published throughout the feature lifecycle
