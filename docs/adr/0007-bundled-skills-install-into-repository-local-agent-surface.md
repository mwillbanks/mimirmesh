# ADR 0007: Bundled Skills Install Into a Repository-Local Agent Surface

- Status: Accepted
- Date: 2026-03-19
- Sources: `docs/specifications/006-skills-management/spec.md`, `README.md`, `AGENTS.md`

## Context

MímirMesh now ships a first-party bundled skill set under `packages/skills/`, but repositories still need a stable operational path to attach those skills to the local agent surface.

This introduces three constraints:

1. bundled skills must install into the repository, not a hidden global agent directory
2. the install mode must support both automatic tracking and safer copied installs
3. the CLI workflow must stay consistent with the project’s interactive command model

## Decision

MímirMesh manages bundled skills through repository-local CLI commands:

- `mimirmesh skills install [skill-name]`
- `mimirmesh skills update [skill-name]`
- `mimirmesh skills remove [skill-name]`

Bundled skills install into `.agents/skills/`.

Install mode is controlled by the global setting `skills.install.symbolic` in `~/.mimirmesh/config.yml`:

- `true` selects symbolic links
- `false` selects copied skill directories
- an absent global config file behaves the same as `true` without creating the file as a side effect

Interactive commands use multi-select prompts with action-specific defaults, and non-interactive behavior stays explicit and safe.

## Consequences

Positive:

- bundled skills stay repository-scoped
- symbolic links allow automatic refresh on application upgrades
- copied installs remain available for restrictive or safer environments
- the CLI keeps one consistent workflow model for mutating operations

Tradeoffs:

- a second config scope now exists for global MímirMesh preferences
- copied installs require explicit updates
- broken symbolic links must be detected and repaired during update flows
