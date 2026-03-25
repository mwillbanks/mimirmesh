# Quickstart: Validate Interactive CLI Experience

## 1. Launch the full-screen shell

From a repository root, run:

- `mimirmesh`

Validate that the bare command opens a branded full-screen shell and does not fall back to a passive status summary.

Confirm the first-release navigation includes:

- dashboard or home
- install
- runtime control
- upgrade or repair
- MCP inspection

Confirm the dashboard also exposes discoverable launch paths for configuration, reports, notes, and integration tasks.

## 2. Validate direct-command UX for a long-running workflow

Run a representative mutating command such as:

- `mimirmesh install`
- `mimirmesh runtime upgrade migrate`

Confirm the command shows:

- workflow title
- active step label
- spinner during in-flight work
- completed-step history
- warnings or degraded evidence when relevant
- a final terminal outcome classified as `success`, `degraded`, or `failed`

## 3. Validate non-interactive inspection behavior

Run a default non-interactive command such as:

- `mimirmesh runtime status`
- `mimirmesh runtime upgrade status`
- `mimirmesh mcp list-tools`

Confirm the command does not prompt by default and still reports the observed state, warnings, and next action clearly.

## 4. Validate guided prompts for mutating flows

Run representative guided workflows such as:

- `mimirmesh install ide`
- `mimirmesh runtime upgrade repair`

Confirm prompts use `@inkjs/ui` controls, explain why input is required, and provide clear consequences or recommended defaults.

## 5. Validate explicit machine-readable mode

Run a supported direct command with explicit machine-readable mode.

Confirm that the output preserves:

- workflow identifier
- terminal outcome class
- warnings or degraded evidence
- recommended next action

Also confirm the same command remains human-readable by default when machine-readable mode is not requested.

## 6. Validate degraded-state presentation

Use a fixture or environment state that causes a recoverable degraded outcome, such as unavailable Docker during a runtime-oriented workflow or a partially repairable runtime state.

Confirm the CLI reports:

- `degraded` as the terminal outcome
- what completed successfully
- what capability is blocked
- actionable next steps

## 7. Validate accessibility-sensitive behavior

Confirm that major TUI and direct-command workflows remain usable with:

- keyboard-only navigation
- non-color status cues
- reduced-motion-safe progress behavior
- explicit text labels that remain understandable without decorative styling alone

## 8. Update documentation from observed behavior

After validation, update:

- `docs/features/cli-command-surface.md`
- `docs/operations/runtime.md`
- `README.md` where CLI behavior expectations changed materially

Documentation must reflect observed shell behavior, prompt policy, machine-readable mode policy, degraded outcomes, and first-release TUI scope.
