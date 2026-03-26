# CLI Command Surface

The CLI supports install/refresh/doctor, config operations, runtime lifecycle, runtime upgrade/repair flows, MCP tools, notes, documents, reports, IDE install, bundled skill management, update checks, and Spec Kit flows.

The CLI is a primary product interface. Operator-facing commands are expected
to present a polished interactive terminal experience with structured output,
visible progress for long-running work, and prompt-driven flows where they
improve safety or usability. The full-screen TUI and direct subcommands are
expected to share the same state model and visual language. Human-readable
output is the default; machine-readable output is supported only when
explicitly requested.

## Entry Surface

`mimirmesh` is no longer a passive status dump. The bare command launches the
interactive dashboard shell and uses the shared shell frame, navigation model,
and workflow launchers to expose:

- home/dashboard summary
- guided install
- runtime lifecycle control
- runtime upgrade and repair
- MCP inspection

Compact terminals fall back to a command-first guidance view instead of
pretending the full dashboard fits.

## Direct Command Presentation

Default direct commands now render:

- workflow title and description
- active step and step history
- visible warnings and observed state
- a terminal outcome with `success`, `degraded`, or `failed`
- impact, completed work, blocked capability, and next action sections

The default human UX is intentionally not raw JSON.

## Prompt Policy

Interactive prompts are the default for consequential mutating workflows.
Examples include:

- `install`
- `install ide`
- `skills install|update|remove`
- `runtime start|stop|restart|refresh`
- `runtime upgrade migrate|repair`
- `config set|enable|disable`

If the command runs in a non-interactive terminal without `--non-interactive`,
the CLI returns a failed workflow outcome that explains the automation-safe
fallback instead of hanging or guessing.

Inspection commands such as `runtime status`, `runtime upgrade status`, and
`mcp list-tools` stay non-interactive by default.

## Machine-Readable Mode

Use `--json` when a caller needs the serialized workflow envelope. The JSON
output preserves:

- workflow identity and phase
- step state
- warnings and observed details
- terminal outcome semantics
- the command-specific machine payload nested under `outcome.payload`

Skill registry machine-readable output is available for:

- `mimirmesh skills find`
- `mimirmesh skills read <skill-name>`
- `mimirmesh skills resolve <prompt>`
- `mimirmesh skills refresh`
- `mimirmesh skills create`
- `mimirmesh skills update <skill-name>`

All runtime and MCP behavior claims in feature documentation are expected to be
derived from live runtime execution, including prerequisite configuration,
bootstrap/indexing status, and degraded-mode diagnostics.

Spec Kit behavior is upstream-backed, not synthetic:

- `mimirmesh speckit init` installs or reuses the upstream `specify` CLI
- `mimirmesh speckit init` creates `.specify/` and agent prompts, then translates generated `specs/` references to `docs/specifications/`
- `mimirmesh speckit status` reports readiness from actual `.specify/` state
- `mimirmesh speckit doctor` flags partial states such as prompt files without `.specify/`
- `mimirmesh install` runs the same Spec Kit initialization flow automatically when `metadata.specKitExpected` is true and the repo is not Spec Kit-ready
- `mimirmesh skills update <skill-name>` switches to the guided authoring surface when the target is not one of the bundled MímirMesh skills; otherwise it keeps the bundled maintenance flow

The umbrella install workflow is now the canonical onboarding surface:

- `mimirmesh install` starts with an installation preset, shows a short explanation for the focused preset, and lets the operator press space to mark a preset or enter to continue with the highlighted preset
- interactive preset review keeps the explanation visible next to the preset list so the operator can tell what each preset includes before continuing
- the core install area covers docs scaffolding, runtime files, report generation, repository analysis, Spec Kit bootstrap, and readiness validation
- optional install areas currently include IDE integration and bundled skills
- interactive IDE review allows multiple targets in one run, and non-interactive IDE review accepts comma-separated `--ide` targets such as `vscode,cursor`
- when bundled skills are selected, install now treats embeddings setup as a first-class step and supports `disabled`, `docker-llama-cpp`, `existing-lm-studio`, `existing-openai-compatible`, and `openai`
- existing-runtime embeddings modes do not force a Docker-managed local runtime; instead the installer prompts for and persists the required endpoint, model, and API key settings for the chosen mode
- reruns detect current install state and surface install-managed updates for confirmation before applying them
- non-interactive reruns can pass `--yes` to auto-confirm install-managed updates in CI or other unattended flows
- `--non-interactive` requires an explicit preset or explicit install-area selections and fails safely when they are missing
- human-readable output remains the default, while `--json` preserves the same outcome semantics under `outcome.payload`

Use `mimirmesh --help` for top-level usage and `mimirmesh <command> --help` for command-level detail.

Bundled skill commands:

- `mimirmesh skills install [skill-name]`
- `mimirmesh skills update [skill-name]`
- `mimirmesh skills remove [skill-name]`

Deterministic skill registry commands:

- `mimirmesh skills find`
- `mimirmesh skills read <skill-name>`
- `mimirmesh skills resolve <prompt>`
- `mimirmesh skills refresh`
- `mimirmesh skills create`
- `mimirmesh skills update <skill-name>`

Bundled skill workflows install into `.agents/skills/` and use the same prompt discipline as other mutating flows:

- interactive `install` shows all bundled skills and defaults all to selected
- interactive `update` shows only installed outdated skills and defaults all to selected
- interactive `remove` shows installed skills and defaults none to selected
- `--non-interactive` install and update use the documented all-target safe path
- `--non-interactive` remove requires an explicit `skill-name`

The deterministic skill registry commands follow the six-tool MCP contract:

- `find` returns minimal discovery results by default
- `read` defaults to the compressed `memory` read shape and omits asset indexes unless they are explicitly requested
- `resolve` uses prompt text plus repository-local config, optional task metadata, and persisted repository embeddings when that index has been built
- `refresh` is the sole mutation path for the repository-scoped skill index, PostgreSQL-backed cache state, and embedding refresh behavior
- `create` and `update` provide guided authoring with validation and deterministic defaults
- `skills update` without a non-bundled skill target remains the bundled maintenance surface

When local embeddings hosting is selected, the runtime no longer relies on a host-native llama.cpp assumption. Install writes a Docker-managed `llama_cpp` provider profile, and runtime rendering materializes the bundled `docker/images/llama-cpp/Dockerfile` asset into `.mimirmesh/runtime/images/llama-cpp/Dockerfile` before Compose builds a project-scoped image around an official `ghcr.io/ggml-org/llama.cpp` base image.

Install mode defaults to symbolic links and can be overridden through the optional global config file `~/.mimirmesh/config.yml` with `skills.install.symbolic: false`.

Runtime upgrade commands:

- `mimirmesh upgrade`
- `mimirmesh runtime refresh`
- `mimirmesh runtime doctor`
- `mimirmesh runtime upgrade`
- `mimirmesh runtime upgrade status`
- `mimirmesh runtime upgrade migrate`
- `mimirmesh runtime upgrade repair`

`mimirmesh runtime status` now includes runtime version, schema version, health, and migration status evidence sourced from `.mimirmesh/runtime/`.
