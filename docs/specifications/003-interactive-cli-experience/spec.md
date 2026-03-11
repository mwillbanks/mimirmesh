# Feature Specification: Interactive CLI Experience

**Feature Branch**: `[003-interactive-cli-experience]`  
**Created**: 2026-03-13  
**Status**: Draft  
**Input**: User description: "Transform the MímirMesh CLI from a mostly JSON-returning command surface into a polished, highly interactive terminal product with an excellent developer experience. The CLI must provide a full TUI entry experience when launched as mimirmesh, where users can navigate and execute the major product workflows from within the interface. Direct subcommands must still be available, but they must present rich human-readable state updates, progress, statuses, and meaningful feedback instead of feeling like raw machine output. Setup, initialization, repair, upgrade, runtime control, MCP inspection, and related workflows must guide the user with prompts, selections, confirmations, and clear operational visibility whenever that improves usability or safety. The experience should feel premium, responsive, and trustworthy, giving users continuous awareness of what the system is doing, what step it is on, what succeeded, what failed, and what requires attention."

## Clarifications

### Session 2026-03-13

- Q: Which workflows must remain non-interactive by default when automation is preferred? → A: Mutating workflows default to interactive prompts; inspection and status workflows remain non-interactive by default; mutating workflows can opt into non-interactive execution with explicit flags.
- Q: Which workflows must the first-release full-screen TUI cover directly? → A: The first-release TUI covers the core operational workflows: home or dashboard, setup or init, runtime control, upgrade or repair, and MCP inspection; lower-frequency surfaces remain command-first initially.
- Q: What accessibility floor must the first release meet? → A: The CLI must support keyboard-first navigation, non-color status cues, reduced-motion-safe behavior, and screen-reader-friendly text semantics where terminal support allows.
- Q: What progress model must major workflows use? → A: Major workflows use step-based progress with explicit step labels, completed-step history, an active spinner for in-flight work, and a final summary that preserves partial-success evidence.
- Q: How must terminal outcomes be classified and presented? → A: Major workflows use explicit terminal outcomes of success, degraded, and failed; each outcome states impact, completed work, blocked capability, and next action.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Launch and Navigate the Product from the TUI (Priority: P1)

As a developer using MímirMesh, I can launch `mimirmesh` with no subcommand and enter a full-screen terminal interface that shows the major product areas, current project state, and available actions so that I can discover and execute workflows without memorizing commands.

**Why this priority**: The TUI entry experience is the defining product shift. If the default launch experience is not useful and trustworthy, the feature does not achieve its core goal.

**Independent Test**: Can be fully tested by launching `mimirmesh` in a supported repository, navigating the primary sections, opening major workflows, and confirming that the interface exposes current status, next actions, and results without requiring raw command knowledge.

**Acceptance Scenarios**:

1. **Given** the user runs `mimirmesh` in a project, **When** the application starts, **Then** the user sees a full-screen terminal interface that highlights major workflows, current project/runtime status, and available next actions.
2. **Given** the user is browsing the TUI, **When** they move between workflow areas such as setup, runtime, MCP inspection, and repair, **Then** the interface preserves a consistent layout, navigation model, and status presentation.
3. **Given** the user selects a workflow from the TUI, **When** that workflow begins, **Then** the interface shows the current step, in-progress state, completed steps, and any warnings or required attention.
4. **Given** the user opens the default TUI entry experience, **When** they review the first-release navigation surface, **Then** they can access home or dashboard, setup or init, runtime control, upgrade or repair, and MCP inspection directly from the interface.
5. **Given** the user relies on keyboard-only interaction or reduced-motion preferences, **When** they navigate the TUI or run direct commands, **Then** they can complete the workflow without depending on color-only meaning or motion-heavy feedback.

---

### User Story 2 - Run Direct Commands with Rich Human Feedback (Priority: P2)

As a developer using direct subcommands, I can run setup, init, repair, upgrade, runtime, and inspection commands and receive rich human-readable progress, status, and outcome feedback so that commands feel trustworthy rather than like raw machine output.

**Why this priority**: Direct commands remain part of the product surface. They must deliver a high-quality operator experience even when users do not enter the TUI.

**Independent Test**: Can be fully tested by running key direct commands in representative repository states and confirming that each command reports progress, current operation, completion state, warnings, and actionable failures in a structured human-readable form.

**Acceptance Scenarios**:

1. **Given** the user runs a long-running direct command such as setup, init, refresh, or runtime upgrade, **When** work is in progress, **Then** the command continuously shows what step is running and whether the system is progressing normally.
2. **Given** the user runs a command that completes successfully, **When** the command finishes, **Then** the command summarizes what changed, what remains healthy, and any recommended next action.
3. **Given** the user runs a command that encounters a failure or degraded condition, **When** the command stops or partially completes, **Then** the output identifies what failed, what still succeeded, the impact on the project, and what the user should do next.
4. **Given** the user runs an inspection or status command in a scripted context, **When** the command executes without interactive flags, **Then** it completes without prompts while still returning the same observed status and outcome semantics.
5. **Given** the user runs a major workflow in the TUI or as a direct command, **When** the workflow spans multiple operational steps, **Then** the interface shows the active step label, completed steps, an in-flight spinner, and a final summary that preserves any partial-success evidence.
6. **Given** a workflow reaches a terminal state, **When** the system renders the final outcome, **Then** it classifies the result as success, degraded, or failed and states the impact, completed work, blocked capability, and next action.

---

### User Story 3 - Guided and Safe Operational Workflows (Priority: P3)

As a developer performing sensitive or complex operations, I can follow guided prompts, selections, and confirmations during setup, repair, upgrade, runtime control, and MCP inspection so that I can make safe choices with clear awareness of consequences.

**Why this priority**: Guided interaction improves safety and usability, but it depends on the TUI and rich command-state work already being in place.

**Independent Test**: Can be fully tested by invoking guided operational workflows and confirming that the interface prompts only when helpful, explains the decision being made, and avoids unsafe or confusing execution paths.

**Acceptance Scenarios**:

1. **Given** the user starts a workflow that can affect project state or runtime availability, **When** the system needs confirmation or a choice, **Then** it presents a guided prompt that explains the options and consequences before proceeding.
2. **Given** the user needs to inspect or choose among runtime or MCP-related actions, **When** the workflow presents options, **Then** the system shows the current state, recommended action, and any blocking conditions before the user commits.
3. **Given** the user prefers automation-friendly behavior for a supported command, **When** they explicitly request machine-readable output, **Then** the command returns semantically equivalent results without removing the default human-readable experience for normal interactive use.
4. **Given** the user runs a mutating workflow in automation, **When** they provide the explicit non-interactive invocation for that workflow, **Then** the command proceeds without prompts and preserves the same safety checks through explicit flags and terminal outcome reporting.

### Edge Cases

- What happens when the user launches the full-screen TUI from a repository with no initialized `.mimirmesh` state?
- How does the system behave when a long-running workflow loses access to Docker, a local runtime, or required files partway through execution?
- What happens when a user starts a guided workflow in a non-interactive terminal where prompts cannot be completed?
- How does the system present partial success when one step completes but a later validation or health check fails?
- What happens when the current terminal is too small to present the full interface comfortably?
- How does the system avoid conflicting or duplicated state reporting between the TUI and a direct command that exposes the same workflow?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a full-screen terminal entry experience when the user launches `mimirmesh` without a subcommand.
- **FR-002**: The default terminal entry experience MUST expose the first-release core operational workflows directly, including home or dashboard, setup or initialization, runtime control, upgrade or repair, and MCP inspection.
- **FR-003**: The default terminal entry experience MUST display current project and runtime state in a way that helps the user understand what is healthy, unavailable, incomplete, or requires attention.
- **FR-004**: Users MUST be able to navigate to and initiate the first-release core operational workflows from the default terminal interface without needing to remember direct command names.
- **FR-005**: Direct subcommands MUST remain available for the workflows supported directly by the default terminal interface and for lower-frequency command-first surfaces not included in the first TUI release.
- **FR-006**: Direct subcommands MUST present rich human-readable progress, operational state, and final outcome feedback rather than primarily returning raw machine-oriented output.
- **FR-007**: The system MUST report the current step label, completed steps, pending steps, and detected warnings for long-running workflows while they are executing.
- **FR-008**: The system MUST summarize what succeeded, what failed, what changed, and what requires attention at the end of each major workflow.
- **FR-009**: The system MUST use guided prompts, selections, or confirmations for operations where user choice improves safety, configuration accuracy, or usability.
- **FR-010**: The system MUST explain the purpose and consequence of a prompted decision before asking the user to confirm or choose an option.
- **FR-011**: The default terminal interface and equivalent direct subcommands MUST use the same workflow state model and express the same operational states and outcomes.
- **FR-012**: The system MUST classify terminal workflow outcomes explicitly as success, degraded, or failed so users can tell the difference between full success, partial success, and full failure.
- **FR-013**: The system MUST preserve visibility into workflow progress and status until each command or interface action reaches a terminal state of success, degraded completion, cancellation, or failure, using an active spinner for in-flight work when the workflow is not yet at a terminal state.
- **FR-014**: The system MUST support a machine-readable mode for eligible direct commands only when the user explicitly requests it.
- **FR-015**: Machine-readable mode MUST represent the same underlying status and outcome semantics that the human-readable experience presents.
- **FR-016**: Inspection and status workflows MUST remain non-interactive by default so they can be used safely in automation and scripting without prompt handling.
- **FR-017**: Mutating workflows MUST default to guided interactive execution for human operators, but MUST support explicit non-interactive invocation for automation-oriented use cases.
- **FR-018**: The system MUST detect and handle non-interactive execution contexts by avoiding unusable prompt flows and reporting what alternate invocation the user needs when explicit non-interactive flags were not supplied.
- **FR-019**: The system MUST detect when the terminal cannot comfortably present the full-screen interface and provide a clear fallback or guidance path.
- **FR-020**: The system MUST provide operator-visible feedback for setup, initialization, repair, upgrade, runtime lifecycle, and MCP inspection workflows that makes the current state of each workflow explicit through step-based progress and terminal outcome summaries.
- **FR-021**: Terminal outcome presentations MUST state the impact on the project or runtime, the work that completed successfully, any blocked capability, and the recommended next action.
- **FR-022**: The system MUST ensure that equivalent actions initiated from the TUI or direct subcommands produce matching status terminology, warning semantics, and end-state reporting.
- **FR-023**: Inspection and status workflows invoked from the TUI and direct subcommands MUST preserve the same non-interactive default semantics unless the user explicitly enters a guided action flow.
- **FR-024**: Lower-frequency workflows outside the first-release TUI scope MAY remain direct-command-first in the initial release as long as they preserve the same human-readable UX standards and discoverability guidance from the dashboard.
- **FR-025**: The first-release TUI and direct-command UX MUST support keyboard-first interaction without requiring pointer input.
- **FR-026**: Status, warnings, success, and failure states MUST NOT rely on color alone to convey meaning.
- **FR-027**: Progress indicators and animated feedback MUST preserve usable reduced-motion behavior for terminals or operators that prefer less motion.
- **FR-028**: Operator-visible text output MUST use screen-reader-friendly text semantics where terminal support allows, including explicit labels for state and outcome instead of decorative-only cues.
- **FR-029**: Major workflow summaries MUST preserve evidence of partial success by explicitly identifying completed steps and still-valid outcomes even when a later step degrades or fails.
- **FR-030**: Equivalent TUI and direct-command workflows MUST use the same success, degraded, and failed terminal outcome semantics.

### Runtime Truth and Validation Requirements *(mandatory for runtime, MCP, adapter, or orchestration features)*

- **RTV-001**: Runtime, repair, upgrade, and MCP inspection workflows MUST derive displayed status from observed project-local state and live checks rather than from static assumptions or canned messages.
- **RTV-002**: The system MUST validate real runtime availability and health before presenting runtime control or inspection workflows as ready.
- **RTV-003**: Long-running operational workflows MUST not report healthy completion until required readiness, validation, or health steps have actually finished.
- **RTV-004**: Degraded or failed workflow output MUST identify the observed root cause, affected capability, corrective action, and completed safe work based on live validation or runtime evidence.
- **RTV-005**: Guided prompts for repair, upgrade, and runtime control MUST be based on the observed current state of the project and runtime rather than generic static recommendations.
- **RTV-006**: Machine-readable output for eligible operational commands MUST expose the same observed status, warnings, and result classification as the human-readable path.
- **RTV-007**: Non-interactive inspection and status workflows MUST produce the same observed state classifications and warning semantics without requiring prompt-driven execution.
- **RTV-008**: Feature documentation under `docs/features/` MUST be updated with observed workflow states, prompt behavior, runtime prerequisites, degraded cases, and machine-readable mode behavior.

### CLI Experience Requirements *(mandatory for CLI, TUI, interactive workflow, or operator-facing command features)*

- **CLI-001**: CLI features MUST present progress, current state, and results through structured output built with Pastel, Ink, and `@inkjs/ui`.
- **CLI-002**: Long-running operations MUST show visible step-based progress indicators until completion, failure, or cancellation.
- **CLI-003**: Interactive prompts MUST be used when they improve safety, configuration correctness, or usability.
- **CLI-004**: Full-screen TUI flows and direct subcommands MUST reuse a shared state model and visual language for the same workflow.
- **CLI-005**: Human-readable output MUST be the default; machine-readable output MAY be offered only when explicitly requested and MUST remain semantically equivalent.
- **CLI-006**: Feature documentation MUST describe the operator-visible states, prompts, and machine-readable mode behavior for the affected commands.
- **CLI-007**: CLI features MUST support keyboard-first operation and MUST provide non-color cues for all important states.
- **CLI-008**: CLI animations and progress indicators MUST degrade safely for reduced-motion preferences or constrained terminals.
- **CLI-009**: CLI text output MUST prioritize screen-reader-friendly wording and explicit labels where terminal support allows assistive interpretation.
- **CLI-010**: Major workflows MUST expose explicit step labels, completed-step history, an active spinner for in-flight work, and a terminal summary that preserves partial-success evidence.
- **CLI-011**: Major workflows MUST render terminal outcomes using the shared success, degraded, and failed outcome model with explicit impact and next-action text.

### Key Entities *(include if feature involves data)*

- **CLI Workflow State**: The current lifecycle of an operator-facing workflow, including current step, completed steps, pending steps, warnings, failures, and final outcome.
- **TUI Navigation Surface**: The full-screen entry interface that presents product areas, current project state, and the actions a user can launch.
- **Command Presentation Mode**: The user-visible rendering style for a command, including human-readable interactive output and explicitly requested machine-readable output.
- **Guided Decision Point**: A workflow moment where the system prompts the user to select an option or confirm an action because the choice affects safety, configuration, or usability.
- **Operational Outcome Summary**: The final user-facing summary of what changed, what succeeded, what failed, what remains degraded, and what attention is required.

### Assumptions

- The most important operator-facing workflows are setup, initialization, repair, upgrade, runtime lifecycle control, and MCP inspection.
- The default experience should favor interactive human guidance, while automation-oriented output remains available only when explicitly requested.
- Some command contexts will remain non-interactive, so the feature must preserve scripted usage without forcing prompts that cannot be answered.
- Inspection and status workflows are expected to remain non-interactive by default, while mutating workflows can require explicit flags to suppress guided prompts in automation.
- Accessibility expectations are limited by terminal capabilities, but keyboard-first operation, non-color cues, reduced-motion-safe behavior, and explicit text semantics are required wherever the environment can support them.
- The desired product quality is a cohesive experience across the TUI and direct commands rather than two separate UX models.

### Dependencies and Scope Boundaries

- The feature depends on existing major workflows already being callable through the CLI so they can be exposed through a unified terminal product experience.
- The feature depends on trustworthy workflow-state signals from runtime, configuration, repair, upgrade, and MCP inspection operations.
- The feature covers user interaction, workflow presentation, progress visibility, prompt design, and machine-readable parity for operator-facing CLI surfaces.
- The initial full-screen TUI scope covers home or dashboard, setup or init, runtime control, upgrade or repair, and MCP inspection.
- The feature does not require removing direct subcommands in favor of TUI-only interaction.
- The feature does not require moving every lower-frequency CLI surface into the full-screen TUI in the first release.
- The feature does not require adding entirely new product workflows beyond improving how existing major workflows are launched, observed, and guided.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time evaluators can launch `mimirmesh`, identify a major workflow to run, and start it from the TUI within 60 seconds.
- **SC-002**: At least 95% of runs of setup, init, repair, upgrade, runtime lifecycle, and MCP inspection workflows present continuous progress or current-state visibility from start until terminal outcome.
- **SC-003**: At least 90% of surveyed users report that direct commands communicate what the system is doing and what happened clearly enough that they do not feel like raw machine output.
- **SC-004**: At least 95% of operator-visible workflow completions end with a summary that correctly states what succeeded, what failed, and what requires attention.
- **SC-005**: At least 90% of guided prompts in sensitive workflows reduce unsafe or mistaken operator choices compared with the previous argument-only experience.
- **SC-006**: In 100% of supported machine-readable command runs, the output can be explicitly requested without changing the command's underlying status or result meaning.
- **SC-007**: At least 90% of equivalent TUI and direct-command workflow runs produce matching state terminology and matching end-state classifications.

### Runtime Validation Outcomes *(mandatory for runtime, MCP, adapter, or orchestration features)*

- **RVO-001**: Validation proves that displayed runtime, upgrade, repair, and MCP inspection states match observed project-local state and live checks during representative workflows.
- **RVO-002**: Validation proves that long-running workflows do not report successful completion before required readiness, validation, or health checks finish.
- **RVO-003**: Validation proves that degraded and failed outcomes include reproducible diagnostics, impacted capabilities, and next actions tied to observed evidence.
- **RVO-004**: Documentation updates under `docs/features/` match the observed workflow states, prompts, degraded cases, and machine-readable behavior used during validation.

### CLI Experience Outcomes *(mandatory for CLI, TUI, interactive workflow, or operator-facing command features)*

- **CLO-001**: Operators can identify the current progress state and resulting outcome for each major workflow without ambiguity.
- **CLO-002**: Equivalent TUI and direct-command workflows present the same state transitions and outcome semantics.
- **CLO-003**: Prompted workflows prevent unsafe or confusing operational choices more effectively than raw argument-only execution.
- **CLO-004**: Machine-readable output, when supported, can be requested explicitly without degrading the default human-first experience.
- **CLO-005**: Keyboard-only operators can complete major first-release workflows without depending on color-only meaning or motion-heavy feedback.
- **CLO-006**: Operators can identify the active step, completed steps, and any partial-success evidence for every major workflow without relying on guessed progress or silent waiting.
- **CLO-007**: Operators can distinguish success, degraded, and failed outcomes consistently across the TUI and direct commands and can see the impact and next action for each.
