# Feature Specification: Route-Level Cost Hints with Runtime Telemetry and Adaptive Rollups

**Feature Branch**: `011-route-cost-telemetry`  
**Created**: 2026-03-27  
**Status**: Draft  
**Input**: User description: "Route-Level Cost Hints with Runtime Telemetry and Adaptive Rollups"

## Clarifications

### Session 2026-03-28

- Q: Which minimum delivery surface should this feature commit to for route telemetry? → A: CLI and MCP for inspection; CLI only for compaction and clear actions.
- Q: How should rollups and compaction run by default? → A: Periodic background cadence while the MCP server process is active against a healthy runtime, plus on-demand.
- Q: What route-execution detail should durable telemetry store? → A: Metadata plus sanitized argument summaries, but no raw arguments or result content.
- Q: How broad should adaptive hinting be in this first slice? → A: A curated high-value subset of eligible unified tools, with others remaining static for now.
- Q: How should the curated adaptive-routing subset be defined in this first slice? → A: Use a built-in default allowlist with optional repository overrides.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Adaptive Route Choice For Repeated Unified Workflows (Priority: P1)

An agent uses a unified MimirMesh tool that has more than one viable route. Over time, MimirMesh should prefer the cheapest viable route when local evidence is strong enough, while still keeping route selection stable and predictable when evidence is weak.

In this first slice, adaptive route selection applies only to a curated high-value subset of eligible built-in unified tools. MimirMesh ships a built-in default allowlist for that subset, and repositories may override the subset within supported eligibility bounds. Other unified tools remain on static ordering until later expansion.

**Why this priority**: This is the direct product outcome for R5. If routing does not measurably improve token efficiency and latency for repeated workflows, the feature does not justify its added telemetry surface.

**Independent Test**: Can be fully tested by running the same unified workflow repeatedly across multiple viable routes, verifying that route order adapts only after enough local evidence exists, and confirming that successful fallback behavior remains intact.

**Acceptance Scenarios**:

1. **Given** a unified tool has multiple viable fallback-ordered routes and one route has a stronger current hint with sufficient confidence, **When** an agent invokes the tool, **Then** MimirMesh tries that lower-cost viable route before the higher-cost fallback alternatives and records why it was preferred.
2. **Given** a unified tool has sparse or stale route history, **When** an agent invokes the tool, **Then** MimirMesh preserves deterministic seeded ordering and reports that adaptive confidence is limited.
3. **Given** the first chosen route fails or degrades, **When** fallback routes remain available, **Then** MimirMesh continues through the deterministic fallback order instead of stopping at the first failed attempt.

---

### User Story 2 - Durable Telemetry History Without Unbounded Growth (Priority: P1)

An operator needs route performance history to survive across sessions and runtime restarts so routing decisions improve over time. That history must remain bounded so the product does not accumulate detailed route events forever.

**Why this priority**: A session-local cache cannot support durable route adaptation or trustworthy operator inspection. Bounded retention is equally important because this feature is intended to be the first slice of a broader telemetry foundation, not a one-off data pile.

**Independent Test**: Can be fully tested by executing unified routes, restarting the runtime, verifying that recent telemetry remains available, then running retention and rollup workflows to confirm that detailed history ages into compact summaries rather than growing without limit.

**Acceptance Scenarios**:

1. **Given** unified route attempts have already been recorded, **When** the runtime restarts and an operator inspects route history, **Then** recent route telemetry and current route hints remain available.
2. **Given** detailed route events have aged beyond the raw-history window, **When** retention maintenance runs, **Then** older detail is replaced by coarser rollups while route trend visibility remains available.
3. **Given** retention maintenance is delayed or unsuccessful, **When** an operator inspects telemetry health, **Then** MimirMesh reports that telemetry maintenance is behind and explains the operational impact.
4. **Given** the MCP server process is active against a healthy runtime and telemetry maintenance is due, **When** the background maintenance cadence runs, **Then** rollups and compaction complete without requiring manual operator intervention.

---

### User Story 3 - Explainable Route Hints And Operator Controls (Priority: P2)

An operator or agent needs to understand why a route is currently ordered first, whether that guidance comes from static expectations or adaptive history, and whether the underlying telemetry is current enough to trust. Inspection should be available through CLI and MCP surfaces, while maintenance actions such as compaction, rollup refresh, and clear-by-scope remain operator CLI workflows.

**Why this priority**: Adaptive routing without explainability turns into hidden behavior. Operators need visibility into confidence, sample size, freshness, and retention state so route ordering becomes measurable and governable instead of mysterious.

**Independent Test**: Can be fully tested by inspecting route hints and ordering reasons for a unified tool, triggering a compaction or rollup refresh, and clearing telemetry for a supported scope to verify that hint state and explanations update correctly.

**Acceptance Scenarios**:

1. **Given** an operator inspects a unified tool or specific route, **When** the inspection completes, **Then** MimirMesh shows current hint values, canonical hint source mode, operator-facing source label, freshness state, freshness age, confidence, sample count, recent route performance, ordering reasons, and telemetry health.
2. **Given** an operator triggers telemetry compaction or rollup refresh, **When** the maintenance action completes, **Then** MimirMesh reports the affected scope, the outcome, and the resulting telemetry status.
3. **Given** an operator clears telemetry for a supported scope, **When** the next route inspection occurs, **Then** the affected routes return to seed-only behavior until fresh evidence is gathered.

---

### User Story 4 - Merge-Safe Routing Semantics (Priority: P2)

Some unified tools should still gather results from multiple routes because merge or fan-out behavior remains the correct user outcome. Adaptive hints should improve route selection where a preferred path exists, but they must not silently collapse route classes whose value depends on multi-route execution.

**Why this priority**: The feature is about better route ordering, not a redesign of merged-route semantics. Preserving the existing routed contract prevents unintended behavior regressions in tools that depend on fan-out evidence.

**Independent Test**: Can be fully tested by exercising both fallback-only tools and merge-oriented tools, verifying that adaptive hints reorder the former when confidence is sufficient while the latter continue using multi-route execution.

**Acceptance Scenarios**:

1. **Given** a unified tool belongs to a merge-oriented or fan-out route class, **When** adaptive hints exist, **Then** MimirMesh preserves multi-route execution instead of forcing a single preferred route.
2. **Given** a fallback-only route class has insufficient adaptive confidence, **When** the tool is invoked, **Then** MimirMesh falls back to deterministic seeded ordering rather than unstable reranking.
3. **Given** static expectations and recent observations disagree within a low-confidence margin, **When** the route is selected, **Then** MimirMesh reports that mixed hints are in effect and keeps ordering stable.

### Edge Cases

- When a unified tool has no local route history yet, MimirMesh uses seed-only ordering and marks the result as low-confidence rather than guessing from noise.
- When route telemetry is stale because the workflow has not been used recently, MimirMesh preserves deterministic ordering and surfaces the staleness state.
- When one route is fast but frequently fails or degrades, reliability penalties outweigh raw speed so the router does not keep preferring an unstable path.
- When retention or rollup maintenance is interrupted, new route events continue to be recorded and inspection surfaces show that compaction is behind.
- When automatic maintenance is overdue, route selection continues using the most recent valid hint state and inspection surfaces mark maintenance as behind.
- When an operator clears telemetry for one route or one unified tool, unrelated route history remains intact.
- When a route class requires fan-out or merge behavior, adaptive hints can inform diagnostics but do not collapse the route class into single-route execution.

## Scope Boundaries

### In Scope

- Establish a reusable runtime telemetry subsystem with route execution as its first domain.
- Record unified route attempts as durable route telemetry.
- Add static seed hints to the curated built-in routes in scope.
- Maintain bounded detailed history plus longer-lived rollups and current hint snapshots.
- Use adaptive route hints to influence fallback-only route ordering for the curated route subset in scope.
- Support repository overrides for the curated adaptive-routing subset within the supported eligible built-in route set.
- Expose inspection, health, compaction, rollup refresh, and clear-by-scope surfaces for route telemetry.
- Run periodic background rollup and compaction maintenance while the MCP server process is active against a healthy runtime, with on-demand operator triggers still available.
- Add tests covering telemetry persistence, rollups, hint derivation, stale-data handling, and deterministic routing behavior.
- Add validation that proves sanitized summaries exclude raw request arguments and raw result content in storage and inspection surfaces.
- Add benchmark validation that compares warmed adaptive ordering against static ordering for the initial allowlist.
- Update documentation for telemetry storage expectations, retention behavior, operator inspection, and route-order explanation.

### Out of Scope

- External observability pipelines or external dashboards.
- Billing-accurate token metering.
- Cross-machine telemetry synchronization.
- A fully generalized implementation of every future telemetry domain.
- Replacing current merged-route semantics.
- Telemetry-driven redesign of user-registered external route management.
- Storage of raw route arguments or result content in durable route telemetry.
- Adaptive hint rollout across every eligible unified tool in this first slice.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: MimirMesh MUST record each unified route attempt as durable repository-scoped telemetry instead of relying on session-local or file-only cache behavior.
- **FR-001a**: Durable route telemetry MUST store metadata and sanitized argument summaries sufficient for routing analysis and operator inspection, and MUST NOT store raw request arguments or raw result content.
- **FR-002**: Route telemetry MUST survive runtime restarts and remain available across later sessions for the same repository.
- **FR-003**: The telemetry model MUST preserve three levels of truth for route behavior: recent detailed events, longer-lived rollups, and current route hint snapshots.
- **FR-004**: Detailed route telemetry MUST be retained only for a bounded recent window and MUST age into coarser rollups so raw history does not grow without limit.
- **FR-005**: The curated high-value subset of built-in unified routes in scope MUST define static seed hints for expected cost and performance posture before local evidence exists.
- **FR-005a**: The curated adaptive-routing subset for this slice MUST start from a built-in default allowlist and MAY be overridden per repository within the supported eligible built-in route set.
- **FR-006**: Current adaptive route hints MUST combine static seed hints with observed route history rather than relying on only one source.
- **FR-007**: Each current route hint MUST expose its canonical source mode as `static`, `insufficient-data`, `mixed`, `adaptive`, or `stale`, its operator-facing source label (`seed-only`, `sparse`, `mixed`, `adaptive`, or `stale`), confidence, sample count, `freshnessState`, `freshnessAgeSeconds`, and ordering rationale.
- **FR-008**: Fallback-oriented unified route classes in the curated route subset MUST use hint-aware ordering that considers estimated route cost, observed latency, and recent success or degraded behavior.
- **FR-008a**: Built-in unified tools outside the effective curated route subset MUST remain on static ordering in this slice while still allowing telemetry inspection where applicable.
- **FR-009**: Sparse, stale, or contradictory telemetry MUST reduce adaptive confidence and return the router to deterministic seeded ordering.
- **FR-010**: When a preferred route fails or degrades, the router MUST continue through deterministic fallback behavior.
- **FR-011**: Route classes that require fan-out or merged results MUST preserve their current multi-route execution behavior even when adaptive hints are available.
- **FR-012**: The router MUST avoid unstable route reordering caused by very small sample sizes, very old observations, or short-lived transient failures.
- **FR-013**: Operators and agents MUST be able to inspect current route hints, canonical hint source mode, operator-facing source label, `freshnessState`, `freshnessAgeSeconds`, confidence, sample counts, recent route performance, ordering reasons, and telemetry health through CLI and MCP inspection surfaces.
- **FR-014**: Operators MUST be able to inspect retention and rollup status through a maintenance-status view that includes canonical telemetry health state (`ready`, `behind`, `degraded`, or `unavailable`), maintenance status timestamps, a `compactionProgress` summary, configured retention windows, overdue context, and any affected operator-facing hint labels such as `seed-only`, `sparse`, or `stale`.
- **FR-015**: Telemetry rollups and compaction MUST run on a periodic background cadence while the MCP server process is active against a healthy runtime.
- **FR-016**: Operators MUST be able to trigger telemetry compaction or rollup refresh on demand through operator CLI workflows.
- **FR-017**: Operators MUST be able to clear route telemetry at least by full repository scope, unified-tool scope, and individual-route scope through operator CLI workflows.
- **FR-018**: Clearing telemetry for a supported scope MUST return the affected routes to seed-only deterministic behavior until fresh evidence is recorded.
- **FR-019**: Route ordering explanations MUST state why a route is currently preferred, skipped, or demoted for inspection, and execution-time reason codes MUST be recorded with route telemetry for later analysis.
- **FR-020**: The first implementation slice MUST establish route execution telemetry as part of a reusable runtime telemetry subsystem so later telemetry-backed capabilities can share retention, rollup, health, and inspection patterns.
- **FR-021**: Documentation and operator guidance MUST describe telemetry storage expectations, rollup behavior, adaptive hint derivation, retention semantics, inspection workflows, and supported maintenance actions.

### Runtime Truth and Validation Requirements *(mandatory for runtime, MCP, adapter, or orchestration features)*

- **RTV-001**: Route telemetry, rollups, and hint snapshots MUST be validated from live unified route executions against the project runtime rather than synthetic in-memory samples alone.
- **RTV-001a**: Validation MUST confirm that durable telemetry persists sanitized summaries and excludes raw route arguments and raw result content.
- **RTV-002**: Route-order explanations MUST be derived from the same live hint state used to choose routes for invocation.
- **RTV-003**: Retention and rollup validation MUST prove that detailed events age out as expected while current hints and route trend summaries remain inspectable.
- **RTV-003a**: Validation MUST prove that periodic background maintenance runs while the MCP server process is active against a healthy runtime, that readiness/status evidence remains truthful during maintenance, and that on-demand maintenance remains available when operators need an immediate refresh.
- **RTV-004**: Sparse, stale, degraded, and contradictory telemetry scenarios MUST be exercised and MUST preserve deterministic routing behavior.
- **RTV-005**: Validation MUST confirm that merge-oriented route classes continue to preserve current fan-out semantics even when adaptive hints are available.
- **RTV-006**: Clear-by-scope and compaction workflows MUST report the exact affected scope, the resulting hint state, and any remaining degraded conditions.
- **RTV-007**: Feature documentation under `docs/features/` and operational guidance MUST be updated with observed route-hint inspection, telemetry health, rollup, compaction, and clear-by-scope behavior.

### CLI Experience Requirements *(mandatory for CLI, TUI, interactive workflow, or operator-facing command features)*

- **CLI-001**: Operator-facing route-hint inspection MUST present current ordering, canonical hint mode, operator-facing source label, `freshnessState`, `freshnessAgeSeconds`, confidence, sample counts, recent route performance, and ordering reasons in structured human-readable output by default.
- **CLI-002**: Long-running telemetry maintenance actions such as compaction, rollup refresh, and clear-by-scope workflows MUST show visible progress indicators until completion, failure, or cancellation.
- **CLI-003**: Interactive maintenance flows MUST require explicit scope selection and confirmation before destructive telemetry-clearing actions are applied.
- **CLI-004**: Machine-readable inspection output MUST be available on supported route-telemetry inspection surfaces and MUST remain semantically equivalent to the default human-readable output.
- **CLI-005**: Warning states such as `seed-only` (`static`), `sparse` (`insufficient-data`), `stale`, and `degraded` MUST be surfaced explicitly with corrective guidance for operators, alongside canonical telemetry health states where applicable.
- **CLI-006**: Inspection and maintenance workflows MUST use the shared CLI state and workflow model so direct commands and any exposed TUI surfaces remain semantically aligned.
- **CLI-007**: Feature documentation MUST describe the operator-visible states, inspection views, maintenance prompts, shared-state usage, TUI/direct-command parity expectations, and machine-readable mode behavior for affected route-telemetry workflows.

### Key Entities *(include if feature involves data)*

- **Route Execution Event**: A durable record of one unified route attempt, including the route used, the invoked unified tool, outcome, timing, estimated cost, and ordering context.
- **Sanitized Argument Summary**: A durable, privacy-bounded summary of route input characteristics that is useful for inspection and analysis without retaining raw request arguments or result content.
- **Route Rollup**: A bounded summary of route behavior for a time window that preserves longer-term performance trends after detailed history ages out.
- **Adaptive Route Hint Snapshot**: The current route-ordering view for a route, combining seed hints with recent rollup evidence and the resulting canonical source mode, operator-facing source label, confidence, and freshness state.
- **Seed Hint**: The built-in starting expectation for a route before enough repository-local evidence exists to adapt ordering.
- **Route Behavior Class**: The classification that determines whether a unified tool should prefer one route first, fall back through an ordered list, or preserve fan-out and merge semantics.
- **Telemetry Scope**: The supported boundary for route-telemetry inspection or clearing, including the full repository, one unified tool, or one specific route.
- **Telemetry Health State**: The reported trust posture for telemetry, using the canonical states `ready`, `behind`, `degraded`, and `unavailable`.

## Assumptions

- The existing project-scoped runtime already provides a durable storage and migration lifecycle suitable for repository-local telemetry.
- Estimated route cost is directional and deterministic; this feature does not require billing-accurate metering.
- Route telemetry is privacy-bounded and stores sanitized request summaries rather than raw request or result payloads.
- Existing unified tools already fall into route behavior classes that can be extended with adaptive ordering without redesigning the routed contract.
- Built-in routes receive initial seed hints in this slice; future external or user-registered routes can adopt the same model later.
- Adaptive hinting expands from a curated built-in route subset first rather than every eligible unified tool at once, and repository overrides can adjust that subset only within the supported eligible built-in route set.
- Operators use repository-aware CLI and MCP inspection surfaces, while telemetry maintenance actions remain operator CLI workflows rather than external dashboard tasks.
- Periodic telemetry maintenance is part of normal healthy MCP server operation against a healthy runtime and is not deferred to per-invocation write paths.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In representative repeated workflows with two or more viable fallback-ordered routes, median time to first successful result improves by at least 20% after telemetry warm-up compared with static-priority ordering alone.
- **SC-002**: In the same validation set for the curated route subset, estimated route cost per successful invocation improves by at least 15% after telemetry warm-up without reducing successful completion rate.
- **SC-003**: 100% of route-hint inspections for a supported scope return canonical hint mode, operator-facing source label, `freshnessState`, `freshnessAgeSeconds`, confidence, sample count, recent performance summary, and current ordering reason.
- **SC-004**: 100% of sparse or stale telemetry validation scenarios fall back to deterministic seeded ordering instead of oscillating between routes.
- **SC-005**: After retention validation runs, detailed route events older than the configured raw-history window are no longer retained while aggregated route history remains available for at least 30 days of local inspection.
- **SC-006**: Route telemetry and current hint state remain available after runtime restart in 100% of validation scenarios.

### Runtime Validation Outcomes *(mandatory for runtime, MCP, adapter, or orchestration features)*

- **RVO-001**: Live unified route invocations create durable telemetry records and updated hint snapshots that remain visible after runtime restart.
- **RVO-002**: Retention and rollup validation shows detailed events shrinking as older history ages while route trend summaries and current hints remain inspectable.
- **RVO-003**: Sparse, stale, degraded, and contradictory telemetry states produce explicit diagnostics and deterministic fallback ordering.
- **RVO-004**: Merge-oriented unified tools continue to return fan-out or merged results instead of collapsing to a single preferred route.
- **RVO-005**: Documentation under `docs/features/` and operational guidance matches the observed route-hint inspection, telemetry health, compaction, and clear-by-scope behavior used during validation.

### CLI Experience Outcomes *(mandatory for CLI, TUI, interactive workflow, or operator-facing command features)*

- **CLO-001**: Operators can identify the canonical hint source mode, the operator-facing source label, and why a route is currently ordered first without ambiguity.
- **CLO-002**: Compaction, rollup refresh, and clear-by-scope workflows present clear progress, affected scope, and final state for every operator action.
- **CLO-003**: Machine-readable inspection output can be consumed by agents without losing any route-hint or telemetry-health semantics from the default human-readable output.
- **CLO-004**: Warning states provide clear corrective guidance when telemetry is seed-only, sparse, stale, or degraded.
