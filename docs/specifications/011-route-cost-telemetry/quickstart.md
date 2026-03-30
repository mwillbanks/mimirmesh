# Quickstart: Route Telemetry and Adaptive Route Hints

## 1. Start the project runtime

```bash
mimirmesh runtime start
```

Expected result:
- Runtime reaches `ready`
- PostgreSQL is available
- Route telemetry maintenance state is initialized

If runtime status is `degraded`, stop the adaptive-validation path here. Record degraded-mode truthfulness separately, resolve or acknowledge the degraded cause, and only use a later `ready` run as evidence for SC-001, SC-002, and periodic-maintenance success.

## 2. Generate route telemetry

Run repeated queries against the first-slice adaptive tools.

```bash
mimirmesh mcp tool search_code '{"query":"routing table adaptive hints","limit":5}'
mimirmesh mcp tool find_symbol '{"query":"unifiedRoutesFor"}'
```

Run at least 15 profile-matched attempts per command to leave the `insufficient-data` source mode and reach `mixed` when observations remain fresh. Use the live benchmark harness in step 9 when validating SC-001, SC-002, sanitized-storage behavior, and restart persistence for the warmed reranked path.

## 3. Inspect route hints from CLI

```bash
mimirmesh mcp route-hints search_code --include-rollups
```

Expected output includes:
- summary inspection across recorded profile keys when `--profile` is omitted
- canonical `sourceMode` and operator-facing `sourceLabel`
- `freshnessState` and `freshnessAgeSeconds`
- confidence
- current route ordering
- reason codes
- telemetry health
- maintenance status, `compactionProgress`, `affectedSourceLabels`, retention windows, and overdue context
- recent rollup summaries when requested

## 4. Inspect route hints from MCP

Call the MimirMesh-owned management tool:

```json
{
  "tool": "inspect_route_hints",
  "args": {
    "unifiedTool": "find_symbol",
    "profile": "<profileKey from summary inspection>",
    "includeRollups": true
  }
}
```

Expected result:
- same semantic inspection payload as CLI `--json`
- explicit `profile` returns profile-scoped inspection; omitting it returns a summary view across recorded profiles
- no raw request arguments or result content

## 5. Force on-demand compaction

```bash
mimirmesh runtime telemetry compact --scope tool --tool search_code --non-interactive
```

Expected result:
- progress steps for lock acquisition, rollup refresh, snapshot refresh, and pruning
- final affected scope summary

## 6. Start the long-lived MCP server process for maintenance validation

Run the repository-local MCP server in a separate terminal before validating periodic maintenance behavior.

```bash
bun run --cwd apps/server dev
```

Expected result:
- the long-lived MCP server process remains running while route-hint inspection and periodic maintenance validation proceed

## 7. Clear one tool scope safely

```bash
mimirmesh runtime telemetry clear --scope tool --tool find_symbol
```

Expected result:
- interactive scope review and explicit confirmation before destructive execution
- the next inspection for `find_symbol` returns to `static` with the `seed-only` display label
- unrelated tool telemetry remains intact

After a new `find_symbol` attempt is recorded, the state may move to `insufficient-data` with the `sparse` display label until enough fresh evidence accumulates.

Automation variant:

```bash
mimirmesh runtime telemetry clear --scope tool --tool find_symbol --non-interactive
```

## 8. Validate stale or behind maintenance behavior

Stop the `bun run --cwd apps/server dev` process for longer than one 15-minute maintenance cadence, then restart that same command and inspect again immediately.

```bash
mimirmesh mcp route-hints search_code --json
```

Expected result:
- telemetry health reports `behind` or `degraded`, or `maintenanceStatus.overdueBySeconds` is positive before catch-up completes, and inspection shows `freshnessState` or `sourceMode` as stale when applicable
- routing remains deterministic

## 9. Run the live comparison harness and record SC-001 / SC-002 evidence

The harness runs against the current repository runtime, clears route telemetry for `search_code` and `find_symbol`, warms both profile-matched workflows with live unified invocations, compares static ordering versus reranked ordering, and then restarts the runtime to verify persisted route-hint inspection and sanitized storage.

```bash
bun test tests/workflow/route-telemetry-benchmark.workflow.test.ts
```

Expected result:
- the harness reports live static-versus-reranked median time-to-first-success deltas for `search_code` and `find_symbol`
- the harness reports estimated route-cost deltas for the same tools
- the harness reports whether the warmed reranked profile stayed inspectable after runtime restart and whether stored telemetry remained sanitized
- the validation record in `docs/specifications/011-route-cost-telemetry/validation.md` clearly marks whether SC-001, SC-002, RTV-001a, and SC-006 passed or failed

Observed validation summary on March 28, 2026:

- live benchmark harness results are recorded in `validation.md`
- live reranked profiles for `search_code` and `find_symbol` exceeded the SC-001 and SC-002 thresholds after 20 profile-matched warmup calls per tool, but that benchmark run remained `degraded`, so those measurements are not counted as release-gate pass evidence under this quickstart policy
- live stored route telemetry remained sanitized and profile-scoped route-hint inspection stayed available after runtime restart
- a live `runtime telemetry clear --scope tool --tool find_symbol --non-interactive --json` run returned the next `mcp route-hints find_symbol --json` inspection to summary `seed-only` behavior with deterministic static ordering
- the current repository runtime reported `degraded` because the optional `document-mcp` engine was unavailable after restart, while `routeTelemetry.state` still reported `ready`
- periodic background maintenance truthfulness still relies on automated server coverage until a healthy-runtime cadence capture is recorded

## Notes

- Token values are routing estimates, not billing truth.
- Adaptive ordering changes only the effective allowlist in this slice.
- Merge-oriented tools still expose diagnostics but keep their existing fanout behavior.
- Where the same route-telemetry workflows are exposed in the TUI, verify they use the same shared CLI state model, prompts, maintenance-status fields, and structured output semantics as the direct commands above.
