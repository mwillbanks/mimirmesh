# Validation: Route Telemetry and Adaptive Route Hints

Observed on March 28, 2026.

## Benchmark Evidence

Command:

```bash
bun test tests/workflow/route-telemetry-benchmark.workflow.test.ts
```

Observed results from the live benchmark harness:

| Tool | Warmed Profile Key | Source Mode | Static First Route | Reranked First Route | Static Median Latency (ms) | Reranked Median Latency (ms) | Latency Improvement | Static Estimated Cost | Reranked Estimated Cost | Cost Improvement | Success Rate |
|------|---------------------|-------------|--------------------|----------------------|----------------------------|------------------------------|---------------------|-----------------------|-------------------------|------------------|--------------|
| `search_code` | `6f37063b51e5835ca81b93d128722dfa5667c4f08aee34f2ce53c4a95cfde5f1` | `mixed` | `search_symbols` | `semantic_search` | 5 | 3 | 40.00% | 198 | 112 | 43.43% | 100% -> 100% |
| `find_symbol` | `8a60f0bf1f04b7490f45acf7c676506bbf6578b8d4037f6c649042f35d0abc5e` | `mixed` | `search_symbols` | `get_symbol` | 6 | 3 | 50.00% | 138 | 32 | 76.81% | 100% -> 100% |

The live benchmark harness also reported:

- `warmupCount=20` profile-matched unified invocations per tool before reranked measurement.
- `measurementCount=5` static runs and `5` reranked runs per tool.
- `storedEventCount=55` for each warmed profile after measurement.
- `sanitizedOnly=true` for every stored route execution event inspected after the benchmark run.
- `initialHealthState=degraded` and `postRestartHealthState=degraded` because the optional `document-mcp` engine stayed unavailable in this workspace, while route telemetry and the benchmarked routes remained available.

Success-criteria interpretation:

- `SC-001`: Measured above threshold, but not counted as release-gate pass evidence. Both benchmarked route-hint profiles exceeded the required 20% median time-to-first-success improvement threshold, yet the same benchmark run started and finished with `health.state=degraded`, and the quickstart policy requires a later `ready` run before claiming SC-001 as passed.
- `SC-002`: Measured above threshold, but not counted as release-gate pass evidence. Both benchmarked route-hint profiles exceeded the required 15% estimated route-cost improvement threshold without reducing successful completion rate, yet this remains a degraded-runtime measurement under the quickstart policy.
- `RTV-001`: Pass. The benchmark harness used live unified route executions against the project runtime and verified reranked route choice from persisted route-hint snapshots.
- `RTV-001a`: Pass. The benchmark harness inspected stored route telemetry after the live runs and confirmed `sanitizedOnly=true` for every persisted event.
- `SC-006`: Pass. The warmed route-hint profiles remained inspectable after a real runtime restart, with `storedEventCount=55` retained for both benchmarked profiles.

## Live Operator Evidence

Commands:

```bash
MIMIRMESH_PROJECT_ROOT=/Volumes/Projects/mimirmesh bun run --cwd apps/cli dev runtime status --json
MIMIRMESH_PROJECT_ROOT=/Volumes/Projects/mimirmesh bun run --cwd apps/cli dev mcp tool search_code '{"query":"route telemetry maintenance overdue","limit":5}' --json
MIMIRMESH_PROJECT_ROOT=/Volumes/Projects/mimirmesh bun run --cwd apps/cli dev runtime telemetry compact --scope tool --tool search_code --non-interactive --json
MIMIRMESH_PROJECT_ROOT=/Volumes/Projects/mimirmesh bun run --cwd apps/cli dev mcp route-hints search_code --route srclight:semantic_search --profile 6f37063b51e5835ca81b93d128722dfa5667c4f08aee34f2ce53c4a95cfde5f1 --json
MIMIRMESH_PROJECT_ROOT=/Volumes/Projects/mimirmesh bun run --cwd apps/cli dev runtime telemetry clear --scope tool --tool find_symbol --non-interactive --json
MIMIRMESH_PROJECT_ROOT=/Volumes/Projects/mimirmesh bun run --cwd apps/cli dev mcp route-hints find_symbol --json
```

Observed runtime/status facts:

- `runtime status` reported `health.state=degraded` because the optional `document-mcp` engine was unavailable after the benchmark-triggered restart.
- Docker, the Docker daemon, and Compose were available.
- Three runtime services were healthy: `mm-postgres`, `mm-srclight`, and `mm-adr-analysis`.
- `health.routeTelemetry.state=ready`.
- `health.routeTelemetry.lastSuccessfulCompactionAt=2026-03-28T08:37:40.451Z`.
- `upgradeState=current` and `migrationStatus=none`.

Observed route execution and inspection facts:

- `mcp tool search_code` succeeded on the live repo and returned `5` result items.
- The live `search_code` invocation used the `search_symbols` route first for the current repository state and recorded `profileKey=6f37063b51e5835ca81b93d128722dfa5667c4f08aee34f2ce53c4a95cfde5f1`.
- `runtime telemetry compact --scope tool --tool search_code --non-interactive --json` succeeded with `closedBucketCount=3`, `remainingBucketCount=0`, and `affectedSourceLabels=["sparse","seed-only"]`.
- The restored CLI contract `mcp route-hints search_code --route srclight:semantic_search --profile ... --json` succeeded and returned `profileScope=profile`.
- The route-scoped CLI inspection reported `telemetryHealth.state=ready`, `sourceMode=static`, `sourceLabel=seed-only`, and a `currentOrdering` narrowed to `srclight:semantic_search` for that explicit route view.
- The route-scoped CLI inspection included the canonical maintenance-status block with `compactionProgress`, retention windows, overdue context, and `affectedSourceLabels`.
- `runtime telemetry clear --scope tool --tool find_symbol --non-interactive --json` succeeded and reported the exact cleared scope as `tool find_symbol`.
- The immediate post-clear `mcp route-hints find_symbol --json` summary inspection succeeded with `telemetryHealth.state=ready`, `profileScope=summary`, and a synthesized `profiles[0]` entry of `profileKey="seed-only"`, `sourceMode="static"`, `sourceLabel="seed-only"`, and `sampleCount=0`.
- That same post-clear summary inspection returned deterministic seed-only `currentOrdering` for `find_symbol`, beginning with `srclight:search_symbols`, then `srclight:get_symbol`, then `srclight:get_signature`.

Success-criteria interpretation:

- `SC-003`: Pass for the route-scoped CLI inspection flow. The returned payload included canonical source mode, source label, freshness state, freshness age, current ordering, and telemetry health.
- `RTV-003a`: Not yet validated as a live pass in this record. Startup truthfulness, maintenance-loop behavior, and degraded-state reporting are covered by automated server tests, but this validation log does not include a healthy-runtime 15-minute periodic-maintenance capture.
- `RTV-006`: Pass. The live compact workflow reported the selected tool scope and maintenance progress, and the live clear-by-scope workflow for `find_symbol` reported the exact affected scope and returned the next inspection to static `seed-only` behavior.
- `CLI-001` to `CLI-005`: Pass for the exercised route-hint inspection and compaction flows. The CLI returned canonical machine-readable state plus explicit operator-facing labels and maintenance context.

## Test Evidence

Commands run:

```bash
bun test packages/config/tests/schema/routing-hints.test.ts packages/mcp-core/tests/routing/route-hints.test.ts packages/mcp-core/tests/routing/table.test.ts packages/mcp-core/tests/registry/router.route-hints.test.ts packages/mcp-core/tests/registry/router.merge-strategy.test.ts packages/mcp-adapters/srclight/tests/routing.test.ts packages/mcp-adapters/document-mcp/tests/routing.test.ts packages/mcp-adapters/mcp-adr-analysis-server/tests/routing.test.ts packages/runtime/tests/services/runtime-lifecycle.telemetry.test.ts packages/runtime/tests/state/route-telemetry-migrations.test.ts packages/runtime/tests/services/route-telemetry-maintenance.test.ts
bun test apps/cli/tests/commands/route-telemetry.test.tsx apps/cli/tests/commands/route-telemetry.prompt-safety.test.tsx apps/cli/tests/workflows/mcp.test.ts apps/server/tests/startup/start-server.test.ts apps/server/tests/startup/inspect-route-hints.test.ts
bun test tests/workflow/route-telemetry.workflow.test.ts tests/workflow/route-telemetry-benchmark.workflow.test.ts
bun run typecheck
```

Observed results:

- Config, router ordering, merge semantics, adapter metadata, runtime telemetry lifecycle, migration, and maintenance suites passed.
- CLI command, CLI workflow, prompt-safety, server startup, and route-hint inspection suites passed.
- Workflow regression and live benchmark workflow suites passed.
- `typecheck` passed.

## Residual Notes

- The benchmark and persistence harness now uses real route telemetry instead of synthetic sample math, but it intentionally mutates `search_code` and `find_symbol` telemetry for the current repository while it runs and clears those tool scopes again at the end of the benchmark pass.
- The observed degraded runtime state in this workspace was caused by the optional `document-mcp` engine being unavailable after restart. The benchmarked routes, route telemetry health, compaction, and route-hint inspection surfaces remained available and were validated in that state.
- The next validation pass still needed for full closeout is a healthy-runtime periodic-maintenance capture that can legitimately satisfy `RTV-003a`, plus a `ready` benchmark run if SC-001 and SC-002 are to be promoted from measured to passed.
