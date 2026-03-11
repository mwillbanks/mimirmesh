# Implementation Plan: Safe Project-Local Upgrade

**Branch**: `002-safe-local-upgrade` | **Date**: 2026-03-13 | **Spec**: `/Volumes/Projects/mimirmesh/docs/specifications/002-safe-local-upgrade/spec.md`
**Input**: Feature specification from `/docs/specifications/002-safe-local-upgrade/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Implement a non-destructive project-local runtime upgrade system for `.mimirmesh` that introduces explicit state versioning, ordered migrations, resumable checkpoints, metadata backups, compatibility-aware index handling, and runtime reconciliation in place of destructive rebuild behavior. The design keeps upgrade orchestration in the existing `packages/runtime` and `packages/config` boundaries, exposes project-facing commands through `apps/cli`, validates preserved assets with targeted live checks, and updates runtime status/docs/tests so upgrade health and degraded outcomes are reported truthfully.

## Technical Context

**Language/Version**: TypeScript 5.9 on Bun workspace tooling for CLI, runtime, config, and tests  
**Primary Dependencies**: Bun workspace packages, `zod`, `ink`, `pastel`, `yaml`, Docker Compose runtime management, existing `@mimirmesh/config`, `@mimirmesh/runtime`, `@mimirmesh/logging`, and `@mimirmesh/testing` packages  
**Storage**: Project-local `.mimirmesh/config.yml`, `.mimirmesh/runtime/*.json`, `.mimirmesh/runtime/engines/*.json`, `.mimirmesh/reports/*`, `.mimirmesh/logs/*`, `.mimirmesh/indexes/*`, `.mimirmesh/memory/*`, `.mimirmesh/cache/*`, and repo-local engine artifacts such as `.srclight/*` where applicable  
**Testing**: `bun test` package-local tests, runtime integration tests in `packages/testing/src/integration`, app tests under `apps/*`, and workflow regression tests in `tests/workflow`  
**Target Platform**: macOS/Linux hosts running project-scoped Docker containers with local filesystem access to the repository and `.mimirmesh` state  
**Project Type**: Bun workspace monorepo with CLI app, reusable runtime/config packages, project-local state management, and containerized engine orchestration  
**Performance Goals**: Upgrade status classification completes in under 30 seconds, no-op upgrades avoid unnecessary rebuild/rebootstrap work, and upgraded runtimes only report healthy after required reconciliation and preserved-state validation complete  
**Constraints**: Preserve compatible local knowledge by default, use resumable checkpointed migrations instead of destructive reinstall, keep reusable upgrade logic inside existing `packages/*`, make compatibility windows explicit, back up critical metadata before mutation, and keep degraded reporting evidence-based  
**Scale/Scope**: One project-local `.mimirmesh` installation per repository, four current runtime engines, multiple persisted runtime evidence files, upgrade-safe handling for notes/reports/indexes/cache/runtime metadata, and coverage spanning unit, integration, and workflow validation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Live discovery gate: Runtime upgrade design preserves live discovery and reruns engine discovery after reconciliation rather than freezing synthetic tool inventories.
- [x] Upstream runtime gate: Runtime refresh and reconciliation continue to use real Docker Compose, bridge health checks, and existing upstream engine startup/bootstrap commands.
- [x] Readiness gate: Upgrade health only becomes ready after required migrations, selective bootstrap, and post-upgrade validation finish successfully.
- [x] Degraded truth gate: The design distinguishes blocked upgrade, degraded preserved-state outcomes, and successful reconciliation using persisted evidence and live checks.
- [x] Local-first gate: Upgrade behavior remains project-local and filesystem-backed; rebuildable resources prefer local regeneration over hosted fallbacks.
- [x] Monorepo boundary gate: Reusable upgrade/versioning logic stays in `packages/config` and `packages/runtime`; CLI command surfaces remain in `apps/cli`.
- [x] Modularity gate: Upgrade/versioning/checkpoint/backup logic will be split by concern inside runtime and config submodules rather than added to existing junk-drawer files.
- [x] Testing gate: Plan includes package-local tests for versioning, migrations, checkpoints, backups, and runtime reconciliation plus workflow coverage for end-to-end project upgrade.
- [x] Documentation gate: `docs/features` and runtime operations docs are explicit deliverables derived from observed upgrade behavior and degraded outcomes.

## Project Structure

### Documentation (this feature)

```text
docs/specifications/002-safe-local-upgrade/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── runtime-upgrade-cli.md
│   └── runtime-upgrade-state.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/
└── cli/
    └── src/
        ├── commands/
        │   ├── runtime/
        │   └── refresh.tsx
        └── lib/

packages/
├── config/
│   └── src/
│       ├── schema/
│       ├── readers/
│       ├── validation/
│       └── writers/
├── runtime/
│   └── src/
│       ├── bootstrap/
│       ├── compose/
│       ├── health/
│       ├── services/
│       ├── state/
│       ├── types/
│       └── upgrade/
└── testing/
    └── src/
        ├── fixtures/
        └── integration/

tests/
└── workflow/

docs/
├── features/
│   ├── cli-command-surface.md
│   └── runtime-upgrade.md
├── operations/
│   └── runtime.md
└── runbooks/
    └── first-init.md
```

**Structure Decision**: Reuse the existing monorepo boundaries instead of introducing a new package. Version schemas and compatibility rules belong in `packages/config`, upgrade orchestration/checkpoints/backups/reconciliation belong in `packages/runtime`, command entry points and UX mapping belong in `apps/cli`, reusable upgrade fixtures/integration coverage belong in `packages/testing`, and workflow regression stays in `tests/workflow`.

## Complexity Tracking

No constitution violations require justification for this plan.

## Phase 0 Research Output

- See `/Volumes/Projects/mimirmesh/docs/specifications/002-safe-local-upgrade/research.md`.

## Phase 1 Design Output

- Data model: `/Volumes/Projects/mimirmesh/docs/specifications/002-safe-local-upgrade/data-model.md`
- CLI/runtime contract: `/Volumes/Projects/mimirmesh/docs/specifications/002-safe-local-upgrade/contracts/runtime-upgrade-cli.md`
- State/versioning contract: `/Volumes/Projects/mimirmesh/docs/specifications/002-safe-local-upgrade/contracts/runtime-upgrade-state.md`
- Validation quickstart: `/Volumes/Projects/mimirmesh/docs/specifications/002-safe-local-upgrade/quickstart.md`
