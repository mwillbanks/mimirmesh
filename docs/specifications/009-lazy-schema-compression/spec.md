# Feature Specification: Token Reduction via Lazy Tool Registration and Schema Compression

**Feature Branch**: `009-lazy-schema-compression`  
**Created**: 2026-03-25  
**Status**: Draft  
**Input**: User description: "Reduce token count by implementing R1 (MCP Lazy Tool Registration) and R2 (Tool Schema Compression Layer) from the Roadmap Backlog which will lower default tool/schema footprint per session."

## Clarifications

### Session 2026-03-25

- Q: Should schema compression remain standard MCP-compatible or introduce a MímirMesh-specific compressed protocol? → A: Preserve the standard MCP tool contract for all clients, using an Atlassian mcp-compressor-style approach where compression is applied through MCP-compatible proxying/wrapping and on-demand full-schema retrieval rather than a custom client-only protocol.
- Q: How should compression and lazy-loading policy changes propagate to active sessions? → A: Apply policy changes live to future tool-list and lazy-load operations in existing sessions, but do not rewrite already-loaded tool groups until an explicit refresh is requested.
- Q: How should connected clients learn that a deferred engine group was loaded? → A: Emit a standard MCP-compatible tool-availability-changed notification and require clients to refresh their tool list to fetch updated compressed metadata.
- Q: Should lazy-loaded engine groups be scoped to the requesting session or shared across all connected clients? → A: Lazy-loaded engine groups are session-scoped and visible only to the requesting client session.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agent Starts Session with Minimal Tool Surface (Priority: P1)

An AI agent initiates a task session with MímirMesh. Rather than loading all available tools upfront, the system exposes only the core, most commonly-used routed tools and defers loading engine-specific passthrough tool groups until explicitly needed by the agent. This dramatically reduces initial context overhead and allows the agent to focus on the task without bloated tool inventory.

**Why this priority**: Baseline token reduction. Most agents never use more than 20-30% of available tools per session. Early availability of core tools enables task execution while lazy-loaded passthrough tools remain available on-demand. This is the foundation for both R1 and R2 impact.

**Independent Test**: Can be fully tested by initiating an agent session, measuring the initial tool surface size, and verifying that only core routed tools are exposed until a passthrough invocation is triggered.

**Acceptance Scenarios**:

1. **Given** an agent starts a new session, **When** the MCP server initializes, **Then** only core unified routed tools plus required management tools are listed and compressed schemas are transmitted to the client.
2. **Given** initial tool discovery is complete, **When** the agent measures context overhead, **Then** tool/schema tokens are reduced by at least 35% compared to eager loading baseline.
3. **Given** initial tool surface is active, **When** the agent encounters a tool it doesn't recognize, **Then** the system provides clear indication that additional tools exist and can be loaded on demand.

---

### User Story 2 - Agent Triggers Lazy Loading of Passthrough Tools (Priority: P1)

An agent determines it needs a capability from a specific engine (e.g., `srclight_*` tools from Srclight engine, or `document_*` tools from document-mcp). The agent or router explicitly requests tools from that engine group. The system then discovers and registers only that engine's tools, compressing their schemas and making them available for use within that requesting session.

**Why this priority**: Enables on-demand capability discovery. Without this, either all tools are eagerly loaded (high baseline token cost) or tools are unavailable until manually configured. Lazy loading balances availability with efficiency.

**Independent Test**: Can be fully tested by (1) starting a session, (2) invoking a tool from a deferred passthrough group, and (3) verifying that the requested tools are discovered, registered, and usable in a single operation without requiring manual re-initialization.

**Acceptance Scenarios**:

1. **Given** a session has core tools active, **When** the agent requests a tool from an unloaded passthrough group (e.g., srclight tools), **Then** the system automatically discovers and registers only that engine group's tools for that requesting session.
2. **Given** passthrough tools have been lazily loaded, **When** the agent invokes one of those tools, **Then** the tool executes successfully and returns results.
3. **Given** lazy loading occurs, **When** the load completes, **Then** the client is notified of discovery results and the newly available tool surface is presented (compressed).
4. **Given** lazy loading completes for a deferred engine group, **When** connected clients receive the MCP-compatible availability change notification, **Then** they can refresh tool listing and retrieve the updated compressed metadata without proprietary push payloads.
5. **Given** one session lazily loads a deferred engine group, **When** another active session lists tools without requesting that group, **Then** the deferred tools remain hidden from the other session.

---

### User Story 3 - Client Receives Compressed Tool Schemas (Priority: P1)

The MCP server exposes a schema compression layer that reduces tool description and parameter schema verbosity. Tool descriptions remain present as abbreviated summaries, synonymous text is deduplicated, and redundant schema details are removed. Clients receive the compressed payload, reducing token overhead during tool listing and discovery phases.

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

An operator managing a MímirMesh instance can configure which tools are core (always available), which are deferred (lazy-loaded on demand), which schemas are compressed, and how aggressively compression is applied. Policies are stored in `.mimirmesh/config.yml` and can be updated without runtime restart. Updated policies apply to future tool-list and lazy-load operations in active sessions, while already-loaded tool groups retain their current registration until explicitly refreshed.

**Why this priority**: Operational flexibility. Different deployment contexts (single-agent research vs. high-throughput routing) may prefer different compression/deferral tradeoffs. Lower priority than baseline functionality but necessary for production operational control.

**Independent Test**: Can be fully tested by modifying config policies, reloading runtime state, and verifying that the new policies are applied to subsequent tool discovery and compression operations.

**Acceptance Scenarios**:

1. **Given** configuration enables custom compression policies, **When** the operator edits config to mark certain tools as core vs. deferred, **Then** the updated policies are reflected in subsequent tool-list and lazy-load operations without requiring MCP server restart.
2. **Given** compression policies are configured, **When** the operator sets a compression level (e.g., aggressive, balanced, minimal), **Then** schema payload size matches the configured threshold.
3. **Given** policies have changed, **When** an existing agent session queries tools, **Then** future queries and lazy-load requests respect the updated configuration without requiring reconnection, while previously loaded groups change only after explicit refresh.

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

- **FR-001**: System MUST expose a core set of unified routed tools plus any required management tools on MCP server startup, without loading engine passthrough tool groups.
- **FR-002**: System MUST defer engine-specific passthrough tool groups and load them only when explicitly requested by name or invocation.
- **FR-003**: Upon lazy load request, system MUST discover all tools available in the requested engine group and register them in the MCP tool registry without restarting the server.
- **FR-004**: System MUST apply schema compression to tool metadata by default while preserving the standard MCP tool contract and SDK compatibility for all clients, including a concise description for every published tool.
- **FR-005**: Compressed schemas MUST retain sufficient detail for agents to determine tool purpose, required parameters, and return type without external documentation, and the system MUST provide an MCP-compatible on-demand path to retrieve fuller per-tool schema detail when needed.
- **FR-006**: System MUST track which tool groups have been lazily loaded and MUST NOT re-discover or re-load already-loaded groups unless explicitly refreshed.
- **FR-007**: System MUST provide machine-readable tool metadata that distinguishes core tools from deferred tools and includes indicators of deferred group membership.
- **FR-008**: Configuration in `.mimirmesh/config.yml` MUST control which tools are core vs. deferred, compression policies, and deferred-tool visibility.
- **FR-009**: System MUST validate configuration before applying changes and report validation errors clearly.
- **FR-010**: Upon lazy load completion, system MUST make newly available tools observable to the requesting client session through refreshed compressed metadata.
- **FR-011**: Compression and deferred schema access MUST follow an MCP-compatible proxy or wrapper pattern similar to Atlassian's `mcp-compressor`: reduce initial metadata verbosity and allow fuller schema retrieval through standard MCP tools and responses rather than a MímirMesh-specific wire protocol.
- **FR-012**: Configuration changes MUST apply live to future tool-list and lazy-load operations in existing sessions without restarting the MCP server, but MUST NOT mutate already-loaded tool groups until an explicit refresh operation is requested.
- **FR-013**: Upon lazy load completion, the server MUST emit an MCP-compatible notification that tool availability has changed; clients MUST obtain updated compressed metadata by issuing a standard tool-list refresh rather than receiving a proprietary pushed tool payload.
- **FR-014**: Lazy-loaded engine groups MUST be tracked and exposed per client session; loading a deferred group in one session MUST NOT expand the visible tool surface of other active sessions.

### Runtime Truth and Validation Requirements *(mandatory for runtime, MCP, adapter, or orchestration features)*

- **RTV-001**: Core tool availability MUST be validated at MCP server startup and reported healthy only after core tools are proved discoverable from their engines and the startup readiness gate has passed.
- **RTV-002**: Passthrough tool discovery MUST occur on demand and MUST validate that the requested engine is reachable before reporting newly-loaded tools as available.
- **RTV-003**: Schema compression logic MUST be exercised during tool discovery to ensure that compressed schemas remain semantically lossless for agent decision-making.
- **RTV-004**: System MUST NOT rely on hard-coded tool inventories; all tool availability MUST be validated against live engine endpoints.
- **RTV-005**: Lazy load operations MUST be logged with timestamps, engine names, tool counts, and success/failure status.
- **RTV-006**: Runtime status queries MUST report which engines have been loaded, which are deferred, and any health issues affecting tool availability.
- **RTV-007**: Feature documentation under `docs/features/` MUST be updated with observed tool discovery, compression behavior, lazy loading flow, and operational checkpoints.
- **RTV-008**: Compatibility validation MUST confirm that standard MCP clients can list tools, retrieve fuller schema detail, and invoke tools without requiring MímirMesh-specific protocol extensions.
- **RTV-009**: Notification validation MUST confirm that a standard MCP-compatible tool-availability-changed signal is emitted after lazy load and that clients can refresh tool metadata successfully using ordinary MCP list-tools behavior.
- **RTV-010**: Session isolation validation MUST confirm that lazy-loaded tool groups are visible only to the requesting session and that concurrent sessions retain independent deferred-tool state.

### Delivery Execution Requirements *(mandatory for implementation planning and execution)*

- **DER-001**: Implementation and hardening for this feature MUST be executed under the `agent-execution-mode` skill in `hardening` mode.
- **DER-002**: After implementation claims completion, execution MUST run the `agent-execution-mode` skill in `agentic-self-review` mode and fix safe findings before concluding.
- **DER-003**: Implementation design and code changes MUST follow the `code-discipline` skill, preferring existing repository primitives, utilities, and package boundaries over new wrappers or helper sprawl.
- **DER-004**: Validation and repository compliance MUST follow the `repo-standards-enforcement` skill, including Bun-native command usage, type safety, and repository-native validation sequencing.
- **DER-005**: Unit and integration test planning for this feature MUST follow the `mm-unit-testing` skill, including CI-safe mocking for `.mimirmesh`, Docker, runtime, and other local state dependencies.
- **DER-006**: Final formatting and lint remediation for changed files MUST follow the `biome-enforcement` skill, including the required JSON-reporter changed-files Biome command and post-Biome revalidation when files change.

### CLI Experience Requirements *(mandatory for CLI, TUI, interactive workflow, or operator-facing command features)*

- **CLI-001**: Commands that list tools MUST show a visual distinction between core tools and deferred tools (e.g., icons, colors, groups).
- **CLI-002**: When a client discovers deferred tools, the CLI MUST clearly indicate which engines are available for lazy loading and provide guidance for triggering load.
- **CLI-003**: Long-running lazy load operations (discovery + registration) MUST display progress spinners and status updates until completion.
- **CLI-004**: Tool schema display in CLI MUST show both compressed and full-detail options, with clear indication of which view is active.
- **CLI-005**: Configuration editing for tool policies MUST be supported via interactive prompts or direct config file editing, with validation feedback.
- **CLI-006**: Runtime diagnostics commands MUST report tool availability state, compressed vs. uncompressed schema counts, and loaded vs. deferred engine groups.
- **CLI-007**: Machine-readable output MUST be supported for read-oriented CLI inspection commands in scope for this feature, specifically `mimirmesh mcp list-tools`, `mimirmesh mcp tool-schema`, and `mimirmesh status`; interactive mutation and load flows MAY remain human-first and are not required to stream machine-readable progress output.

### Key Entities

- **Tool Metadata**: Schema, description, parameters, return type, namespace/origin. Compressed version keeps a concise description, deduplicates redundant details, and remains representable through standard MCP-compatible tool metadata and retrieval flows.
- **Engine Group**: Logical grouping of tools from a single MCP engine (e.g., Srclight, document-mcp, custom user servers). Can be core or deferred.
- **Compression Policy**: Configuration controlling what kinds of descriptions are abbreviated, how aggressively deduplication is applied, and whether compression is enabled per-tool or globally.
- **Lazy Load Context**: Tracks which engine groups have been loaded in current session, timestamp of last load, and health status of each group.
- **Session Tool Surface**: Session-scoped view of core tools plus any deferred engine groups loaded by that specific client session.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Default tool/schema context per session is reduced by at least 35% compared to eager-load baseline (with core tools only, no passthrough loaded).
- **SC-002**: When passthrough tool groups are lazy-loaded on demand, total session token cost remains lower than pre-implementation baseline even after loading multiple groups.
- **SC-003**: Lazy load operations (discovery + registration) complete in under 2 seconds for typical engine groups on standard network conditions.
- **SC-004**: 100% of compressed schemas are validated to retain sufficient detail for agent tool selection without external reference.
- **SC-005**: Configuration changes to tool policies are applied without MCP server restart and are reflected in client tool listings within 5 seconds.
- **SC-006**: After a policy change, existing sessions observe the updated policy for subsequent tool-list and lazy-load operations within 5 seconds, while already-loaded groups remain stable until explicitly refreshed.
- **SC-007**: After a lazy load completes, connected clients can refresh and observe the updated compressed tool inventory within 2 seconds using standard MCP notification plus tool-list refresh flow.
- **SC-008**: In concurrent-session tests, lazy-loading a deferred engine group in one session produces no increase in visible tool count for other active sessions that did not request that group.
- **SC-009**: Delivery artifacts, implementation tasks, and execution validation explicitly encode the required skill workflow: `agent-execution-mode` hardening, post-completion `agentic-self-review`, `code-discipline`, `repo-standards-enforcement`, `mm-unit-testing`, and `biome-enforcement`.

### Runtime Validation Outcomes *(mandatory for runtime, MCP, adapter, or orchestration features)*

- **RVO-001**: Tool discovery reports only live-discovered engine capabilities; core tool surface includes zero synthetic or pre-defined tool stubs.
- **RVO-002**: Runtime readiness is reported as healthy only after core tools are validated as discoverable from their source engines.
- **RVO-003**: Lazy load operations include explicit diagnostics showing which tools were discovered, which engines were queried, and any engines that failed discovery.
- **RVO-004**: Schema compression is validated in test scenarios to confirm that compression ratios meet 40%+ target without semantic loss.
- **RVO-005**: Documentation under `docs/features/` is updated and validated to match observed MPC tool registry behavior, lazy load feedback, and diagnostic output.

### CLI Experience Outcomes *(mandatory for CLI, TUI, interactive workflow, or operator-facing command features)*

- **CLO-001**: Operators can identify core vs. deferred tools visually in `mimirmesh mcp list-tools` output without ambiguity.
- **CLO-002**: Operators can trigger lazy loading via a single command (e.g., `mimirmesh mcp load-tools srclight`) and monitor progress until completion.
- **CLO-003**: Configuration of tool policies is guided via interactive prompts that prevent invalid states and require explicit confirmation.
- **CLO-004**: Help text and documentation clearly explain deferred tool behavior and how compression impacts schema detail.
- **CLO-005**: Diagnostic output from `mimirmesh status` and related commands explicitly lists loaded vs. deferred engine groups and any health/availability issues.
- **CLO-006**: Operators can request machine-readable inspection output from `mimirmesh mcp list-tools`, `mimirmesh mcp tool-schema`, and `mimirmesh status` and receive core/deferred/loaded state plus schema-detail indicators without using interactive parsing.
