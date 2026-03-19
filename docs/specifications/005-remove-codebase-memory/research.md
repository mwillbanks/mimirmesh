# Research: Remove Codebase-Memory MCP Engine

## Decision 1: Retire codebase-memory from the supported engine catalog

- Decision: Remove `codebase-memory-mcp` from active engine schema, default config, adapter registration, compose/runtime wiring, and CLI enable/disable engine enumerations.
- Rationale: The feature objective is to remove redundant runtime surface and keep Srclight as the single code-intelligence engine.
- Alternatives considered:
  - Keep codebase-memory disabled by default: rejected because stale wiring still causes drift and maintenance burden.
  - Keep adapter package but hide from CLI: rejected because runtime and test surface still retains non-goal behavior.

## Decision 2: Implement one-time legacy config migration at config load

- Decision: During config load, detect legacy `engines["codebase-memory-mcp"]`, migrate applicable values into `engines.srclight`, persist once to `.mimirmesh/config.yml`, and continue normal load.
- Rationale: This preserves operability for existing projects while ensuring retirement is permanent and explicit in persisted config.
- Alternatives considered:
  - Hard-fail on any legacy key: rejected because it creates avoidable operator friction.
  - In-memory migration only: rejected because repeated implicit migration is noisy and non-deterministic.

## Decision 3: Preserve explicit Srclight settings during migration

- Decision: If both legacy and Srclight values are present, existing Srclight values take precedence; migrated values only backfill missing Srclight fields.
- Rationale: Explicit current-engine configuration represents user intent and must not be overridden by legacy data.
- Alternatives considered:
  - Legacy values override Srclight: rejected because it can silently change intentional settings.
  - Fail on overlap: rejected as unnecessary disruption for common upgrade paths.

## Decision 4: No automatic backup files during migration write-back

- Decision: Migration write-back does not create automatic backup artifacts. If persistence fails, config load fails with actionable remediation guidance.
- Rationale: This matches clarified feature scope and avoids hidden file side effects.
- Alternatives considered:
  - Always create auto-backup: rejected per clarified requirement.
  - Continue on write failure: rejected because partially migrated state violates runtime truth.

## Decision 5: Remove codebase-memory-specific bootstrap/runtime branches

- Decision: Eliminate codebase-memory runtime branches (including compose bootstrap mode conditionals and engine-specific startup logic), while preserving Srclight bootstrap/readiness behavior.
- Rationale: Retired engine paths must not remain in orchestration logic that drives health and readiness evidence.
- Alternatives considered:
  - Leave dead branches in place: rejected because dead branching increases drift and regression risk.

## Decision 6: Keep discovery and routing fully live-discovered for remaining engines

- Decision: Continue discovery-backed routing and readiness checks with Srclight and other active engines only; do not add synthetic compatibility shims for retired tools.
- Rationale: Constitution requires runtime truth from live discovery, not synthetic fallback.
- Alternatives considered:
  - Add synthetic aliases for retired engine IDs: rejected because it misrepresents runtime capabilities.

## Decision 7: Validate retirement with focused regression tests and docs updates

- Decision: Update package-local runtime/config/mcp-core tests plus integration flows to assert zero codebase-memory registration/services, migration idempotence, precedence, and write-failure handling; update runtime/MCP feature docs to match observed behavior.
- Rationale: Retirement touches cross-package contracts; test and docs updates are required to prevent stale behavior claims.
- Alternatives considered:
  - Rely only on unit tests in one package: rejected due to cross-layer routing/runtime impact.
