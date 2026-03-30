# Research: Route-Level Cost Hints with Runtime Telemetry and Adaptive Rollups

## Decision 1: Keep route telemetry in runtime PostgreSQL with Bun.SQL and raw migrations

- **Decision**: Implement route telemetry as a runtime-owned PostgreSQL subsystem in `packages/runtime`, using Bun.SQL and raw migration files that mirror the skill registry storage pattern.
- **Rationale**: The repository already treats project PostgreSQL as the durable store for repository-scoped indexed state and already has a migration-managed Bun.SQL access pattern. Reusing that pattern keeps storage local, minimizes abstraction sprawl, and aligns telemetry with the existing runtime lifecycle.
- **Alternatives considered**:
  - File-backed cache or JSON snapshots: rejected because it cannot support bounded rollups, durable history, or safe concurrent compaction.
  - New ORM layer: rejected because the repository already standardizes on Bun.SQL plus raw SQL, and an ORM would add more surface area than value.

## Decision 2: Derive snapshots per sanitized request profile, not only per unified tool

- **Decision**: Key rollups and snapshots by `repo_id + unified_tool + profile_key + engine + engine_tool`, where `profile_key` is a stable hash of a sanitized request summary.
- **Rationale**: `find_symbol` and `search_code` mix materially different request shapes. Exact-identifier traffic should not bias fuzzy-search route ordering, and path-anchored queries should not skew global search behavior. Profile-aware snapshots preserve routing quality without storing raw inputs.
- **Alternatives considered**:
  - One snapshot per unified tool and route: rejected because mixed traffic shapes would distort route estimates.
  - Persist raw arguments for exact replay: rejected because the feature is explicitly privacy-bounded and only needs operational metadata.

## Decision 3: Use 7-day raw retention with 15m, 6h, and 1d rollup tiers

- **Decision**: Retain raw events for 7 days, aggregate into 15-minute buckets for 48 hours, 6-hour buckets for 14 days, and 1-day buckets for 90 days, and run compaction every 15 minutes.
- **Rationale**: Seven days of raw events preserves enough local debugging depth without letting a repository-local database grow unbounded. The three-tier rollup model gives fast adaptation from the short horizon, stable medium-term trend smoothing, and low-cost long-horizon inspection well past the required 30 days.
- **Alternatives considered**:
  - 24-hour raw retention: rejected because it leaves too little room for debugging compaction issues and validating adaptive changes across workdays.
  - 30-day raw retention: rejected because it pushes unnecessary storage growth into the local runtime for a feature that only needs fresh detail.
  - Hourly-only rollups: rejected because they are too coarse for adaptive ordering and too fine for long-term retention.

## Decision 4: Run periodic maintenance from the MCP server process, guarded by PostgreSQL advisory locks

- **Decision**: Put the scheduler and compaction logic in `packages/runtime`, but have the long-lived owner be the MCP server process in `apps/server/src/startup/start-server.ts`. Every run acquires a repository-scoped PostgreSQL advisory lock; CLI maintenance commands reuse the same compaction service.
- **Rationale**: The server is the repository’s long-lived process during active MCP usage and is the natural host for periodic work. Advisory locks make repeated or concurrent invocations safe, and runtime lifecycle commands can still perform catch-up checks when operators interact without a continuously running server.
- **Alternatives considered**:
  - Per-write compaction: rejected because it adds latency and unpredictability to the route hot path.
  - CLI-only manual maintenance: rejected because bounded retention would depend on operator discipline.
  - Separate telemetry daemon: rejected because it adds a new long-lived surface and deployment concern for a first-slice feature.

## Decision 5: Use confidence gates that explicitly separate static, insufficient-data, mixed, adaptive, and stale states

- **Decision**: Compute confidence as `0.50 * sampleScore + 0.25 * recencyScore + 0.25 * stabilityScore`, classify `insufficient-data` below 15 attempts, classify `stale` after 72 hours without observations, and require `confidence >= 0.75`, `sample_count >= 50`, `success_rate >= 0.90`, and `volatility_index <= 0.25` for `adaptive`.
- **Rationale**: The feature must avoid overreacting to sparse or stale data. The chosen thresholds favor stable routing until local evidence is strong enough to justify a behavior change, while still allowing a `mixed` state to surface partial adaptation and explainability.
- **Alternatives considered**:
  - Sample-count-only thresholds: rejected because they ignore recency and route volatility.
  - Fully dynamic model selection without fixed gates: rejected because it would be harder to inspect, explain, and test deterministically.

## Decision 6: Limit the first adaptive allowlist to `search_code` and `find_symbol`

- **Decision**: The built-in default allowlist for active adaptive ordering contains only `search_code` and `find_symbol` in the first slice.
- **Rationale**: These are high-value tools with meaningful same-engine route variance and lower semantic-regression risk than cross-engine merged tools. Both can move from current fanout-style behavior to `fallback-only` ordering while keeping deterministic fallback and clear inspection semantics.
- **Alternatives considered**:
  - Include `document_architecture`: rejected for first-slice adaptive execution because it already relies on cross-engine merged evidence and should remain fanout.
  - Include `trace_integration` or `evaluate_codebase`: rejected because they are already multi-step and cross-engine, so adaptive execution change is higher risk.
  - Pilot only one tool: rejected because it would under-sample the storage, scoring, and override model this feature is supposed to establish.

## Decision 7: Put repository overrides under `mcp.routingHints` with additive include/exclude semantics

- **Decision**: Add `mcp.routingHints.adaptiveSubset.include` and `.exclude` to repository config. Effective subset = `(built-in default allowlist + include) - exclude`, constrained to the supported eligible built-in route set.
- **Rationale**: This keeps route-hint behavior near the existing routed MCP policy surface and gives repositories a safe way to opt into or out of supported tools without allowing arbitrary route-policy corruption.
- **Alternatives considered**:
  - Top-level `telemetry` config: rejected because the behavior being overridden is routed MCP execution policy, not general runtime telemetry.
  - Replace-only allowlist override: rejected because it is easier to misconfigure and harder to keep safe as the product adds more eligible built-in tools.
  - Silent ignore of invalid overrides: rejected because config issues must be explicit; instead, invalid entries degrade telemetry health and fall back to defaults.