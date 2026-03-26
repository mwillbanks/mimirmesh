# Contract: Lazy-Loaded MCP Tool Surface and Compression

## Purpose

Defines the external MCP and CLI contract for session-scoped lazy tool registration, compressed metadata delivery, schema inspection, and operator-triggered deferred engine loading.

## MCP Server Contract

### Initial session behavior

When a client starts a new MCP session:

- `listTools()` returns only core unified tools plus required management tools used to inspect deferred groups, load groups explicitly, or request fuller schema detail
- returned tool metadata is compressed according to the configured policy
- each published tool definition retains a concise description field; compression may shorten it, but descriptions are not omitted
- deferred engine groups are advertised as deferred capability, not as already loaded passthrough tools
- startup readiness is not reported healthy until core discoverability validation succeeds

### Lazy-load behavior

When a session explicitly requests a deferred engine group or invokes a deferred tool:

- the server validates engine reachability using live runtime discovery
- the server registers the discovered tools into that session’s visible tool surface only
- the server emits `notifications/tools/list_changed`
- the client must refresh `listTools()` to obtain the updated compressed tool metadata
- the server records structured lazy-load diagnostics including timestamp, engine, tool count, and outcome

### Full schema inspection behavior

The contract must provide a standard MCP-compatible path to retrieve fuller per-tool schema detail after compressed discovery.

Requirements:

- fuller schema access uses standard MCP tool invocation and response structures
- schema inspection works for core tools and for passthrough tools visible in the requesting session
- returned schema detail is sufficient for debugging or detailed invocation planning

## CLI Contract

### Canonical command surfaces

```text
mimirmesh mcp list-tools
mimirmesh mcp load-tools <engine>
mimirmesh mcp tool <tool-name>
mimirmesh mcp tool-schema <tool-name>
```

### Required CLI behaviors

| Command | Required behavior |
|--------|-------------------|
| `mcp list-tools` | Shows visual distinction between core, deferred, and loaded tools/groups and supports compressed vs fuller inspection views |
| `mcp load-tools <engine>` | Performs explicit live discovery for one deferred engine group with visible progress and outcome details |
| `mcp tool <tool-name>` | Invokes unified or loaded passthrough tools and may trigger lazy load when policy allows invocation-driven load |
| `mcp tool-schema <tool-name>` | Displays compressed summary or fuller schema detail for the named tool |

## Machine-Readable Expectations

CLI machine-readable output and MCP structured content must expose at least:

| Field | Meaning |
|------|---------|
| `sessionId` | active MCP session identifier |
| `policyVersion` | current tool-surface policy fingerprint |
| `coreToolCount` | number of core tools currently visible |
| `loadedEngineGroups` | engine groups loaded in this session |
| `deferredEngineGroups` | engine groups still deferred in this session |
| `compressionLevel` | active compression profile |
| `toolCount` | total tools visible in the current session surface |
| `diagnostics` | health and discovery evidence for load or refresh operations |

## Failure and Degraded Semantics

| Condition | Required outcome |
|----------|------------------|
| Deferred engine unreachable | return degraded or failed result with engine-specific diagnostic and no false loaded state |
| Session requests deferred tool while offline | return clear error explaining the tool is not available until connectivity/runtime is restored |
| Policy changes after a group was loaded | future list/load operations use the new policy, but already-loaded groups remain unchanged until explicit refresh |
| Another session loads a group | no change to the current session tool count or visibility unless this session also loads/refreshed that group |
| Notification delivery succeeds but client does not refresh | visible tool surface remains stale until the client issues `listTools()` again |

## Compatibility Requirements

- No proprietary push payload replaces standard MCP notification plus refresh flow
- No custom wire protocol is required for compressed tool metadata or fuller schema retrieval
- Standard MCP clients must be able to consume the feature using `listTools()`, notifications, and normal tool calls
