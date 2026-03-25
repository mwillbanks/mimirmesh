# Phase 0 Research: Installer Wizard v2

## Decision 1: Use a new umbrella `install` command plus a dedicated install workflow

- **Decision**: Create a new CLI entry point for `mimirmesh install` and a dedicated workflow orchestration module that composes the responsibilities currently split across `setup`, `init`, `install ide`, and skills installation paths.
- **Rationale**: The current onboarding path is split across separate commands and workflow definitions in `apps/cli/src/workflows/init.ts` and `apps/cli/src/workflows/skills.ts`. A dedicated install workflow keeps the unified onboarding behavior explicit, preserves shared workflow semantics, and avoids burying umbrella-install logic inside legacy `init`/`setup` definitions.
- **Alternatives considered**:
  - Extend `createInitWorkflow()` until it implicitly becomes install: rejected because the legacy naming and step shape would remain misleading and make command-surface removal harder.
  - Keep orchestration entirely in a command component: rejected because it would bypass the shared workflow state model, step tracking, and machine-readable outcome envelope.

## Decision 2: Resolve prompts in the command component before workflow execution

- **Decision**: Follow existing CLI patterns by collecting preset, area-review, IDE-target, and overwrite-confirmation input in the command React component before creating the final workflow definition.
- **Rationale**: Existing commands such as `init`, `install ide`, config mutation commands, and upgrade flows use guided prompt components plus `getPromptGuardError()` / `shouldPrompt()` to resolve prompt state before starting the workflow. Reusing this pattern preserves direct-command and TUI parity, keeps the workflow focused on execution, and makes non-interactive rejection deterministic. Installer hardening also showed that single-choice and multi-choice prompts need slightly different interaction semantics: single-choice preset selection now uses a custom `GuidedSelect` that supports space-to-mark plus enter-to-submit the highlighted option, while IDE configuration uses `GuidedMultiSelect` so multiple integrations can be selected safely.
- **Alternatives considered**:
  - Prompt mid-workflow with controller-managed prompts: rejected because that pattern is not currently the repo norm and would add execution complexity without a proven reuse path.
  - Skip prompts and infer defaults: rejected because the spec requires guided policy selection and explicit automation-safe intent.

## Decision 3: Model install choices as preset-first policy with reviewed install areas

- **Decision**: Represent the operator’s selections as an installation policy composed of a preset plus reviewed per-area adjustments, covering core install, bundled skills, IDE integration, and other optional integrations.
- **Rationale**: The clarified spec explicitly requires a preset-first flow with per-area review. The repo already has reusable prompt primitives and skill selection models, but no single policy model that unifies onboarding choices. Defining that model in design allows the workflow, machine-readable output, and overwrite/change-summary logic to speak a common language.
- **Alternatives considered**:
  - Per-step ad hoc booleans only: rejected because it makes the install summary, non-interactive contract, and idempotent rerun logic inconsistent.
  - Presets only with no review: rejected because the spec requires per-area adjustment.

## Decision 4: Keep reusable install state/policy helpers eligible for package extraction

- **Decision**: Keep the umbrella command and workflow in `apps/cli`, but design installation policy/state/change-summary logic so pure reusable helpers can live in `packages/installer` if they become substantial.
- **Rationale**: AGENTS.md and the constitution require reusable logic to live in `packages/*`. Repo exploration showed likely new pure concepts such as install presets, install area state snapshots, and change summaries. Keeping those helpers package-friendly prevents `apps/cli/src/lib/context.ts` or a new install workflow file from becoming a junk drawer.
- **Alternatives considered**:
  - Put all install logic in `apps/cli`: rejected because policy/state/change detection would become hard to reuse and would violate repo discipline if it grows.
  - Move the whole install workflow into a package immediately: rejected because command prompting and workflow presentation remain CLI-surface concerns.

## Decision 5: Remove `init` and `setup` from the supported surface without compatibility aliases

- **Decision**: Delete or retire `init` and `setup` as supported primary commands with no compatibility aliases, wrappers, or redirects.
- **Rationale**: The spec clarification is explicit. Planning must therefore include command-surface cleanup, test updates, and documentation rewrites rather than a soft deprecation path.
- **Alternatives considered**:
  - Hidden aliases to `install`: rejected by clarification.
  - Wrappers that fail with migration text: rejected because they still preserve the legacy surface as a supported command path.

## Decision 6: Require explicit non-interactive intent and explicit overwrite confirmation in interactive mode

- **Decision**: Non-interactive `install` will require either `--preset <preset>` or explicit per-area selections; interactive runs that would overwrite install-managed files must display a summary of pending changes and request confirmation.
- **Rationale**: Existing CLI guard patterns already support safe non-interactive rejection. The clarified spec also requires a change summary before overwriting install-managed files. These two safety policies define the highest-risk edges of the workflow and must be first-class in the plan.
- **Alternatives considered**:
  - Use repository/global defaults in non-interactive mode: rejected by clarification.
  - Auto-overwrite install-managed files: rejected by clarification.
  - Refuse all overwrites and force manual resolution: rejected because it would degrade guided repair flows.

## Decision 7: Update docs and tests as part of the same feature slice

- **Decision**: Treat command-surface documentation and workflow/integration tests as core deliverables of the install unification rather than cleanup after the code change.
- **Rationale**: Repo exploration found multiple direct references to `init` and `setup` in CLI docs and workflow tests. The constitution requires docs/features updates and shared CLI semantics validation. Because the feature changes the primary onboarding contract, stale docs/tests would create immediate drift.
- **Alternatives considered**:
  - Update docs after implementation: rejected because onboarding docs would be wrong at merge time.
  - Only update direct command tests: rejected because root workflow tests currently validate the old command surface.

## Validation-Derived Delta: Rerun updates require explicit confirmation

- **Observation**: Once install-managed files already exist, reruns need a review step before the workflow can safely proceed, even when the selected areas are unchanged. Validation also showed that baseline repository directories such as `docs/architecture` or `docs/runbooks` can pre-exist without meaning the installer is overwriting managed state.
- **Implementation consequence**: The command now computes an install change summary before execution, excludes baseline directories from destructive overwrite prompts, blocks non-interactive reruns that would overwrite install-managed paths unless `--yes` is supplied, and requires explicit interactive confirmation before continuing.
