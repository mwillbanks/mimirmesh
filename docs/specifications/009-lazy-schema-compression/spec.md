# Feature Specification: Token Reduction via Lazy Tool Registration and Schema Compression

**Feature Branch**: `009-lazy-schema-compression`  
**Created**: 2026-03-25  
**Status**: Draft  
**Input**: User description: "Reduce token count by implementing R1 (MCP Lazy Tool Registration) and R2 (Tool Schema Compression Layer) from the Roadmap Backlog which will lower default tool/schema footprint per session."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agent Starts Session with Minimal Tool Surface (Priority: P1)

An AI agent initiates a task session with MímirMesh. Rather than loading all available tools upfront, the system exposes only the core, most commonly-used routed tools and defers loading engine-specific passthrough tool groups until explicitly needed by the agent. This dramatically reduces initial context overhead and allows the agent to focus on the task without bloated tool inventory.

**Why this priority**: Baseline token reduction. Most agents never use more than 20-30% of available tools per session. Early availability of core tools enables task execution while lazy-loaded passthrough tools remain available on-demand. This is the foundation for both R1 and R2 impact.

**Independent Test**: Can be fully tested by initiating an agent session, measuring the initial tool surface size, and verifying that only core routed tools are exposed until a passthrough invocation is triggered.

**Acceptance Scenarios**:

1. **Given** an agent starts a new session, **When** the MCP server initializes, **Then** only core unified routed tools are listed and compressed schemas are transmitted to the client.
2. **Given** initial tool discovery is complete, **When** the agent measures context overhead, **Then** tool/schema tokens are reduced by at least 35% compared to eager loading baseline.
3. **Given** initial tool surface is active, **When** the agent encounters a tool it doesn't recognize, **Then** the system provides clear indication that additional tools exist and can be loaded on demand.

---

### User Story 2 - Agent Triggers Lazy Loading of Passthrough Tools (Priority: P1)

An agent determines it needs a capability from a specific engine (e.g., `srclight_*` tools from Srclight engine, or `document_*` tools from document-mcp). The agent or router explicitly requests tools from that engine group. The system then discovers and registers only that engine's tools, compressing their schemas and making them available for use.

**Why this priority**: Enables on-demand capability discovery. Without this, either all tools are eagerly loaded (high baseline token cost) or tools are unavailable until manually configured. Lazy loading balances availability with efficiency.

**Independent Test**: Can be fully tested by (1) starting a session, (2) invoking a tool from a deferred passthrough group, and (3) verifying that the requested tools are discovered, registered, and usable in a single operation without requiring manual re-initialization.

**Acceptance Scenarios**:

1. **Given** a session has core tools active, **When** the agent requests a tool from an unloaded passthrough group (e.g., srclight tools), **Then** the system automatically discovers and registers only that engine group's tools.
2. **Given** passthrough tools have been lazily loaded, **When** the agent invokes one of those tools, **Then** the tool executes successfully and returns results.
3. **Given** lazy loading occurs, **When** the load completes, **Then** the client is notified of discovery results and the newly available tool surface is presented (compressed).

---

### User Story 3 - Client Receives Compressed Tool Schemas (Priority: P1)

The MCP server exposes a schema compression layer that reduces tool description and parameter schema verbosity. Tool descriptions are deduplicated, abbreviated summaries are offered, and redundant schema details are removed. Clients receive the compressed payload, reducing token overhead during tool listing and discovery phases.

**Why this priority**: Direct token reduction mechanism. Schema descriptions often account for 40-50% of tool metadata overhead. Compression across all tools (core and lazy) provides immediate per-session savings regardless of whether passthrough tools are loaded.

**Independent Test**: Can be fully tested by (1) comparing schema payloads with and without compression, (2) verifying that compressed schemas retain sufficient semantic meaning for agent decision-making, and (3) measuring total token reduction across a typical tool inventory.

**Acceptance Scenarios**:

1. **Given** the MCP server prepares tool metadata, **When** schema compression is applied, **Then** descriptions are shortened, synonymous text is deduplicated, and property details are abbreviated.
2. **Given** compressed schemas are transmitted to a client, **When** the client parses tool metadata, **Then** the client can determine tool purpose and required parameters without ambiguity.
3. **Given** a typical tool inventory (50+ tools across engines), **When** compression is applied, **Then** schema payload size is reduced by at least 40% compared to uncompressed baseline.

---

### User Story 4 - System Gracefully Handles Offline or Limited Communication (Priority: P2)

An agent is operating in a constrained environment where communication with MímirMesh is intermittent or bandwidth-limited. The compressed schemas and lazy-loaded tool groups allow the agent to continue operating with a minimal, high-value tool surface without repeatedly re-requesting full tool inventories. The system provides explicit indication of deferred tools and graceful fallback behavior.

**Why this priority**: Operational resilience. Constrained environments (embedded systems, high-latency networks, rate-limited APIs) benefit most from reduced upfront context and explicit defer semantics. Lower priority than baseline reduction, but important for reliability in degraded scenarios.

**Independent Test**: Can be fully tested by simulating bandwidth or latency constraints, verifying that the agent can execute core tasks without requiring repeated metadata requests, and confirming that deferred tool availability is clearly communicated.

**Acceptance Scenarios**:

1. **Given** communication is bandwidth-constrained, **When** the agent session starts, **Then** only compressed core tool schemas are transmitted.
2. **Given** the agent needs a passthrough tool while bandwidth is limited, **When** the agent requests lazy loading, **Then** the system loads only that specific engine group and minimizes redundant metadata transmission.
3. **Given** the system detects communication failure during lazy loading, **When** the user checks runtime status, **Then** a clear diagnostic indicates which tool groups are unavailable and why.

---

### User Story 5 - Operator Configures Compression and Lazy Loading Policies (Priority: P2)

An operator managing a MímirMesh instance can configure which tools are core (always available), which are deferred (lazy-loaded on demand), which schemas are compressed, and how aggressively compression is applied. Policies are stored in `.mimirmesh/config.yml` and can be updated without runtime restart.

**Why this priority**: Operational flexibility. Different deployment contexts (single-agent research vs. high-throughput routing) may prefer different compression/deferral tradeoffs. Lower priority than baseline functionality but necessary for production operational control.

**Independent Test**: Can be fully tested by modifying config policies, reloading runtime state, and verifying that the new policies are applied to subsequent tool discovery and compression operations.

**Acceptance Scenarios**:

1. **Given** configuration enables custom compression policies, **When** the operator edits config to mark certain tools as core vs. deferred, **Then** the updated policies are reflected in the next MCP server initialization.
2. **Given** compression policies are configured, **When** the operator sets a compression level (e.g., aggressive, balanced, minimal), **Then** schema payload size matches the configured threshold.
3. **Given** policies have changed, **When** an existing agent session queries tools, **Then** the session respects the updated configuration without requiring reconnection.

---

### Edge Cases

- What happens when an agent requests a passthrough tool during lazy loading but the engine is unavailable?
  - **Expectation**: System reports engine as unavailable and provides alternative routed tools for the same capability, or explicitly surfaces degraded mode.

- How does the system handle conflicting tool names between core routed tools and lazily-loaded passthrough tools?
  - **Expectation**: Passthrough tools are namespaced (e.g., `srclight_search` vs. `search`). Documentation clarifies precedence and avoids collisions.

- What happens when an agent is offline and requests a tool that hasn't been lazily loaded yet?
  - **Expectation**: System fails gracefully with clear error indicating the tool is not currently available and would require connectivity to load.

- How are compressed schemas decompressed or expanded if an agent needs full context for debugging or detailed parameter documentation?
  - **Expectation**: System provides a way to request uncompressed schema for specific tools without re-initializing entire tool surface.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose a core set of unified routed tools on MCP server startup, without loading engine passthrough tool groups.
- **FR-002**: System MUST defer engine-specific passthrough tool groups and load them only when explicitly requested by name or invocation.
- **FR-003**: Upon lazy load request, system MUST discover all tools available in the requested engine group and register them in the MCP tool registry without restarting the server.
- **FR-004**: System MUST apply schema compression to all tool metadata (descriptions, parameters, return types) by default.
- **FR-005**: Compressed schemas MUST retain sufficient detail for agents to determine tool purpose, required parameters, and return type without external documentation.
- **FR-006**: System MUST track which tool groups have been lazily loaded and MUST NOT re-discover or re-load already-loaded groups unless explicitly refreshed.
- **FR-007**: System MUST provide machine-readable tool metadata that distinguishes core tools from deferred tools and includes indicators of deferred group membership.
- **FR-008**: Configuration in `.mimirmesh/config.yml` MUST control which tools are core vs. deferred, compression policies, and deferred-tool visibility.
- **FR-009**: System MUST validate configuration before applying changes and report validation errors clearly.
- **FR-010**: Upon lazy load completion, system MUST notify connected clients of available new tools and updated schema metadata (compressed).

### Runtime Truth and Validation Requirements *(mandatory for runtime, MCP, adapter, or orchestration features)*

- **RTV-001**: Core tool availability MUST be validated at MCP server startup and reported healthy only after core tools are proved discoverable from their engines.
- **RTV-002**: Passthrough tool discovery MUST occur on demand and MUST validate that the requested engine is reachable before reporting newly-loaded tools as available.
- **RTV-003**: Schema compression logic MUST be exercised during tool discovery to ensure that compressed schemas remain semantically lossless for agent decision-making.
- **RTV-004**: System MUST NOT rely on hard-coded tool inventories; all tool availability MUST be validated against live engine endpoints.
- **RTV-005**: Lazy load operations MUST be logged with timestamps, engine names, tool counts, and success/failure status.
- **RTV-006**: Runtime status queries MUST report which engines have been loaded, which are deferred, and any health issues affecting tool availability.
- **RTV-007**: Feature documentation under `docs/features/` MUST be updated with observed tool discovery, compression behavior, lazy loading flow, and operational checkpoints.

### CLI Experience Requirements *(mandatory for CLI, TUI, interactive workflow, or operator-facing command features)*

- **CLI-001**: Commands that list tools MUST show a visual distinction between core tools and deferred tools (e.g., icons, colors, groups).
- **CLI-002**: When a client discovers deferred tools, the CLI MUST clearly indicate which engines are available for lazy loading and provide guidance for triggering load.
- **CLI-003**: Long-running lazy load operations (discovery + registration) MUST display progress spinners and status updates until completion.
- **CLI-004**: Tool schema display in CLI MUST show both compressed and full-detail options, with clear indication of which view is active.
- **CLI-005**: Configuration editing for tool policies MUST be supported via interactive prompts or direct config file editing, with validation feedback.
- **CLI-006**: Runtime diagnostics commands MUST report tool availability state, compressed vs. uncompressed schema counts, and loaded vs. deferred engine groups.

### Key Entities

- **Tool Metadata**: Schema, description, parameters, return type, namespace/origin. Compressed version strips verbose descriptions and deduplicates redundant details.
- **Engine Group**: Logical grouping of tools from a single MCP engine (e.g., Srclight, document-mcp, custom user servers). Can be core or deferred.
- **Compression Policy**: Configuration controlling what kinds of descriptions are abbreviated, how aggressively deduplication is applied, and whether compression is enabled per-tool or globally.
- **Lazy Load Context**: Tracks which engine groups have been loaded in current session, timestamp of last load, and health status of each group.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Default tool/schema context per session is reduced by at least 35% compared to eager-load baseline (with core tools only, no passthrough loaded).
- **SC-002**: When passthrough tool groups are lazy-loaded on demand, total session token cost remains lower than pre-implementation baseline even after loading multiple groups.
- **SC-003**: Lazy load operations (discovery + registration) complete in under 2 seconds for typical engine groups on standard network conditions.
- **SC-004**: 100% of compressed schemas are validated to retain sufficient detail for agent tool selection without external reference.
- **SC-005**: Configuration changes to tool policies are applied without MCP server restart and are reflected in client tool listings within 5 seconds.

### Runtime Validation Outcomes *(mandatory for runtime, MCP, adapter, or orchestration features)*

- **RVO-001**: Tool discovery reports only live-discovered engine capabilities; core tool surface includes zero synthetic or pre-defined tool stubs.
- **RVO-002**: Runtime readiness is reported as healthy only after core tools are validated as discoverable from their source engines.
- **RVO-003**: Lazy load operations include explicit diagnostics showing which tools were discovered, which engines were queried, and any engines that failed discovery.
- **RVO-004**: Schema compression is validated in test scenarios to confirm that compression ratios meet 40%+ target without semantic loss.
- **RVO-005**: Documentation under `docs/features/` is updated and validated to match observed MPC tool registry behavior, lazy load feedback, and diagnostic output.

### CLI Experience Outcomes *(mandatory for CLI, TUI, interactive workflow, or operator-facing command features)*

- **CLO-001**: Operators can identify core vs. deferred tools visually in `mimirmesh tools list` output without ambiguity.
- **CLO-002**: Operators can trigger lazy loading via a single command (e.g., `mimirmesh tools load srclight`) and monitor progress until completion.
- **CLO-003**: Configuration of tool policies is guided via interactive prompts that prevent invalid states and require explicit confirmation.
- **CLO-004**: Help text and documentation clearly explain deferred tool behavior and how compression impacts schema detail.
- **CLO-005**: Diagnostic output from `mimirmesh status` and related commands explicitly lists loaded vs. deferred engine groups and any health/availability issues.
