# Contract: Legacy Codebase-Memory Config Migration

## Purpose

Define deterministic migration behavior for legacy persisted project configs containing `engines["codebase-memory-mcp"]`.

## Trigger

- Trigger condition: Config loader detects `engines["codebase-memory-mcp"]` key in project config.
- Non-trigger condition: No retired key present.

## Inputs

- Current persisted `.mimirmesh/config.yml`
- Existing `engines.srclight` configuration, if present
- Legacy `engines["codebase-memory-mcp"]` settings, if present

## Transformation Rules

1. Preserve existing explicit `engines.srclight` fields.
2. Map legacy values only into missing Srclight fields (backfill-only behavior).
3. Remove `engines["codebase-memory-mcp"]` from the resulting config.
4. Do not introduce automatic backup files.

## Persistence Contract

1. Validate transformed config against current schema.
2. Persist transformed config once to `.mimirmesh/config.yml`.
3. Subsequent loads of unchanged migrated config must not re-run migration.

## Failure Contract

- If transformed config fails validation: fail config load and return actionable remediation.
- If write-back fails: fail config load, report write error and remediation, and do not proceed with partially migrated state.

## Observability Expectations

- Successful migration is observable by retired key absence in persisted config.
- Repeated loads do not emit repeated migration actions for unchanged config.
