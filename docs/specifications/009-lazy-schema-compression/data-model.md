# Data Model: Token Reduction via Lazy Tool Registration and Schema Compression

## Tool Surface Policy

- **Purpose**: Defines how the MCP server classifies tools as core or deferred and how metadata compression behaves.
- **Fields**:
  - `compressionLevel`: `minimal`, `balanced`, or `aggressive` policy mapped to concrete summary rules
  - `coreEngineGroups`: engine groups whose tools may be available at session start
  - `deferredEngineGroups`: engine groups that require explicit load or deferred invocation
  - `deferredVisibility`: how deferred groups are advertised before load
  - `fullSchemaAccess`: whether fuller schema detail is available via schema inspection tools/commands
  - `refreshPolicy`: whether already-loaded groups require explicit refresh after policy change
- **Validation Rules**:
  - No engine group may be both core and deferred
  - Deferred visibility must not expose a tool as loaded when the session has not loaded that group
  - Compression level must map to a deterministic formatting profile

## Engine Group Catalog Entry

- **Purpose**: Represents the discoverable metadata for one engine-backed passthrough group.
- **Fields**:
  - `engineId`: stable engine identifier such as `srclight` or `document-mcp`
  - `displayName`: operator/client-facing name
  - `namespace`: published tool prefix/namespace
  - `availabilityState`: `core`, `deferred`, `loaded`, `unavailable`, or `degraded`
  - `healthMessage`: latest discovery/bridge state summary
  - `toolCount`: last observed live tool count
  - `lastDiscoveredAt`: timestamp of most recent discovery
- **Validation Rules**:
  - `loaded` is only valid for the active session tool surface when a lazy-load succeeded
  - `toolCount` must come from live discovery, not static adapter metadata alone

## Compressed Tool Descriptor

- **Purpose**: Represents the metadata a client sees during `listTools()` without full schema expansion.
- **Fields**:
  - `name`: published MCP tool name
  - `kind`: `unified`, `passthrough`, or `management`
  - `originEngine`: source engine for passthrough tools or `runtime`/`mimirmesh` for management tools
  - `summary`: compressed description text shown to clients
  - `argumentHints`: abbreviated required/optional parameter hints
  - `compressionProfile`: profile used to produce the summary
  - `sessionState`: `core`, `loaded`, or `deferred-indicator`
- **Validation Rules**:
  - `summary` must remain MCP-compatible string metadata
  - `argumentHints` must preserve enough information for tool selection without becoming a full schema dump
  - `deferred-indicator` descriptors must not be invocable as passthrough tools unless they are management tools by design

## Session Tool Surface

- **Purpose**: Captures the set of tools and deferred-group state visible to one MCP client session.
- **Fields**:
  - `sessionId`: server session identifier
  - `coreTools`: compressed tool descriptors available at start
  - `loadedEngineGroups`: engine groups successfully lazy-loaded for this session
  - `deferredEngineGroups`: groups still available but not yet loaded
  - `loadedTools`: passthrough descriptors currently visible to this session
  - `policyVersion`: fingerprint/hash of the tool surface policy applied to this session
  - `lastNotificationAt`: timestamp of the most recent list-changed notification sent for this session
- **Validation Rules**:
  - A loaded tool must belong to a loaded engine group for the same session
  - `policyVersion` changes do not mutate `loadedTools` until explicit refresh
  - Different sessions may share the same policy version while having different loaded engine groups

## Lazy Load Operation

- **Purpose**: Represents one explicit or invocation-triggered attempt to load a deferred engine group.
- **Fields**:
  - `sessionId`: requesting session
  - `engineId`: engine group requested
  - `trigger`: `explicit-load`, `tool-invocation`, or `refresh`
  - `startedAt`: timestamp when discovery started
  - `completedAt`: timestamp when discovery ended
  - `outcome`: `success`, `degraded`, or `failed`
  - `discoveredTools`: names and count discovered live
  - `diagnostics`: health/discovery details and degraded reasons
  - `notificationSent`: whether a tool-list-changed notification was emitted
- **Validation Rules**:
  - `success` requires live engine reachability and discovered tool registration for the session
  - `notificationSent` must be true on successful load and successful refresh that changes the visible tool surface

## Tool Schema Inspection Request

- **Purpose**: Defines access to fuller per-tool schema detail after compressed discovery.
- **Fields**:
  - `toolName`: published tool name requested
  - `sessionId`: requesting session
  - `detailLevel`: `full` or `debug`
  - `resolvedEngine`: owning engine or tool family
  - `schemaPayload`: returned fuller schema and descriptive text
- **Validation Rules**:
  - `toolName` must resolve within the requesting session tool surface or be a visible deferred/core indicator that supports inspection
  - `schemaPayload` must use standard MCP responses, not a custom side channel

## State Transitions

- `Tool Surface Policy` + live runtime routing context -> `Session Tool Surface` at MCP session start
- `Session Tool Surface` + `Lazy Load Operation (success)` -> updated `Session Tool Surface` plus tool-list-changed notification
- `Tool Surface Policy` update -> new `policyVersion` for future operations; explicit refresh required before mutating already-loaded groups in a session
- `Compressed Tool Descriptor` -> `Tool Schema Inspection Request` when a client/operator asks for fuller schema detail