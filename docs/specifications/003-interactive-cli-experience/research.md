# Phase 0 Research: Interactive CLI Experience

## Decision 1: Keep CLI orchestration in `apps/cli` and expand reusable UX primitives in `packages/ui`

**Decision**: Implement the shared workflow state model, outcome taxonomy, step progress primitives, branded shell components, and prompt/presentation patterns inside `packages/ui`, while keeping command wiring, workflow composition, and domain operations in `apps/cli`.

**Rationale**: The existing repository already separates reusable terminal primitives into `packages/ui` and operational command wiring into `apps/cli`. Moving domain workflow orchestration into a new package would create a thin abstraction layer, while leaving shared presentation and state primitives in the CLI app would violate the monorepo boundary guidance.

**Alternatives considered**:
- Create a new `packages/cli-ux` package: rejected because it would duplicate `packages/ui` responsibilities and split one cohesive terminal design system across two packages.
- Keep all new state and presentation logic in `apps/cli`: rejected because the full-screen TUI and direct commands must share reusable primitives that belong in a package.

## Decision 2: Use Pastel command-file conventions for all direct commands and make the default Pastel entry command the branded TUI shell

**Decision**: Preserve Pastel command-file routing for direct subcommands and replace the current bare `index.tsx` status command with a full-screen branded shell that serves as the default `mimirmesh` experience.

**Rationale**: The CLI already uses Pastel conventions under `apps/cli/src/commands`, and the current default command is the narrowest seam to replace for a real bare-command product experience. This keeps command discovery and help behavior inside the supported Pastel model instead of inventing a parallel router.

**Alternatives considered**:
- Build a custom top-level router outside Pastel for TUI mode: rejected because it would bypass the command-file system the repo has already adopted.
- Keep the default command as a simple status screen and add a separate `mimirmesh tui`: rejected because the feature requirement explicitly makes bare `mimirmesh` the primary interactive entry point.

## Decision 3: Standardize workflow rendering around a shared step model and explicit terminal outcome classes

**Decision**: Replace the current coarse `success`/`warning`/`error` runner output with a shared workflow run model that tracks ordered steps, active step, warnings, evidence rows, and terminal outcomes `success`, `degraded`, and `failed`.

**Rationale**: The current `CommandRunner` supports only one spinner and a flat summary. The clarified spec requires step-based progress, partial-success evidence, and identical terminal semantics across the TUI and direct commands. A single workflow state contract is the cleanest way to satisfy those requirements.

**Alternatives considered**:
- Keep `warning` as the partial-success state: rejected because `warning` is too presentation-oriented and does not communicate the explicit degraded semantics required by the spec.
- Let each command define its own progress and outcome shape: rejected because parity across TUI and direct commands would become untestable.

## Decision 4: Treat the first-release TUI as a full-screen dashboard plus embedded operational workflows, with lower-frequency areas exposed through discoverable command-first handoffs

**Decision**: The first release embeds home/dashboard, setup/init, runtime control, upgrade/repair, and MCP inspection directly in the TUI. Lower-frequency areas such as configuration, reports, notes, and some MCP invocation flows remain command-first initially, but the dashboard must expose them through visible navigation cards, summaries, and launch guidance.

**Rationale**: The clarification narrowed the required first-release embedded TUI scope, but the user request still requires navigable access to lower-frequency workflows. A dashboard-driven handoff model preserves that access without overloading the initial full-screen shell.

**Alternatives considered**:
- Embed every existing command area in the first TUI release: rejected because it would materially increase scope and weaken the quality of the primary operational flows.
- Exclude lower-frequency surfaces from the TUI completely: rejected because it would fail the discoverability and navigable-access requirement.

## Decision 5: Use `@inkjs/ui` prompts only where they materially improve safety or configuration quality, and require explicit non-interactive flags for mutating automation flows

**Decision**: Use `@inkjs/ui` controls for selections, confirmations, and text entry in setup, init, install-ide, repair, upgrade, and similar guided flows. Inspection/status commands remain non-interactive by default. Mutating direct commands support explicit non-interactive flags and explicit machine-readable modes for automation.

**Rationale**: The spec requires human-first guidance without breaking scripted usage. Restricting prompts to high-value decision points keeps direct commands predictable while still improving operator safety for state-mutating flows.

**Alternatives considered**:
- Prompt in all commands by default: rejected because status and inspection workflows must remain automation-safe.
- Avoid prompts outside the full-screen TUI: rejected because the feature explicitly calls for guided direct-command workflows when useful.

## Decision 6: Add a lightweight branded startup treatment that is fast enough to preserve CLI responsiveness

**Decision**: Add a branded MímirMesh shell header and startup treatment that appears immediately on TUI entry and in major direct-command workflows, but keep it lightweight, text-forward, and non-blocking.

**Rationale**: The feature calls for premium identity treatment, but the CLI must still feel fast and readable. A lightweight brand layer inside reusable UI primitives satisfies both goals.

**Alternatives considered**:
- Large animated intro sequence: rejected because it would slow startup, conflict with reduced-motion expectations, and create friction for repeated CLI usage.
- No distinct identity layer: rejected because it would underdeliver on the requested product feel.

## Decision 7: Keep machine-readable mode explicit and separate from the default UX contract

**Decision**: Direct commands remain human-readable by default and support explicit machine-readable modes only when requested. Machine-readable output must preserve the same step/outcome semantics as the interactive path instead of dumping raw internal objects opportunistically.

**Rationale**: The current CLI often returns raw JSON-shaped objects because the fallback path prints function results directly. The spec requires human-first UX by default and semantically equivalent automation paths.

**Alternatives considered**:
- Continue exposing raw function outputs as the automation contract: rejected because those shapes are incidental implementation details and not a reliable UX contract.
- Remove machine-readable output entirely: rejected because automation and scripting remain required.

## Decision 8: Cover the feature with package-local UI tests, app-level command rendering tests, and root workflow validation

**Decision**: Add package-local tests for `packages/ui` workflow-state primitives and presentation contracts, app-level tests for command runners and guided flows under `apps/cli`, and workflow validation for the bare-command TUI entry, direct command progress rendering, prompt behavior, and degraded-state presentation under `tests/workflow`.

**Rationale**: This feature crosses reusable UI state, app command integration, and end-to-end project workflows. One test layer is not enough to protect the required TUI/direct-command parity.

**Alternatives considered**:
- Rely only on snapshot-style UI tests: rejected because workflow semantics and machine-readable parity need behavioral assertions.
- Rely only on workflow tests: rejected because low-level UI state and command rendering regressions need faster package/app coverage.
