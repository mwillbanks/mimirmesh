# Data Model: Interactive CLI Experience

## Entity: WorkflowDefinition

**Purpose**: Describes one operator-facing CLI workflow and where it is available.

**Fields**:
- `id`: stable workflow identifier such as `install`, `runtime-status`, or `runtime-upgrade`
- `title`: human-facing workflow title
- `category`: `dashboard`, `setup`, `runtime`, `mcp`, `configuration`, `reporting`, `notes`, `repair`, `upgrade`, or `integration`
- `entryModes`: ordered list of `tui-embedded`, `tui-launcher`, `direct-command`
- `interactivePolicy`: `default-interactive`, `default-non-interactive`, or `explicit-choice`
- `machineReadableSupported`: boolean
- `requiresProjectContext`: boolean
- `recommendedNextActions`: ordered list of related workflow identifiers

**Validation Rules**:
- Every workflow must expose at least one entry mode.
- `default-non-interactive` may be used only for inspection or status workflows.
- Workflows launched from both TUI and direct commands must share the same `id` and outcome semantics.

## Entity: WorkflowRunState

**Purpose**: Represents the live state of a workflow execution shared by the TUI and direct-command renderers.

**Fields**:
- `workflowId`
- `phase`: `idle`, `running`, `awaiting-input`, `success`, `degraded`, `failed`, or `cancelled`
- `activeStepId`: current step or `null`
- `completedStepIds`: ordered list of finished steps
- `warningIds`: ordered list of active warnings
- `details`: operator-visible evidence rows
- `startedAt`
- `completedAt`: timestamp when terminal, if any

**Validation Rules**:
- `phase=running` requires an `activeStepId`.
- `phase=success`, `degraded`, or `failed` requires `completedAt`.
- `completedStepIds` must preserve workflow step ordering.

## Entity: WorkflowStep

**Purpose**: Defines one visible step in a long-running CLI workflow.

**Fields**:
- `id`
- `label`: explicit operator-visible step name
- `kind`: `validation`, `generation`, `runtime-action`, `discovery`, `bootstrap`, `prompt`, `reporting`, or `finalization`
- `status`: `pending`, `running`, `completed`, `degraded`, `failed`, or `skipped`
- `summary`: short human-readable explanation of what the step did
- `evidence`: optional structured key/value rows tied to the step

**Validation Rules**:
- Exactly one step may be `running` at a time.
- A terminal `failed` step must belong only to a workflow with terminal phase `failed` or `degraded`.
- `summary` must be explicit enough to speak the action in screen-reader-friendly text.

## Entity: TerminalOutcome

**Purpose**: Canonical terminal result model shared by TUI and direct-command UX.

**Fields**:
- `kind`: `success`, `degraded`, or `failed`
- `message`: primary result statement
- `impact`: description of what the outcome means for project or runtime usability
- `completedWork`: ordered list of completed steps or achievements
- `blockedCapabilities`: list of capabilities unavailable after the run
- `nextAction`: recommended operator action
- `machineReadablePayload`: semantically equivalent output structure for explicit automation mode

**Validation Rules**:
- Every terminal outcome must include `impact` and `nextAction`.
- `degraded` outcomes must include at least one `blockedCapability` or explicit preserved warning.
- `machineReadablePayload` must not contradict `message`, `impact`, or `kind`.

## Entity: PromptSession

**Purpose**: Tracks a guided decision point within a workflow.

**Fields**:
- `workflowId`
- `promptId`
- `controlType`: `confirm`, `select`, `text-input`, or `multi-select`
- `reason`: why user input is required
- `defaultAction`
- `choices`: available options, when applicable
- `response`: chosen or entered value, if completed
- `nonInteractiveFallback`: required explicit flag or alternate invocation

**Validation Rules**:
- Every prompt must explain `reason`.
- `default-non-interactive` workflows may not enter a prompt session unless the user explicitly enters a guided action flow.
- Mutating workflows must define a `nonInteractiveFallback` before prompting is allowed.

## Entity: PresentationProfile

**Purpose**: Captures operator-visible rendering preferences and environment constraints.

**Fields**:
- `mode`: `tui`, `direct-human`, or `direct-machine`
- `interactive`: boolean
- `reducedMotion`: boolean
- `colorSupport`: `none`, `basic`, or `rich`
- `screenReaderFriendlyText`: boolean
- `terminalSizeClass`: `compact`, `standard`, or `wide`

**Validation Rules**:
- `direct-machine` implies `interactive=false`.
- `compact` terminals must use fallback layouts that preserve step and outcome clarity.
- Important states may not rely solely on `colorSupport`.

## Entity: TuiNavigationNode

**Purpose**: Defines one navigable location in the full-screen shell.

**Fields**:
- `id`
- `title`
- `nodeType`: `dashboard`, `embedded-workflow`, `launcher`, or `detail-panel`
- `workflowId`: related workflow, if any
- `availability`: `always`, `project-required`, or `runtime-required`
- `statusSummary`: short current-state signal shown in navigation

**Validation Rules**:
- First-release embedded nodes must cover dashboard, install, runtime control, upgrade/repair, and MCP inspection.
- Lower-frequency nodes may be `launcher` types when the workflow remains direct-command-first.
