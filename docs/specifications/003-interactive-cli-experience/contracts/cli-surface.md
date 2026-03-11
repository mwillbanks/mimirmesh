# CLI Surface Contract: Interactive CLI Experience

## 1. Bare Command Contract

Running `mimirmesh` with no subcommand must launch the full-screen shell instead of a passive status dump.

The first-release shell must provide navigable access to:

- dashboard or home
- setup or init
- runtime control
- upgrade or repair
- MCP inspection

The shell must also expose discoverable launch paths for lower-frequency command-first areas, including:

- configuration
- reports
- notes
- install-ide and related integration tasks

## 2. Direct Command Contract

Direct subcommands remain supported and must render human-first operator feedback by default.

For major workflows, direct commands must show:

- workflow title
- active step label
- completed-step history
- active spinner while work is in flight
- warnings or degraded evidence as they become relevant
- final terminal outcome summary

Inspection and status workflows remain non-interactive by default.

Mutating workflows may prompt when operator guidance materially improves safety or correctness, but they must also provide explicit non-interactive invocation for automation.

## 3. Prompt Contract

When prompts appear, they must:

- use `@inkjs/ui` input controls
- explain why input is required
- show recommended/default action where appropriate
- identify the consequence of the choice
- provide a documented non-interactive alternative for automation-sensitive mutating commands

## 4. Accessibility Contract

All TUI and human-readable direct-command flows must support:

- keyboard-first navigation
- non-color cues for important state
- reduced-motion-safe progress behavior
- explicit, screen-reader-friendly labels where terminal support allows

## 5. Terminal Outcome Contract

Every terminal workflow must end with one shared outcome class:

- `success`
- `degraded`
- `failed`

Each outcome must include:

- operator-visible impact statement
- completed work summary
- blocked capability summary, if any
- recommended next action
