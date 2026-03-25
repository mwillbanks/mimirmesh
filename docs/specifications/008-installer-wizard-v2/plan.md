# Implementation Plan: Installer Wizard v2

**Branch**: `008-installer-wizard-v2` | **Date**: 2026-03-24 | **Spec**: `/Volumes/Projects/mimirmesh/docs/specifications/008-installer-wizard-v2/spec.md`
**Input**: Feature specification from `/Volumes/Projects/mimirmesh/docs/specifications/008-installer-wizard-v2/spec.md`

## Summary

Replace the split `setup` and `init` onboarding path with a single umbrella `install` command that pre-resolves operator choices through a preset-first guided flow, reuses the existing workflow state model and non-interactive safety guards, integrates install-related areas such as IDE and bundled skills into one orchestrated execution, and removes `setup` and `init` from the supported CLI surface and documentation.

## Technical Context

**Language/Version**: TypeScript 6.0.2 on Bun 1.3.x  
**Primary Dependencies**: Pastel 4, Ink 6, `@inkjs/ui` 2, React 19, Zod 4, workspace packages `@mimirmesh/ui`, `@mimirmesh/installer`, `@mimirmesh/skills`, `@mimirmesh/runtime`, `@mimirmesh/workspace`, `@mimirmesh/reports`, `@mimirmesh/config`  
**Storage**: Repository-local files under `.mimirmesh/`, documentation files under `docs/`, IDE MCP config files, and repository-local skill installs under `.agents/skills/`  
**Testing**: `bun test` for package/app/workflow coverage, CLI workflow tests under `apps/cli/tests/**`, workflow regression tests under `tests/workflow/**`, integration-style fixture tests under `tests/integration/**`  
**Target Platform**: Local terminal-based CLI execution on macOS/Linux CI and developer environments  
**Project Type**: Bun workspace monorepo with CLI app plus shared packages  
**Performance Goals**: Guided first-time install completes in under 5 minutes excluding external prerequisite installation; long-running steps always expose visible progress and deterministic terminal outcomes  
**Constraints**: No `init`/`setup` aliases; non-interactive install requires explicit preset or per-area selections; install-managed overwrites require interactive change summary confirmation; reusable logic must stay in `packages/*`; docs and workflow output must stay semantically aligned  
**Scale/Scope**: Primary changes in `apps/cli` command/workflow orchestration, TUI launcher and navigation surfaces, selective package-level helper/types, docs updates, and regression coverage across onboarding, workflow, and direct-command surfaces

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Live discovery gate: Install orchestration continues to use existing runtime lifecycle/status paths and does not introduce hard-coded engine capability claims.
- [x] Upstream runtime gate: No adapter/container emulation is introduced; install reuses existing runtime generation/startup/config translation paths.
- [x] Readiness gate: Unified install still ends in runtime readiness verification and Spec Kit/bootstrap checks instead of reporting optimistic completion.
- [x] Degraded truth gate: The plan preserves existing degraded/failure workflow outcomes and extends them across the umbrella install flow.
- [x] Local-first gate: No hosted fallback behavior is introduced; install remains repository-local and runtime/local-first.
- [x] Monorepo boundary gate: App command/workflow orchestration stays in `apps/cli`; any reusable install policy/state helpers move to `packages/installer` or another package.
- [x] Modularity gate: The design avoids a junk-drawer command file by separating command prompt collection, workflow orchestration, and pure state/policy helpers.
- [x] CLI experience gate: The plan explicitly reuses Pastel, Ink, `@inkjs/ui`, guided prompt components, visible step progress, and shared workflow semantics.
- [x] Testing gate: The plan includes package-local and workflow/integration regression updates for install, runtime bootstrap and readiness assertions, live discovery validation, degraded diagnostics, legacy command removal, non-interactive safety, overwrite confirmation, and CLI parity checks.
- [x] Documentation gate: The plan includes updates for `docs/features/cli-command-surface.md`, onboarding docs, README references, and observed runtime and install behavior notes covering prerequisites, bootstrap flow, degraded outcomes, and validation-derived behavior.

**Post-Design Re-check**: PASS. The Phase 1 artifacts keep orchestration app-local, define reusable installation policy/state models for package extraction when justified, preserve truthful runtime verification, and explicitly carry documentation/test obligations.

## Project Structure

### Documentation (this feature)

```text
/Volumes/Projects/mimirmesh/docs/specifications/008-installer-wizard-v2/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── install-command.md
└── tasks.md
```

### Source Code (repository root)

```text
/Volumes/Projects/mimirmesh/apps/cli/
├── src/
│   ├── commands/
│   │   ├── install/
│   │   │   └── ide.tsx
│   │   ├── init.tsx
│   │   └── setup.tsx
│   ├── lib/
│   │   ├── command-runner.tsx
│   │   ├── context.ts
│   │   ├── guarded-workflow.ts
│   │   ├── non-interactive.ts
│   │   └── presentation.ts
│   ├── workflows/
│   │   ├── init.ts
│   │   └── skills.ts
│   └── ui/
├── tests/
│   ├── commands/
│   ├── lib/
│   └── workflows/

/Volumes/Projects/mimirmesh/packages/
├── installer/
├── skills/
├── ui/
├── runtime/
├── workspace/
└── reports/

/Volumes/Projects/mimirmesh/tests/
├── integration/
└── workflow/

/Volumes/Projects/mimirmesh/docs/
├── features/
├── runbooks/
└── specifications/
```

**Current-state note**: This source tree reflects the pre-implementation inventory. Legacy onboarding files such as `init.tsx` and `setup.tsx` are listed here because they exist today and are scheduled for removal or consolidation during delivery.

**Structure Decision**: Keep the umbrella command component and workflow orchestration in `apps/cli` because they are CLI-surface specific, while any reusable installation policy/state/change-summary helpers discovered during implementation should live in `packages/installer` or another appropriate package. Preserve existing shared UI primitives in `packages/ui` and reuse existing package services instead of re-implementing install behavior in the app layer.

## Implementation Notes

- Install policy and install-state helpers were extracted into `packages/installer` to keep the CLI flow package-disciplined.
- The umbrella `install` command now owns onboarding, while `install ide` remains available as a narrower expert command.
- The TUI launcher, dashboard navigation, fallback help output, and end-to-end CLI coverage were updated to promote `install` as the canonical onboarding path.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
