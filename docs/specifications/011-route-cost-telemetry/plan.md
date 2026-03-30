# Implementation Plan: Route-Level Cost Hints with Runtime Telemetry and Adaptive Rollups

**Branch**: `011-route-cost-telemetry` | **Date**: 2026-03-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/docs/specifications/011-route-cost-telemetry/spec.md`

## Summary

Implement Route-Level Cost Hints with Runtime Telemetry and Adaptive Rollups as a runtime PostgreSQL telemetry subsystem slice rooted in `packages/runtime`, with Bun.SQL-backed raw event storage, bounded rollups, adaptive hint snapshots, and hint-aware route ordering for a tightly scoped allowlist of built-in unified tools. The implementation keeps merge-oriented tools on existing fanout semantics, adds MCP and CLI inspection through repository-native surfaces, places CLI-only maintenance under `runtime telemetry`, and runs periodic compaction from a runtime-owned service started by the long-lived MCP server process with advisory-lock protection and catch-up checks from runtime lifecycle commands.

## Technical Context

**Language/Version**: TypeScript in a Bun workspace monorepo  
**Primary Dependencies**: Bun runtime + Bun.SQL, Zod, Model Context Protocol TypeScript SDK, Ink, Pastel, `@inkjs/ui`  
**Storage**: Project-scoped PostgreSQL (`mm-postgres`) plus existing `.mimirmesh/runtime/*` evidence files  
**Testing**: `bun test` package-local suites, app tests, and root workflow/integration tests  
**Target Platform**: macOS/Linux developer machines running the project-scoped Docker Compose runtime with stdio MCP clients
**Project Type**: Bun monorepo with CLI app, MCP server app, shared runtime/config/core packages  
**Performance Goals**: meet the spec targets of >=20% median time-to-first-success improvement and >=15% estimated route-cost improvement on the adaptive allowlist; keep hint lookup and scoring on the route hot path lightweight enough to avoid materially increasing per-call overhead  
**Constraints**: no raw request arguments or result payloads in durable telemetry; deterministic fallback preserved; merge semantics preserved for non-allowlisted or fanout tools; periodic maintenance must be idempotent and safe under concurrent callers; CLI maintenance remains operator-only  
**Scale/Scope**: repository-local runtime, three built-in engines, thousands to tens of thousands of route events per active repository, first-slice adaptive allowlist of `search_code` and `find_symbol`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Live discovery gate: Route telemetry observes the live unified routes already emitted from adapter discovery; no engine-owned tool catalog is introduced.
- [x] Upstream runtime gate: No engine runtime emulation is added; the feature consumes existing real upstream containers and bridge calls.
- [x] Readiness gate: Telemetry health is additive to current readiness evidence and cannot replace bootstrap/discovery truth; startup catch-up only annotates telemetry health.
- [x] Degraded truth gate: Maintenance lag, invalid overrides, stale snapshots, and compaction failures are surfaced explicitly through inspection and runtime evidence.
- [x] Local-first gate: Storage remains repository-local in project PostgreSQL; no hosted telemetry or external analytics service is introduced.
- [x] Monorepo boundary gate: persistence and maintenance live in `packages/runtime`, adaptive ordering in `packages/mcp-core`, config in `packages/config`, runnable surfaces in `apps/*`.
- [x] Modularity gate: the plan adds dedicated telemetry services and types instead of growing existing `index.ts` files or the router into a junk drawer.
- [x] CLI experience gate: CLI inspection/maintenance flows reuse `CommandRunner`, the shared CLI state/workflow model, and machine-readable support patterns already used by MCP/runtime commands so direct commands and exposed TUI surfaces remain aligned.
- [x] Testing gate: package-local tests cover config, runtime persistence, mcp-core scoring/order logic, and app-level CLI/server surfaces; root tests cover workflow regression.
- [x] Documentation gate: update `docs/features/mcp-server.md`, `docs/features/cli-command-surface.md`, and `docs/operations/runtime.md` with observed route-hint behavior and telemetry maintenance semantics.

Post-design review: still passes. Plan alignment is validated against the constitution plus accepted ADRs `0001`, `0002`, `0003`, and `0005` already reflected in repository docs.

## Project Structure

### Documentation (this feature)

```text
docs/specifications/011-route-cost-telemetry/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
```text
docs/specifications/011-route-cost-telemetry/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
   ├── route-hints-config.md
   ├── route-hints-mcp.md
   └── route-telemetry-cli.md

packages/config/src/
├── schema/index.ts
├── defaults/index.ts
└── index.ts

packages/runtime/src/
├── services/
│   ├── runtime-lifecycle.ts
│   ├── route-telemetry-store.ts
│   ├── route-telemetry-maintenance.ts
│   ├── route-hint-snapshots.ts
│   └── route-telemetry-health.ts
├── state/
│   ├── route-telemetry-migrations.ts
│   └── route-telemetry.ts
└── types/
   └── index.ts

packages/mcp-core/src/
├── registry/router.ts
├── routing/table.ts
├── routing/hints.ts
├── routing/summaries.ts
└── types/index.ts

packages/mcp-adapters/src/
├── types.ts
└── utils.ts

packages/mcp-adapters/srclight/src/routing.ts
packages/mcp-adapters/document-mcp/src/routing.ts
packages/mcp-adapters/mcp-adr-analysis-server/src/routing.ts

apps/cli/src/
├── commands/mcp/route-hints.tsx
├── commands/runtime/telemetry/
│   ├── compact.tsx
│   └── clear.tsx
├── workflows/mcp.ts
├── workflows/runtime.ts
└── lib/context.ts

apps/server/src/
├── startup/start-server.ts
└── tools/unified/index.ts

packages/runtime/tests/
packages/mcp-core/tests/
apps/cli/tests/
apps/server/tests/
tests/workflow/
```

**Structure Decision**: Keep all reusable telemetry storage, compaction, snapshot derivation, and health logic in `packages/runtime`; keep route instrumentation and adaptive ordering in `packages/mcp-core`; keep seed hints with route metadata in adapter routing files; expose inspection and maintenance only through existing CLI/server app surfaces.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitutional violations are required for this plan.

## Phase 0 Research Summary

### Concrete Decisions

1. **Retention and rollups**
  Raw route events are retained for **7 days**. Rollups are materialized into **15-minute buckets for 48 hours**, **6-hour buckets for 14 days**, and **1-day buckets for 90 days**. Periodic compaction runs every **15 minutes** while the MCP server process is active against a healthy runtime, and lifecycle commands perform catch-up checks when telemetry is overdue.

2. **Snapshot granularity**
  Adaptive hint snapshots are keyed by **repository + unified tool + sanitized request profile + engine + engine tool**. This prevents exact-identifier traffic from skewing fuzzy-search route ordering and preserves privacy by using sanitized profiles instead of raw inputs.

3. **Adaptive confidence thresholds and canonical states**
  Canonical hint source modes are `static`, `insufficient-data`, `mixed`, `adaptive`, and `stale`. Operator-facing display labels map to those states as `seed-only`, `sparse`, `mixed`, `adaptive`, and `stale` respectively. Canonical telemetry health states are `ready`, `behind`, `degraded`, and `unavailable`. Inspection surfaces also expose `freshnessState` as `current`, `aging`, `stale`, or `unknown`, plus `freshnessAgeSeconds`.

  - `static`: zero observations or telemetry cleared
  - `insufficient-data`: fewer than **15** profile-matched attempts
  - `stale`: last observation older than **72 hours**
  - `adaptive`: confidence >= **0.75**, sample count >= **50**, success rate >= **0.90**, volatility <= **0.25**, and last observation within **24 hours**
  - `mixed`: all other non-stale states with at least 15 attempts

  Confidence formula:

  `confidence = 0.50 * sampleScore + 0.25 * recencyScore + 0.25 * stabilityScore`

  where `sampleScore = min(sampleCount / 50, 1)`, `recencyScore = 1.0` for <=24h, `0.5` for <=72h, `0.25` for <=7d, else `0`, and `stabilityScore = max(0, 1 - (failedRate * 1.5 + degradedRate + volatilityIndex))`.

4. **Initial adaptive allowlist**
  The first slice actively reorders only:
  - `search_code`
  - `find_symbol`

  Both use the `fallback-only` strategy in this slice. They are high-frequency, have clear same-engine route alternatives, and carry lower semantic-regression risk than multi-engine or fanout-heavy tools.

5. **Repository overrides**
  Overrides live at `mcp.routingHints.adaptiveSubset` with `include` and `exclude` arrays. Effective subset = `(built-in default allowlist + include) - exclude`, limited to the supported eligible built-in route set. Invalid entries are ignored with explicit warnings and telemetry health degradation, while the router falls back to the built-in allowlist.

6. **Periodic maintenance owner**
  The reusable scheduler and compaction service live in `packages/runtime`; the long-lived owner is `apps/server/src/startup/start-server.ts`, which starts a per-process loop after runtime context is available. Every run acquires a repository-scoped PostgreSQL advisory lock so CLI maintenance commands and the server loop cannot compact concurrently.

### Planned Routing Strategies

| Unified tool | Current behavior | First-slice strategy | Notes |
|--------------|------------------|----------------------|-------|
| `search_code` | Srclight fanout across `hybrid_search` and `semantic_search` | `fallback-only` | Lower-risk conversion; `hybrid_search` and `semantic_search` are near-substitute routes with meaningful cost/latency variance. |
| `find_symbol` | Srclight fanout across `search_symbols`, `get_symbol`, `get_signature` | `fallback-only` | Profile-aware hints separate exact-identifier traffic from fuzzy lookup traffic. |
| `document_architecture` | Cross-engine merge/fanout | `fanout` unchanged | Collect telemetry and expose diagnostics only. |
| `trace_integration` | Cross-engine + multi-step | `fanout` unchanged | Too much semantic regression risk for first-slice adaptive ordering. |
| `evaluate_codebase` | Cross-engine + multi-step | `fanout` unchanged | Keep merge semantics; telemetry only. |

## Phase 1 Design Overview

### Architecture

- **`packages/runtime`** owns schema migration, Bun.SQL accessors, rollup generation, snapshot derivation, maintenance state, advisory locking, and telemetry health summaries.
- **`packages/mcp-core`** instruments unified route attempts, derives sanitized request profiles, resolves the effective allowlist from config, loads snapshots, scores routes, and applies adaptive ordering only when the tool and strategy are eligible.
- **`packages/mcp-adapters`** extend route definitions with execution-strategy and seed-hint metadata instead of burying priors in router helpers.
- **`apps/server`** exposes the MCP inspection tool and hosts the periodic maintenance loop.
- **`apps/cli`** exposes the `mcp route-hints`, `runtime telemetry compact`, and `runtime telemetry clear` workflows using existing `CommandRunner` and workflow evidence patterns.

### Data and Storage Shape

- `route_execution_events`: denormalized event log for attempted routes, storing metadata, sanitized summaries, request profile key, and snapshot context at write time.
- `route_rollup_15m`, `route_rollup_6h`, `route_rollup_1d`: bounded aggregation tables with the same dimensional key and bucket-specific retention.
- `route_hint_snapshots`: current effective route estimate per repository/tool/profile/route.
- `route_telemetry_maintenance`: per-repository maintenance status, lag, lock owner metadata, and last successful compaction markers.

### Effective Cost Scoring

For eligible routes, lower scores win. The scoring inputs are derived from the current snapshot and seed hints:

`effectiveCostScore = 0.45 * tokenScore + 0.30 * latencyScore + 0.25 * reliabilityPenalty + freshnessModifier + cacheModifier`

- `tokenScore`: normalized estimated input + output tokens relative to seed expectations
- `latencyScore`: normalized estimated latency relative to the seed expectation
- `reliabilityPenalty`: `(1 - successRate) * 3 + degradedRate * 1.5`
- `freshnessModifier`: +0.15 for high freshness-sensitive stale routes, +0.05 for medium freshness-sensitive mixed routes, else 0
- `cacheModifier`: -0.15 for high cache affinity, -0.05 for medium cache affinity, else 0

Tie-breaks:
1. lower `effectiveCostScore` by at least `0.05`
2. higher confidence
3. higher static priority
4. stable lexical `(engine, engineTool)` ordering

Fallback semantics:
- `fallback-only`: execute one ordered route at a time until a route returns a usable success (`ok=true`, not unusably degraded, and with surviving result items) or candidates are exhausted
- `fanout`: keep current parallel multi-route behavior and ignore adaptive reordering for execution
- `prefer-first`: reserved in metadata for future expansion; not used by the first adaptive allowlist

### Background Processing

- The periodic cadence is **15 minutes**.
- The server loop starts after router/server initialization and performs an immediate non-blocking catch-up run if maintenance is overdue by more than one cadence.
- Every compaction run acquires a repository-scoped PostgreSQL advisory lock.
- Each run aggregates closed buckets only, refreshes snapshots, prunes expired raw events, prunes superseded fine-grained rollups, updates maintenance state, and logs result summaries.
- If the runtime was offline for a long time, startup catch-up processes bounded batches and leaves telemetry health in `behind` or `degraded` state until fully caught up.
- Compaction failure never blocks route execution; it only degrades telemetry health and inspection output.

### Inspection and Maintenance Surfaces

- **MCP inspection tool**: `inspect_route_hints`
- **CLI inspection command**: `mimirmesh mcp route-hints <unifiedTool> [--route <engine>:<tool>] [--profile <profileKey>] [--include-rollups] [--limit-buckets <n>] [--json]`
- **CLI maintenance command**: `mimirmesh runtime telemetry compact [--scope repo|tool|route] [--tool <unifiedTool>] [--route <engine>:<tool>] [--non-interactive] [--json]`
- **CLI clear command**: `mimirmesh runtime telemetry clear --scope repo|tool|route [--tool <unifiedTool>] [--route <engine>:<tool>] [--non-interactive] [--json]`

Inspection requests are deterministic: omitting `profile` returns a summary view across recorded profile keys for the selected unified tool, while providing `profile` targets one explicit `profileKey`. Inspection responses expose canonical fields (`sourceMode`, `freshnessState`, `telemetryHealth.state`) and operator-facing labels (`sourceLabel`) so human-readable and machine-readable surfaces remain semantically aligned.

Inspection responses also expose a `maintenanceStatus` block with compaction timestamps, a `compactionProgress` summary, last compacted window, configured retention windows, overdue context, and `affectedSourceLabels` so FR-014 is satisfied from the committed CLI and MCP surface.

### Validation Strategy

- Package tests for migrations, Bun.SQL persistence, compaction idempotency, pruning, snapshot derivation, and advisory-lock safety.
- `packages/mcp-core` tests for sanitized summaries, profile-key derivation, allowlist resolution, tie-break behavior, stale/insufficient-data behavior, and deterministic fallback.
- Server tests for `inspect_route_hints` registration and response shape.
- CLI tests/workflow tests for inspection, compact, and clear flows with human-readable and machine-readable outputs.
- Live validation includes bootstrap/readiness evidence checks against a started project runtime plus a scripted static-versus-adaptive comparison harness for `search_code` and `find_symbol` that records the measured SC-001 and SC-002 outcomes.

## Post-Design Constitution Check

- [x] Live discovery remains unchanged; telemetry only consumes live-discovered routes.
- [x] No fake runtime behavior is introduced; maintenance is local and truth-reporting only.
- [x] Readiness truth is preserved because telemetry health is additive, not a substitute for engine readiness.
- [x] CLI additions reuse shared workflows and structured output patterns.
- [x] Package boundaries remain clean and testable.
- [x] Documentation targets are identified and limited to the smallest correct surface.
