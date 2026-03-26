# Phase 0 Research: Token Reduction via Lazy Tool Registration and Schema Compression

## Decision 1: Use a hybrid direct-tool surface with compressed metadata, not a two-tool proxy-only surface

- **Decision**: Keep core unified tools and lazily loaded passthrough tools individually registered and invocable, but compress their list metadata and add a standard MCP-compatible on-demand schema inspection path for fuller detail.
- **Rationale**: The spec requires core tools to remain directly visible and deferred passthrough groups to become visible after refresh. Atlassian's `mcp-compressor` pattern is still useful, but in this repo it should inform metadata compression and full-schema retrieval rather than collapsing the entire tool surface into `get_tool_schema` and `invoke_tool` only.
- **Alternatives considered**:
  - Full wrapper-only proxy surface: rejected because it conflicts with the clarified requirement that core and loaded passthrough tools remain visible as tools.
  - No schema inspection helper: rejected because compressed metadata alone would not satisfy the requirement for fuller per-tool schema access when needed.

## Decision 2: Use MCP `notifications/tools/list_changed` and standard client refresh behavior for lazy-load visibility

- **Decision**: Emit the standard MCP tool-list-changed notification after session-scoped lazy-load or explicit refresh events and rely on normal `listTools()` refresh behavior for clients to retrieve updated compressed metadata.
- **Rationale**: The TypeScript SDK supports automatic `listChanged.tools` refresh handling and manual notification handlers for list-changed server events. This matches the clarified requirement for MCP-compatible notification without a proprietary pushed payload.
- **Alternatives considered**:
  - Push a custom tool payload to clients: rejected because it creates a MímirMesh-only protocol extension.
  - Require polling only: rejected because it weakens freshness and operator feedback despite protocol support for list-changed notifications.

## Decision 3: Build session-scoped tool surfaces on top of live runtime routing state

- **Decision**: Represent deferred-tool visibility as a session-local overlay that starts with compressed core tools and grows when a session loads an engine group; do not mutate the global runtime routing table for per-session visibility.
- **Rationale**: The current router reads unified tools plus runtime-global passthrough routes at server startup. The clarified spec requires loading a deferred group in one session not to increase the visible tool count of another session, so per-session overlays are necessary. Because the MCP server process already records session state and the feature is stdio-based, in-memory session surfaces are the smallest correct extension.
- **Alternatives considered**:
  - Server-global lazy loading: rejected because it violates the clarified session-isolation requirement.
  - Persist every session surface as the source of truth on disk: rejected because visibility must be process/session-local and should not replace live runtime discovery truth.

## Decision 4: Add a dedicated MCP/tooling policy section to config schema

- **Decision**: Extend `.mimirmesh/config.yml` with an explicit MCP/tooling policy object that captures core-vs-deferred engine policy, compression level/profile, deferred visibility, schema inspection behavior, and refresh policy.
- **Rationale**: Existing config schema has runtime, engines, logging, templates, and IDE sections but no dedicated place for tool-surface policy. A first-class schema object keeps validation deterministic, supports live policy reload, and avoids overloading runtime or logging config.
- **Alternatives considered**:
  - Store tool policy under `runtime`: rejected because runtime health and compose state are different concerns from tool metadata presentation and session behavior.
  - Store tool policy in ad hoc JSON sidecar state: rejected because the spec requires `.mimirmesh/config.yml` to control these policies and validation errors clearly.

## Decision 5: Centralize compression formatting and lazy-load orchestration in `packages/mcp-core`

- **Decision**: Put tool metadata compression, deferred-group classification, session-surface assembly, and lazy-load coordination in `packages/mcp-core`, while `apps/server` remains responsible for MCP transport/bootstrap and `packages/runtime` remains responsible for live engine discovery and persisted diagnostics.
- **Rationale**: `apps/server/src/startup/start-server.ts` already performs eager registration and should not become the long-term home for compression policy, session cache logic, or refresh sequencing. `packages/mcp-core` already owns routing and tool invocation and is the right boundary for these reusable semantics.
- **Alternatives considered**:
  - Keep everything in `start-server.ts`: rejected because it creates a junk-drawer bootstrap file and violates the repo’s modularity rules.
  - Push compression into `packages/runtime`: rejected because runtime owns discovery truth and state, not the higher-level MCP tool surface contract.

## Decision 6: Reuse current CLI MCP workflows and add explicit deferred-group loading plus schema-view toggles

- **Decision**: Extend existing CLI MCP workflows in `apps/cli/src/workflows/mcp.ts` and related commands to show core/deferred/loaded state, allow explicit deferred-engine loading, and support compressed vs full schema inspection without creating a parallel command family.
- **Rationale**: The current CLI already has MCP inspection and invocation workflows. Extending those workflows preserves shared state/presentation semantics required by the constitution and avoids unnecessary command-surface sprawl.
- **Alternatives considered**:
  - Create a new standalone tools namespace unrelated to current MCP workflows: rejected because it duplicates CLI behavior and increases navigation complexity.
  - Rely only on automatic lazy loading via `mcp tool`: rejected because the spec also requires explicit operator-facing load and diagnostic flows.

## Decision 7: Encode execution-skill gates directly into the feature artifacts

- **Decision**: Treat execution skills as part of the feature contract: implementation runs under `agent-execution-mode` `hardening`, completion is followed immediately by `agentic-self-review`, and design/validation must explicitly reference `code-discipline`, `repo-standards-enforcement`, `mm-unit-testing`, and `biome-enforcement`.
- **Rationale**: The user explicitly requested these skills be required by the specification and plan. Making them part of the delivery contract ensures `tasks.md`, implementation, and final validation cannot ignore them.
- **Alternatives considered**:
  - Keep the skills implicit in agent behavior only: rejected because that would not satisfy the requirement that the specification itself require them.
  - Mention the skills only in tasks later: rejected because execution governance should be visible already in spec and plan.

## Decision 8: Test session isolation and local-state behavior using CI-safe mocks first

- **Decision**: Treat session-surface logic, config reloads, notification triggering, and tool compression as regular package/app tests with mocked `.mimirmesh`, runtime routing files, bridge health, and discovery responses; reserve integration tests for real runtime and cross-process verification only where mocking cannot prove the behavior.
- **Rationale**: The `mm-unit-testing` rules require regular tests to avoid local `.mimirmesh`, Docker, and ambient runtime state. Most of the feature is deterministic logic around routing, configuration, and notification orchestration and should be covered in fast unit/workflow tests.
- **Alternatives considered**:
  - Push most coverage into integration tests: rejected because it would make CI behavior brittle and violate the repo’s testing policy.
  - Skip real-runtime integration checks entirely: rejected because runtime truth and observed diagnostics still need at least focused integration coverage.