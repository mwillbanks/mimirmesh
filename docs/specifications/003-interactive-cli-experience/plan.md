# Implementation Plan: Interactive CLI Experience

**Branch**: `003-interactive-cli-experience` | **Date**: 2026-03-13 | **Spec**: `/Volumes/Projects/mimirmesh/docs/specifications/003-interactive-cli-experience/spec.md`
**Input**: Feature specification from `/docs/specifications/003-interactive-cli-experience/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Implement a real CLI UX layer for MímirMesh by turning bare `mimirmesh` into a branded full-screen shell, standardizing direct-command rendering around a shared step-based workflow state model, and replacing opportunistic raw object output with human-first progress, prompts, and explicit `success`/`degraded`/`failed` outcomes. The design keeps domain orchestration in `apps/cli`, expands reusable workflow-state and presentation primitives in `packages/ui`, preserves Pastel command-file conventions, and adds explicit machine-readable modes, prompt policy, accessibility safeguards, and multi-layer tests for shell entry, direct commands, prompts, and degraded-state reporting.

## Technical Context

**Language/Version**: TypeScript 5.9 on Bun with React 19 for Ink-based terminal UI  
**Primary Dependencies**: `pastel`, `ink`, `@inkjs/ui`, `zod`, existing `@mimirmesh/ui`, `@mimirmesh/runtime`, `@mimirmesh/config`, `@mimirmesh/installer`, and `@mimirmesh/workspace` packages  
**Storage**: Project-local `.mimirmesh/*` runtime/config/reports/notes state, CLI command arguments, and machine-readable terminal output when explicitly requested  
**Testing**: `bun test` package-local tests for `packages/ui`, app tests under `apps/cli`, and workflow regression tests in `tests/workflow`  
**Target Platform**: macOS/Linux terminal environments using Bun, project-local filesystem state, and Docker-backed runtime workflows where applicable  
**Project Type**: Bun workspace monorepo with a production CLI app, reusable UI package, and project-local runtime orchestration  
**Performance Goals**: Bare `mimirmesh` shell renders immediately with lightweight branding, major direct commands show progress without silent gaps, and status/inspection flows remain fast enough for normal interactive and scripted use  
**Constraints**: Preserve Pastel command-file conventions, keep human-readable UX as the default, maintain explicit machine-readable modes for automation, keep inspection/status flows non-interactive by default, support keyboard-first and reduced-motion-safe behavior, and avoid duplicating workflow logic between TUI and direct commands  
**Scale/Scope**: First-release embedded TUI scope covers dashboard, setup/init, runtime control, upgrade/repair, and MCP inspection, while lower-frequency command-first areas still require discoverable access and shared presentation standards

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Live discovery gate: TUI and direct-command runtime/MCP surfaces continue to render state from live runtime checks and router/tool responses instead of hard-coded synthetic status.
- [x] Upstream runtime gate: CLI UX work does not replace or emulate upstream runtime behavior; it wraps the existing runtime/config/install flows and surfaces their real results.
- [x] Readiness gate: The shared workflow state model will only report successful completion after the underlying runtime/bootstrap/validation work actually completes.
- [x] Degraded truth gate: The plan standardizes `degraded` as a first-class terminal outcome with explicit blocked-capability and next-action reporting based on observed evidence.
- [x] Local-first gate: The feature remains local CLI UX over project-local runtime state and does not introduce hosted interaction paths.
- [x] Monorepo boundary gate: Reusable terminal primitives and workflow state live in `packages/ui`; command entry points and workflow composition stay in `apps/cli`.
- [x] Modularity gate: The plan expands existing command runner, workflow, and UI primitive seams instead of building a new monolithic CLI shell file.
- [x] CLI experience gate: Pastel, Ink, and `@inkjs/ui` remain the required stack and are used to unify TUI and direct-command behavior.
- [x] Testing gate: The plan includes new `packages/ui` tests, `apps/cli` rendering/prompt tests, and root workflow validation.
- [x] Documentation gate: `docs/features/cli-command-surface.md`, runtime docs, and CLI-facing quickstart validation are explicit deliverables.

## Project Structure

### Documentation (this feature)

```text
docs/specifications/003-interactive-cli-experience/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── cli-surface.md
│   └── cli-machine-readable.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/
└── cli/
  └── src/
    ├── cli.ts
    ├── commands/
    │   ├── index.tsx
    │   ├── init.tsx
    │   ├── setup.tsx
    │   ├── doctor.tsx
    │   ├── runtime/
    │   ├── mcp/
    │   ├── config/
    │   ├── note/
    │   ├── report/
    │   ├── install/
    │   ├── speckit/
    │   ├── update.tsx
    │   └── upgrade.tsx
    ├── lib/
    │   ├── command-runner.tsx
    │   └── context.ts
    ├── ui/
    └── workflows/
        ├── init.ts
        └── runtime.ts

packages/
└── ui/
  └── src/
    ├── base/
    ├── components/
    ├── hooks/
    ├── patterns/
    ├── theme/
    ├── workflow/
    └── index.ts

tests/
└── workflow/

docs/
└── features/
```

**Structure Decision**: Reuse the existing `apps/cli` and `packages/ui` boundaries. `packages/ui` becomes the home for reusable workflow-state primitives, shell layout components, prompt wrappers, outcome renderers, and branding. `apps/cli` continues to own Pastel command files, command-to-workflow mapping, and domain calls into runtime/config/installer/workspace packages. Root `tests/workflow` continues to validate end-to-end CLI behavior, while package-local and app-level tests cover shared UI state and command rendering.

## Complexity Tracking

No constitution violations require justification for this plan.

## Phase 0 Research Output

- See `/Volumes/Projects/mimirmesh/docs/specifications/003-interactive-cli-experience/research.md`.

## Phase 1 Design Output

- Data model: `/Volumes/Projects/mimirmesh/docs/specifications/003-interactive-cli-experience/data-model.md`
- CLI surface contract: `/Volumes/Projects/mimirmesh/docs/specifications/003-interactive-cli-experience/contracts/cli-surface.md`
- Machine-readable contract: `/Volumes/Projects/mimirmesh/docs/specifications/003-interactive-cli-experience/contracts/cli-machine-readable.md`
- Validation quickstart: `/Volumes/Projects/mimirmesh/docs/specifications/003-interactive-cli-experience/quickstart.md`
