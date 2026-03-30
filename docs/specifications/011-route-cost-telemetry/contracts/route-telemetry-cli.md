# Contract: CLI Route Telemetry Surfaces

## Purpose

Define the committed CLI inspection and maintenance surfaces for route telemetry.

## Inspection Command

```bash
mimirmesh mcp route-hints <unifiedTool> \
  [--route <engine>:<engineTool>] \
  [--profile <profileKey>] \
  [--include-rollups] \
  [--limit-buckets <n>] \
  [--json]
```

### Behavior

- Default mode is human-readable and shows current ordering, canonical `sourceMode`, operator-facing `sourceLabel`, `freshnessState`, `freshnessAgeSeconds`, confidence, sample counts, recent route performance, subset eligibility, and telemetry health warnings.
- Omitting `--profile` returns a summary view across recorded profile keys for the selected unified tool.
- Providing `--profile <profileKey>` returns a deterministic profile-scoped inspection view.
- `--json` returns the same semantic payload exposed by the MCP inspection tool.
- `--include-rollups` appends recent 15m, 6h, and 1d summaries.
- Inspection output also includes a maintenance-status block with compaction timestamps, `compactionProgress`, retention windows, overdue context, and `affectedSourceLabels`.

## Maintenance Commands

### Compact / Refresh Rollups

```bash
mimirmesh runtime telemetry compact \
  [--scope repo|tool|route] \
  [--tool <unifiedTool>] \
  [--route <engine>:<engineTool>] \
  [--non-interactive] \
  [--json]
```

### Clear Telemetry

```bash
mimirmesh runtime telemetry clear \
  --scope repo|tool|route \
  [--tool <unifiedTool>] \
  [--route <engine>:<engineTool>] \
  [--non-interactive] \
  [--json]
```

## Scope Rules

- `repo`: affects the full repository telemetry store
- `tool`: requires `--tool`
- `route`: requires both `--tool` and `--route`

## Safety Rules

- `clear` is destructive and prompts for confirmation unless `--non-interactive` is provided.
- Interactive `clear` requires explicit scope review and confirmation before execution.
- `compact` is idempotent and safe to rerun.
- Both commands show progress, outcome, affected scope, and any degraded telemetry state.

## Failure Reporting

- Lock contention reports that maintenance is already running and returns a degraded outcome, not silent success.
- Invalid scope arguments fail fast with actionable guidance.
- Invalid route-subset overrides are reported as warnings and the built-in default allowlist remains active.

## State Presentation Rules

- Machine-readable payloads use canonical state fields: `sourceMode`, `freshnessState`, and `telemetryHealth.state`.
- Human-readable output maps `sourceMode` to operator-facing labels: `static` -> `seed-only`, `insufficient-data` -> `sparse`, `mixed` -> `mixed`, `adaptive` -> `adaptive`, `stale` -> `stale`.