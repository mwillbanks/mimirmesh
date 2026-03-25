# Feature Specification: Installer Wizard v2

**Feature Branch**: `008-installer-wizard-v2`  
**Created**: 2026-03-24  
**Status**: Draft  
**Input**: User description: "Update installation process unifying `init` and `setup` into a single `install` command and removing `init` and `setup` and improving the command to provide a guided, prompt-based installation and setup policy selection (instead of mostly implicit defaults) in order to implement R10: Installer Wizard v2."

## Clarifications

### Session 2026-03-24

- Q: Should `init` and `setup` remain as compatibility aliases, wrappers, or redirects to `install`? → A: No aliases; remove them.
- Q: How should guided installation policy selection work? → A: Start with a preset, then allow review and adjustment of specific install areas.
- Q: How broad should the new `install` command be? → A: `install` becomes the umbrella entry point for all install-related tasks, including skills and every optional integration.
- Q: How should non-interactive `install` behave when no explicit choices are provided? → A: Non-interactive `install` requires an explicit preset or explicit per-area selections; otherwise it fails with guidance.
- Q: How should `install` handle overwriting existing install-managed files? → A: Prompt before overwriting install-managed files, with a summary of what will change.

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Guided First-Time Install (Priority: P1)

As a developer onboarding a repository, I run a single guided `install` command that explains what will be configured, prompts me for important setup choices, and completes the full repository installation flow without requiring separate `setup` and `init` commands.

**Why this priority**: This is the primary onboarding path. The feature does not deliver its intended value if new users still need to understand multiple overlapping commands or accept hidden defaults.

**Independent Test**: Can be fully tested by running the new `install` command in an uninitialized repository and confirming that the repository reaches a usable installed state with the selected policies applied and operator-visible results reported.

**Acceptance Scenarios**:

1. **Given** a repository that has not been installed, **When** the operator runs `install` interactively, **Then** the CLI guides the operator through installation choices and completes repository scaffolding, configuration, readiness checks, and install-related optional integrations in one flow.
2. **Given** an interactive terminal and a repository with no prior installation state, **When** the operator selects an installation preset and reviews individual install areas, **Then** the resulting installation reflects the final reviewed selections and summarizes what was installed, skipped, or needs attention.

---

### User Story 2 - Reinstall or Repair Existing Setup (Priority: P2)

As an operator returning to a partially configured or previously installed repository, I rerun `install` and receive state-aware guidance so I can repair, complete, or confirm the installation without duplicating work or guessing which command to use.

**Why this priority**: Existing repositories need a safe rerun path or the new command becomes a first-run-only surface and leaves the previous fragmentation problem unresolved.

**Independent Test**: Can be fully tested by running `install` in a repository with partial installation artifacts and confirming that the command detects current state, proposes relevant actions, and avoids duplicating already-correct work.

**Acceptance Scenarios**:

1. **Given** a repository with some installation steps already completed, **When** the operator runs `install`, **Then** the CLI detects the current state, uses that state to choose prompt defaults, and only performs missing or operator-approved changes.
2. **Given** a repository whose installation is degraded or incomplete, **When** the operator reruns `install`, **Then** the CLI identifies the affected areas, applies selected remediation steps, and reports the resulting readiness status.

---

### User Story 3 - Automation-Safe Install Execution (Priority: P3)

As an operator running the CLI in automation or other non-interactive environments, I can execute `install` with explicit choices and receive deterministic behavior without hanging on prompts, while the supported onboarding surface exposes `install` as the only primary repository onboarding command.

**Why this priority**: The CLI already serves direct-command and automation use cases. The new install flow must not regress scripted usage once `init` and `setup` are removed from the supported surface.

**Independent Test**: Can be fully tested by running `install` in non-interactive mode with explicit options and by verifying that command discovery, help output, and onboarding documentation expose `install` as the only supported primary onboarding command.

**Acceptance Scenarios**:

1. **Given** a non-interactive environment, **When** the operator runs `install` without required explicit choices, **Then** the CLI exits safely with clear instructions describing how to rerun the command non-interactively.
2. **Given** a non-interactive environment with all required choices provided, **When** the operator runs `install`, **Then** the command completes deterministically without attempting interactive prompts.
3. **Given** the new installer command surface is shipped, **When** an operator inspects the available onboarding commands, **Then** only `install` is presented as the supported primary repository onboarding command and `init` and `setup` are absent from the available command surface.
4. **Given** an operator requests CLI help or command discovery output, **When** the onboarding command surface is rendered, **Then** `install` is described as the canonical onboarding path and the output does not present `init` or `setup` as supported onboarding commands.

---

### Edge Cases

- The repository already contains valid install artifacts for some steps but not others.
- The operator declines optional installation actions but still expects the repository to be left in a consistent usable state.
- A required prerequisite is unavailable during installation, such as runtime dependencies or write access to target files.
- The operator starts in interactive mode, and one or more selected actions would overwrite existing install-managed files or configuration.
- The operator runs the command in automation with stale documentation or scripts that still refer to `init` or `setup` after those commands have been removed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The CLI MUST expose a single primary repository installation command named `install` that covers the onboarding responsibilities previously split across `setup` and `init` and serves as the umbrella entry point for install-related tasks.
- **FR-002**: The `install` command MUST guide interactive operators through installation and setup policy choices before applying changes that were previously chosen through implicit defaults.
- **FR-002a**: Guided installation policy selection MUST begin from an operator-visible preset and MUST allow review and adjustment of specific install areas before the installation is applied.
- **FR-003**: The installation flow MUST detect existing repository installation state and use that state to determine which actions are already satisfied, which actions remain optional, and which actions need remediation.
- **FR-004**: The installation flow MUST allow operators to complete repository scaffolding, installation, readiness validation, and install-related optional integrations from one command execution without requiring a follow-up `setup` or `init` command.
- **FR-005**: The system MUST remove `init` and `setup` from the supported command surface and MUST NOT preserve them as aliases, wrappers, redirects, or hidden compatibility commands.
- **FR-006**: The system MUST support non-interactive execution of `install` by accepting explicit operator choices and MUST fail safely with actionable guidance when required choices are missing.
- **FR-006a**: Non-interactive execution MUST NOT infer a preset or per-area install selection when the operator has not provided one explicitly.
- **FR-007**: The installation flow MUST be idempotent for already-correct repository state and MUST avoid duplicating files, registrations, or generated outputs that are already valid.
- **FR-008**: The installation result MUST report which actions completed, which actions were intentionally skipped, which actions degraded, and what corrective actions remain.
- **FR-008a**: When the selected install actions would overwrite existing install-managed files, the interactive flow MUST present a summary of the pending changes and require operator confirmation before applying them.
- **FR-009**: The system MUST preserve an operator-visible distinction between required installation actions and optional add-on actions so users can make informed choices during guided setup.
- **FR-009a**: Installation presets MUST be explainable in operator-visible terms so users can understand what each preset enables before reviewing or changing individual install areas.
- **FR-011**: The umbrella `install` flow MUST include install-related tasks currently exposed through narrower installation commands, including skills installation and optional integrations, as selectable install areas within the guided workflow.
- **FR-010**: Help text, operator guidance, and installation documentation MUST describe `install` as the canonical onboarding path and MUST remove instructions that rely on `init` or `setup` as separate steps.

### Runtime Truth and Validation Requirements *(mandatory for runtime, MCP, adapter, or orchestration features)*

- **RTV-001**: Engine-owned capabilities MUST be discovered from live runtime endpoints and exercised successfully in acceptance scenarios.
- **RTV-002**: The system MUST NOT rely on hard-coded engine tool inventories to represent runtime availability.
- **RTV-003**: Required bootstrap/indexing steps MUST run automatically and MUST be verified before readiness is reported healthy.
- **RTV-004**: Degraded mode MUST report proven root cause, affected capabilities, and corrective actions based on live checks.
- **RTV-005**: Configuration-dependent limitations MUST be classified only after execution-based validation against the active runtime.
- **RTV-006**: Local/private execution MUST be preferred when a capable local option exists; hosted fallback usage MUST be explicit.
- **RTV-007**: Feature documentation under `docs/features/` MUST be updated with observed behavior, prerequisites, bootstrap flow, and degraded outcomes.

### CLI Experience Requirements *(mandatory for CLI, TUI, interactive workflow, or operator-facing command features)*

- **CLI-001**: CLI features MUST present progress, current state, and results through structured output built with Pastel, Ink, and `@inkjs/ui`.
- **CLI-002**: Long-running operations MUST show visible progress indicators until completion, failure, or cancellation.
- **CLI-003**: Interactive prompts MUST be used when they improve safety, configuration correctness, or usability.
- **CLI-004**: Full-screen TUI flows and direct subcommands MUST reuse a shared state model and visual language for the same workflow.
- **CLI-005**: Human-readable output MUST be the default; machine-readable output MAY be offered only when explicitly requested and MUST remain semantically equivalent.
- **CLI-006**: Feature documentation MUST describe the operator-visible states, prompts, and machine-readable mode behavior for the affected commands.

### Assumptions

- The unified `install` command remains repository-scoped and is intended for local project installation, not for global runtime administration.
- Guided installation policy choices include the setup decisions that materially affect onboarding safety or repository readiness, rather than every low-level configuration value.
- Guided installation presents a bounded set of meaningful install areas for review rather than exposing every low-level configuration field.
- Automation-safe execution depends on explicit operator intent rather than implicit repository or global defaults when interactive prompting is unavailable.
- Narrower install-related commands may still exist for direct expert use, but they no longer define the primary onboarding or installation path once the umbrella `install` flow is available.
- Migration from the retired `init` and `setup` workflow will be handled by removing those commands from the supported surface rather than preserving compatibility aliases.

### Key Entities *(include if feature involves data)*

- **Installation Session**: A single execution of the `install` workflow, including detected repository state, selected policies, completed actions, skipped actions, degraded actions, and final readiness outcome.
- **Installation Preset**: The operator-visible starting configuration offered by the install workflow before per-area review, including a description of required and optional actions enabled by default.
- **Installation Area**: A selectable slice of the install workflow, such as core setup, skills installation, IDE configuration, or optional integrations, that can be reviewed, applied, skipped, or repaired independently.
- **Installation Policy**: The operator-selected onboarding configuration composed of the chosen preset plus any reviewed per-area adjustments that influence how installation proceeds across core setup, skills installation, and optional integrations.
- **Installation State**: The current repository condition relevant to onboarding, including which required install artifacts already exist, which optional capabilities are configured, and which areas need repair or completion.
- **Installation Outcome**: The final result presented to the operator, including applied actions, skipped actions, unresolved issues, and the recommended next actions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: First-time operators can complete repository installation from a single command in under 5 minutes, excluding time spent on external prerequisite installation.
- **SC-002**: At least 90% of guided install runs in test and validation scenarios reach a clear terminal outcome on the first attempt without requiring the operator to discover an additional onboarding command.
- **SC-003**: Re-running `install` on an already installed repository produces no duplicate install artifacts and surfaces only the remaining optional or degraded actions.
- **SC-004**: Validation confirms that `install` is the only supported primary onboarding command and that `init` and `setup` no longer appear in the supported command surface or onboarding documentation.
- **SC-005**: Validation confirms that operators can complete both core setup and install-related optional tasks from the umbrella `install` flow without needing to discover separate install entry points during onboarding.
- **SC-006**: In non-interactive validation scenarios, `install` succeeds only when a preset or explicit per-area selections are supplied and otherwise exits with actionable rerun guidance.
- **SC-007**: In interactive validation scenarios where install-managed files would change, operators receive a change summary and must explicitly confirm the overwrite before those files are replaced.

### Runtime Validation Outcomes *(mandatory for runtime, MCP, adapter, or orchestration features)*

- **RVO-001**: Tool discovery reports only live-discovered engine capabilities and zero synthetic engine tools.
- **RVO-002**: Runtime readiness transitions to healthy only after required bootstrap/index jobs complete.
- **RVO-003**: Degraded engine states include explicit, reproducible diagnostics validated in test or workflow output.
- **RVO-004**: Documentation updates under `docs/features/` match observed command/runtime output used during validation.

### CLI Experience Outcomes *(mandatory for CLI, TUI, interactive workflow, or operator-facing command features)*

- **CLO-001**: Operators can identify current progress state and result for each long-running command without ambiguity.
- **CLO-002**: Equivalent TUI and direct-command workflows present the same state transitions and outcome semantics.
- **CLO-003**: Prompted workflows prevent unsafe or confusing configuration steps more effectively than raw argument-only execution.
- **CLO-004**: Machine-readable output, when supported, can be requested explicitly without degrading the default human-first experience.
- **CLO-005**: The TUI launcher and direct `install` command expose the same install areas, progress states, and terminal outcomes.
