# Quickstart: Remove Codebase-Memory MCP Engine

## Prerequisites

- Bun dependencies installed in the workspace
- Docker and Docker Compose available for runtime integration checks
- Existing project with `.mimirmesh/config.yml` for migration validation scenarios

## 1. Validate config schema and defaults

1. Verify schema rejects/omits retired engine IDs.
2. Generate/read default config and confirm no `codebase-memory-mcp` block.
3. Confirm CLI engine toggles no longer list `codebase-memory-mcp`.

Expected result: Retired engine is absent across schema/default/CLI surfaces.

## 2. Validate legacy config migration

1. Prepare a config containing legacy `engines["codebase-memory-mcp"]`.
2. Load config through normal config reader path.
3. Confirm migration behavior:
   - Existing explicit Srclight values remain unchanged.
   - Missing Srclight fields are backfilled from legacy data.
   - Retired key is removed.
   - Config is persisted once.
4. Re-load unchanged config and confirm migration does not re-run.

Expected result: One-time write-back migration is idempotent and precedence-safe.

## 3. Validate runtime topology and discovery

1. Render/start runtime with migrated config.
2. Confirm compose output contains no `mm-codebase-memory` service.
3. Run discovery and confirm no retired adapter/tool registrations.
4. Run unified code-intelligence flows and confirm Srclight remains healthy.

Expected result: Active runtime surface excludes retired engine while preserving Srclight behavior.

## 4. Validate failure path for migration write-back

1. Simulate or induce config write failure during migration.
2. Confirm config load fails with actionable remediation guidance.
3. Confirm process does not continue with partially migrated state.

Expected result: Failure is explicit, deterministic, and safe.

## 5. Validate docs and regression tests

1. Update runtime and MCP feature docs to remove active codebase-memory guidance.
2. Run targeted package and integration tests covering retirement and migration behavior.

Expected result: Documentation and tests match observed post-retirement runtime behavior.

## Observed validation

- `bun run typecheck`: passed
- `bun test packages/config/tests packages/runtime/tests packages/mcp-core/tests`: passed
- `bun test packages/mcp-adapters packages/testing`: passed
- `bun test tests/workflow`: passed
- `bun run scripts/run-integration-tests.ts --skip-image-build --no-warm-containers`: passed
- `bun run check`: still reports pre-existing Biome issues outside this spec change set; changed files for this feature pass targeted Biome checks
