# Feature Specification: Engine-Native Passthrough Namespacing

**Feature Branch**: `007-engine-native-passthrough`  
**Created**: 2026-03-24  
**Status**: Ready for Implementation  
**Input**: User description: "engine-native passthrough namespacing Publish passthrough tools under upstream engine namespace (for example srclight_*) instead of mimirmesh-prefixed pass-through aliases."

## Clarifications

### Session 2026-03-24

- Q: How should legacy `mimirmesh` passthrough aliases behave once engine-native passthrough names are published? → A: Publish only engine-native passthrough names; legacy `mimirmesh` aliases fail with explicit replacement guidance.
- Q: What public naming form should engine-native passthrough tools use? → A: Use underscore engine-native passthrough names such as `<engine>_<tool>`, where the engine segment is determined by the owning engine rather than hardcoded to `srclight`.
- Q: Where should the `<engine>` segment come from? → A: Use the canonical MímirMesh engine ID as the `<engine>` prefix.
- Q: Does the rename need to change internal routing/state identifiers as well as the externally published MCP names? → A: Rename only the externally published MCP passthrough tool names; internal routing/state may keep their current representation if behavior stays correct.
- Q: Which engines does this naming contract apply to? → A: Apply it to all passthrough-capable MímirMesh engines with canonical engine IDs, including future ones.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Engine-Origin Passthrough Names Are Clear (Priority: P1)

As an MCP client or agent using passthrough tools, I need discovered passthrough tools to use the owning engine's native underscore namespace so I can immediately tell which engine owns a tool and invoke it without learning a MímirMesh-specific prefixing scheme.

**Why this priority**: The core value of this change is the public naming contract. If passthrough tools still appear under MímirMesh-specific aliases, the naming model remains inconsistent with engine ownership and the feature does not deliver its main user outcome.

**Independent Test**: Can be fully tested by discovering live passthrough tools from a healthy runtime and verifying that engine-backed passthrough tools are published only under engine-native names while unified tool names remain unchanged.

**Acceptance Scenarios**:

1. **Given** a healthy runtime that has discovered passthrough tools for an engine such as Srclight, **When** an MCP client lists available tools, **Then** the passthrough tools appear under that engine's underscore namespace such as `srclight_search_symbols`, where `srclight` is the canonical MímirMesh engine ID, rather than a `mimirmesh`-prefixed passthrough namespace.
2. **Given** a healthy runtime that has discovered passthrough tools from multiple MímirMesh engines, **When** an MCP client inspects the tool inventory, **Then** each passthrough tool name clearly indicates its owning engine through that engine's canonical MímirMesh engine ID.
3. **Given** a caller uses a unified tool such as repository search or symbol lookup, **When** the request is executed, **Then** the unified tool name and behavior remain unchanged by the passthrough renaming change.
4. **Given** the runtime still stores or routes passthrough capabilities internally using existing identifiers, **When** callers access the MCP surface, **Then** only the published MCP passthrough names change and external behavior remains correct.
5. **Given** a project runtime configuration that includes a passthrough-capable MímirMesh engine with a canonical engine ID and a proxied external MCP server without a canonical MímirMesh engine ID, **When** discovery and tool publication complete, **Then** only the canonical MímirMesh engine publishes passthrough tools in the `<engine>_<tool>` form and the proxied external server remains outside the naming contract.

---

### User Story 2 - Legacy Passthrough Aliases Fail Clearly (Priority: P2)

As an operator or integrator updating existing automation, I need retired `mimirmesh`-prefixed passthrough aliases to fail with explicit rename guidance so I can correct my calls quickly instead of debugging a generic missing-tool failure.

**Why this priority**: Renaming public tool identifiers without a clear failure mode creates unnecessary migration friction and support overhead.

**Independent Test**: Can be fully tested by invoking a retired `mimirmesh`-prefixed passthrough alias after the renamed surface is published and verifying that the response identifies the replacement engine-native name.

**Acceptance Scenarios**:

1. **Given** a caller invokes a retired `mimirmesh`-prefixed passthrough alias, **When** the runtime handles the request, **Then** the caller receives an explicit error that the alias is retired and a replacement engine-native name to use.
2. **Given** a caller invokes an engine-native passthrough tool name such as `<engine>_<tool>`, **When** the tool exists in live discovery, **Then** the request succeeds without requiring any compatibility alias.

---

### User Story 3 - Documentation And Inspection Surfaces Match The New Contract (Priority: P3)

As a contributor or operator reading product documentation and tool listings, I need examples, guidance, and inspection output to show the same engine-native passthrough names that the runtime actually publishes so that operational guidance stays truthful.

**Why this priority**: Passthrough naming is part of the public contract. If docs and inspection surfaces continue to show the old names, users will copy invalid examples and the change will appear broken.

**Independent Test**: Can be fully tested by reviewing server/client documentation and runtime tool-listing output to confirm that examples and described namespaces match the live-discovered published names.

**Acceptance Scenarios**:

1. **Given** the feature is enabled in a healthy runtime, **When** an operator uses tool inspection flows, **Then** the displayed passthrough names match the engine-native names published by discovery.
2. **Given** an operator follows documented passthrough examples, **When** they issue those example calls, **Then** the example names resolve successfully without requiring undocumented translation.
3. **Given** MímirMesh adds a future passthrough-capable engine with a canonical engine ID, **When** that engine's passthrough tools are published, **Then** they use the same `<engine>_<tool>` naming contract without introducing a new naming scheme.

### CLI Interaction Contract

- **Interactive flow**: The feature updates existing passthrough inspection and invocation flows only. Direct commands such as `mimirmesh-client list-tools` and `mimirmesh-client tool <name> ...`, along with local CLI inspection surfaces, remain the primary operator paths for validating published passthrough names.
- **Visible progress and status states**: When runtime bootstrap, discovery, or readiness is still in progress, CLI inspection surfaces MUST report the current status or degraded reason instead of showing a synthetic success state or an unexplained empty passthrough inventory.
- **Shared state model usage**: Full-screen and direct-command CLI surfaces MUST source passthrough publication names, retired-alias guidance, and readiness-derived visibility from the same shared router/context state rather than maintaining separate naming logic.
- **Machine-readable output support**: Any existing machine-readable output mode for tool inspection or invocation MUST emit the same published `<engine>_<tool>` names and retired-alias guidance as the human-readable surfaces.
- **Prompt safety**: This feature does not introduce new prompts; non-interactive passthrough inspection and invocation commands remain prompt-safe and must not block waiting for user input.

**CLI Acceptance Scenarios**:

1. **Given** runtime bootstrap or discovery is still incomplete, **When** an operator inspects tools through a direct command or TUI flow, **Then** the CLI reports the current readiness state and does not display undiscovered passthrough tools as if they were available.
2. **Given** the same runtime state and discovered tool inventory, **When** an operator compares TUI and direct-command inspection flows, **Then** both surfaces show the same published engine-native passthrough names and retired-alias guidance from the shared state model.
3. **Given** a machine-readable output mode is requested for a supported CLI inspection or invocation flow, **When** the output is emitted, **Then** it contains the same engine-native passthrough names and guidance semantics as the human-readable surface with no `mimirmesh`-prefixed passthrough aliases.

### Edge Cases

- What happens when an engine is not healthy or has not completed discovery? No passthrough tools are published for that engine, and the system does not synthesize renamed placeholders.
- What happens when two engines expose the same raw tool name? The published names remain distinct because each tool is qualified by its owning engine prefix in the `<engine>_<tool>` form.
- What happens when a client only supports transport-safe tool identifiers? The published passthrough contract already uses engine-native underscore names, so no alternate dotted passthrough form is required to preserve transport compatibility.
- What happens when a proxied external MCP server does not have a canonical MímirMesh engine ID? This feature does not require it to adopt the `<engine>_<tool>` contract unless it is represented as a passthrough-capable MímirMesh engine.
- What happens when cached documentation, scripts, or tests still reference retired passthrough aliases? They fail with explicit rename guidance rather than silently routing to duplicate aliases.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST publish live-discovered passthrough tools under owning-engine underscore names in the form `<engine>_<tool>`, where `<engine>` is the canonical MímirMesh engine ID, rather than a `mimirmesh`-prefixed passthrough namespace.
- **FR-002**: The system MUST preserve the current unified tool names and unified routing behavior for callers that do not use passthrough tools directly.
- **FR-003**: The system MUST apply the engine-native `<engine>_<tool>` naming model consistently anywhere passthrough tool names are exposed to callers.
- **FR-004**: The system MUST continue to derive passthrough exposure from live discovery only and MUST NOT publish engine-native passthrough names for tools that have not been discovered from a healthy runtime.
- **FR-005**: The system MUST retire `mimirmesh`-prefixed passthrough aliases from the published tool inventory instead of publishing both old and new passthrough names in parallel.
- **FR-006**: When a caller invokes a retired `mimirmesh`-prefixed passthrough alias, the system MUST return explicit rename guidance that identifies the replacement `<engine>_<tool>` name.
- **FR-007**: Tool-listing, inspection, and operator-facing documentation surfaces MUST display the engine-native passthrough names that the runtime actually publishes.
- **FR-008**: The system MUST preserve engine attribution in diagnostics and tool metadata so users can distinguish passthrough tools that originate from different engines.
- **FR-009**: The system MUST derive the public passthrough prefix from the canonical MímirMesh engine ID rather than an upstream runtime-reported label or a user-configured alias.
- **FR-010**: The feature MUST change the externally published MCP passthrough tool names without requiring equivalent renames to internal routing records, discovery state, or persisted runtime artifacts unless those internal changes are necessary to keep external behavior correct.
- **FR-011**: The `<engine>_<tool>` naming contract MUST apply to every passthrough-capable MímirMesh engine that has a canonical engine ID, including future engines added under the same engine model.
- **FR-012**: The feature MUST NOT require arbitrary proxied external MCP servers without canonical MímirMesh engine IDs to adopt the `<engine>_<tool>` naming contract.
- **FR-013**: CLI inspection and invocation surfaces that expose passthrough tools MUST truthfully reflect runtime bootstrap, discovery, and degraded readiness state when determining whether engine-native passthrough tools are visible.
- **FR-014**: Full-screen and direct-command CLI surfaces MUST source passthrough publication names and retired-alias guidance from the same shared state model so users do not see conflicting naming behavior.
- **FR-015**: When a supported machine-readable CLI output mode is requested, the system MUST emit the same published `<engine>_<tool>` names and retired-alias guidance as the human-readable surface without reintroducing retired `mimirmesh`-prefixed passthrough aliases.
- **FR-016**: The feature MUST NOT introduce new interactive prompts for passthrough inspection or invocation flows, and existing non-interactive command paths MUST remain prompt-safe.

### Runtime Truth and Validation Requirements *(mandatory for runtime, MCP, adapter, or orchestration features)*

- **RTV-001**: Engine-owned passthrough capabilities MUST be discovered from live runtime endpoints and exercised successfully in acceptance scenarios using the published `<engine>_<tool>` names.
- **RTV-002**: The system MUST NOT rely on a hard-coded passthrough inventory to publish renamed engine-native tools.
- **RTV-003**: Passthrough publication MUST remain gated on actual runtime readiness and discovery outcome; the naming change MUST NOT cause unpublished tools to appear before discovery succeeds.
- **RTV-004**: Failure responses for retired passthrough aliases MUST report the proven cause and replacement name instead of generic missing-tool errors.
- **RTV-005**: Feature documentation under `docs/features/` MUST be updated with the observed engine-native passthrough naming behavior and retired-alias expectations.
- **RTV-006**: Validation MUST prove that passthrough-capable engines complete required bootstrap and readiness checks before engine-native passthrough names are shown as available in CLI or MCP inspection surfaces.
- **RTV-007**: Validation MUST prove that arbitrary proxied external MCP servers without canonical MímirMesh engine IDs remain outside the `<engine>_<tool>` publication contract.

### Key Entities *(include if feature involves data)*

- **Passthrough Capability**: A live-discovered engine-owned tool exposed directly to callers without unified routing abstraction.
- **Engine Prefix**: The canonical MímirMesh engine ID used as the public prefix in a passthrough name such as `srclight_search_symbols`.
- **Retired Alias**: A previously published `mimirmesh`-prefixed passthrough name that is no longer listed and now exists only as an error-and-guidance compatibility target.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In validation tool inventories, 100% of published passthrough tools use engine-native `<engine>_<tool>` names and 0 published passthrough tools use retired `mimirmesh`-prefixed passthrough aliases.
- **SC-002**: 100% of existing unified tool validation scenarios continue to pass without requiring any caller-visible rename.
- **SC-003**: 100% of tested retired passthrough alias invocations return explicit replacement guidance that names the correct engine-native tool.
- **SC-004**: All operator-facing passthrough examples and inspection surfaces reviewed for this feature match the live published engine-native names.
- **SC-005**: Validation criteria for any future passthrough-capable MímirMesh engine can reuse the same `<engine>_<tool>` naming assertions without defining engine-specific naming exceptions.
- **SC-006**: TUI and direct-command CLI inspection flows present the same engine-native passthrough names, readiness state, and retired-alias guidance for the same runtime state.
- **SC-007**: 100% of validated machine-readable CLI outputs for affected flows use the same engine-native passthrough names as the human-readable contract and 0 retired `mimirmesh`-prefixed passthrough aliases.

### Runtime Validation Outcomes *(mandatory for runtime, MCP, adapter, or orchestration features)*

- **RVO-001**: Tool discovery output reports only live-discovered passthrough capabilities published as `<engine>_<tool>` names and zero synthetic renamed passthrough tools.
- **RVO-002**: Runtime readiness and discovery gates remain unchanged apart from the published passthrough names.
- **RVO-002A**: Existing internal routing/state representations continue to produce correct external MCP publication after the rename.
- **RVO-003**: Retired-alias failure responses include reproducible rename diagnostics validated in tests or workflow output.
- **RVO-004**: Documentation updates under `docs/features/` match the observed published names and failure guidance used during validation.
- **RVO-005**: CLI inspection and invocation surfaces expose engine-native passthrough names only after readiness/bootstrap evidence is present and report degraded or pending state truthfully when it is not.
- **RVO-006**: Validation demonstrates that at least two passthrough-capable MímirMesh engines can reuse the same engine-native naming assertions while non-canonical external MCP servers remain outside the contract.

## Assumptions

- Canonical MímirMesh engine IDs are already stable enough to serve as the public prefix in `<engine>_<tool>` passthrough names.
- The desired public naming model applies to all passthrough-capable MímirMesh engines with canonical engine IDs, not only Srclight, even though Srclight is the primary validated example in this repository.
- Unified tool names remain the preferred agent-facing contract for common workflows; this feature changes passthrough naming only.
- Callers that still use retired passthrough aliases can adapt from explicit rename guidance without requiring dual-publication of old and new passthrough names.
