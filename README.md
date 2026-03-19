<div align="center">
  <img src="logo.svg" alt="MímirMesh logo" width="160" height="auto" />
  <h1>MímirMesh</h1>
  <p><b>Local-first project intelligence platform</b></p>
</div>

- a production CLI (`mimirmesh` and `mm`)
- a unified MCP server (`mimirmesh-server`)
- an MCP client/orchestration binary (`mimirmesh-client`)
- project-scoped runtime orchestration in `.mimirmesh/`
- repository-local bundled skill management in `.agents/skills/`
- adapter-driven multi-engine MCP routing
- Spec Kit-aware status, init, and diagnostics

## Stack

- Bun workspaces + Bun runtime/build (`bun build --compile`)
- TypeScript
- Pastel + Ink + `@inkjs/ui` for CLI command UX
- Official MCP TypeScript SDK (`@modelcontextprotocol/sdk`)
- Biome for formatting and linting

## Monorepo Layout

```text
apps/
  cli/
  server/
  client/

packages/
  config/
  logging/
  runtime/
  mcp-core/
  mcp-adapters/
  ui/
  reports/
  workspace/
  templates/
  installer/
  testing/
  skills/

docs/
  architecture/
  operations/
  runbooks/
  features/
  adr/
  roadmap.md
  specifications/
```

## Build and Install

### 1. Install dependencies

```bash
bun install
```

### 2. Build single-file binaries

```bash
bun run build
```

Artifacts are generated in `dist/`:

- `dist/mimirmesh`
- `dist/mm`
- `dist/mimirmesh-server`
- `dist/mimirmesh-client`
- `dist/manifest.json`
- `dist/mimirmesh-assets/skills/catalog.json`

### 3. Install locally

```bash
MIMIRMESH_INSTALL_DIR="$HOME/.local/bin" bun run scripts/install.ts
```

This installs:

- `mimirmesh`
- `mm`
- `mimirmesh-server`
- `mimirmesh-client`

into the chosen bin directory.

## First Run

From a target repository:

```bash
mimirmesh
```

The bare `mimirmesh` command now opens the interactive dashboard shell when the terminal is large enough for the full layout. The shell shows live project, runtime, upgrade, and MCP state, and exposes keyboard-first launchers for setup, runtime control, upgrade/repair, and MCP inspection.

The shell boot surface now includes a terminal-safe rendering of the MímirMesh logo mark so the dashboard, loading screen, and compact shell all share the same branded entry treatment.

In compact terminals such as the VS Code integrated terminal, the CLI keeps an interactive compact dashboard instead of immediately falling back, and only switches to command-first guidance when the terminal is genuinely too small for safe navigation.

From a target repository, initialize the project with:

```bash
mimirmesh init
```

For automation or other non-interactive terminals, use:

```bash
mimirmesh init --non-interactive
```

`init` performs:

- prerequisite checks
- `.mimirmesh/` creation
- config generation (`.mimirmesh/config.yml`)
- Docker Compose generation (`.mimirmesh/runtime/docker-compose.yml`)
- runtime start attempt and health capture
- repo analysis/indexing orchestration
- baseline report generation
- Spec Kit detection
- real Spec Kit initialization when the repository is expected to use Spec Kit and `.specify/` is not ready
- translation of upstream `specs/` references into MímirMesh's canonical `docs/specifications/` structure

If Docker is unavailable, runtime-backed operations degrade safely with actionable diagnostics.

## Spec Kit Integration

MímirMesh uses the upstream GitHub Spec Kit CLI instead of a local shim.

- `mimirmesh speckit init` resolves `specify` from `PATH` or installs it with `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git`
- initialization runs the upstream flow with `specify init --here --force --ai codex --ignore-agent-tools --no-git`
- the upstream `.specify/` layout is preserved
- upstream `specs/` references are translated into `docs/specifications/`
- `mimirmesh speckit status` is only `initialized: true` when `.specify/` exists
- `mimirmesh speckit doctor` reports partial states such as orphaned agent prompts without `.specify/`

Expected repository state after `mimirmesh speckit init`:

```text
.specify/
.codex/prompts/
docs/specifications/
```

## CLI Surface

```text
mimirmesh init
mimirmesh setup
mimirmesh refresh
mimirmesh doctor

mimirmesh config get
mimirmesh config set
mimirmesh config enable <engine>
mimirmesh config disable <engine>
mimirmesh config validate

mimirmesh runtime start
mimirmesh runtime stop
mimirmesh runtime restart
mimirmesh runtime status

mimirmesh mcp list-tools
mimirmesh mcp tool <tool> [json]

mimirmesh note add
mimirmesh note list
mimirmesh note search

mimirmesh document add
mimirmesh report generate
mimirmesh report show <name>

mimirmesh install ide
mimirmesh skills install [skill-name]
mimirmesh skills update [skill-name]
mimirmesh skills remove [skill-name]
mimirmesh update
mimirmesh update --check

mimirmesh speckit init
mimirmesh speckit status
mimirmesh speckit doctor
```

`mimirmesh install ide` now writes target-specific MCP config shapes:

- VS Code: `servers`
- Cursor/Claude/Codex: `mcpServers`

and defaults server invocation to `mimirmesh server` when no dedicated server binary path is resolved.

## Bundled Skills

MímirMesh ships a first-party skill bundle under `packages/skills/` and exposes repository-local management commands:

- `mimirmesh skills install [skill-name]`
- `mimirmesh skills update [skill-name]`
- `mimirmesh skills remove [skill-name]`

Installed skills are attached at `.agents/skills/<skill-name>`.

Interactive behavior:

- `install` shows all bundled skills and preselects all of them
- `update` shows only installed bundled skills that are currently out of date and preselects all of them
- `remove` shows installed bundled skills and preselects none of them

Non-interactive behavior stays explicit:

- `mimirmesh skills install --non-interactive` installs all bundled skills
- `mimirmesh skills update --non-interactive` refreshes all outdated installed bundled skills
- `mimirmesh skills remove <skill-name> --non-interactive` removes one explicit installed skill

Install mode is controlled by the optional global config file `~/.mimirmesh/config.yml`:

```yaml
version: 1
skills:
  install:
    symbolic: true
```

When `skills.install.symbolic` is `true`, installs use symbolic links by default. When it is `false`, installs copy the bundled skill directory instead. If the global config file does not exist, MímirMesh behaves as if `symbolic: true` were configured.

## CLI UX Model

Default human-facing commands now share one workflow presentation model:

- step-based progress with explicit current-step labels
- visible spinner or active-state messaging for in-flight work
- terminal summaries classified as `success`, `degraded`, or `failed`
- impact, completed work, blocked capability, and next action sections
- non-color cues such as `[SUCCESS]`, `[DEGRADED]`, `[FAILED]`, `[WARNING]`, and `[INFO]`

The dashboard shell also adapts to terminal size:

- `wide`: full shell with sidebar, detailed status, and the full branded header
- `standard` and `compact`: reduced chrome and compact navigation so the dashboard remains usable in smaller terminals
- extremely small terminals: explicit fallback guidance instead of a broken or clipped TUI

Mutating workflows prompt by default in interactive terminals when a decision materially affects the result. Examples include:

- `mimirmesh init`
- `mimirmesh install ide`
- `mimirmesh runtime start|stop|restart|refresh`
- `mimirmesh runtime upgrade migrate|repair`
- `mimirmesh config set|enable|disable`

Automation-safe execution remains available through explicit flags:

- `--non-interactive` skips prompts and requires the documented safe path
- `--json` emits the machine-readable workflow envelope instead of the human-facing renderer

Inspection flows such as `runtime status`, `runtime upgrade status`, and `mcp list-tools` remain non-interactive by default.

## Runtime State

Project-local state:

```text
.mimirmesh/
  config.yml
  logs/
    error.log
    sessions/
  memory/
  templates/
  reports/
  indexes/
  runtime/
    docker-compose.yml
    connection.json
    health.json
  cache/
```

## MCP Tools

Unified tools include:

- `explain_project`
- `explain_subsystem`
- `find_symbol`
- `search_code`
- `search_docs`
- `trace_dependency`
- `trace_integration`
- `investigate_issue`
- `evaluate_codebase`
- `generate_adr`

The routed surface is the intended agent-facing contract. Skills and agents should prefer these unified tools before engine-specific passthrough tools, then escalate only when routed evidence is insufficient.

## Skills Bundle

MímirMesh now ships a production skill bundle in `packages/skills/` and copies it into build artifacts under `dist/mimirmesh-assets/skills/`.

Primary skills:

- `mimirmesh-agent-router`
- `mimirmesh-code-navigation`
- `mimirmesh-code-investigation`
- `mimirmesh-speckit-delivery`
- `mimirmesh-architecture-delivery`
- `mimirmesh-integration-analysis`

Supporting shared policy skill:

- `mimirmesh-operational-policies`
- `document_feature`
- `document_architecture`
- `document_runbook`
- `runtime_status`
- `config_get`
- `config_set`

Passthrough namespaces include:

- `mimirmesh.codebase.*`
- `mimirmesh.srclight.*`
- `mimirmesh.docs.*`
- `mimirmesh.adr.*`

For MCP transports that only allow `[a-z0-9_-]` tool names (such as VS Code MCP), passthrough
names are exposed as normalized aliases like `mimirmesh_srclight_search_symbols`.

## Reports

Generated under `.mimirmesh/reports/`:

- `project-summary.md`
- `architecture.md`
- `deployment.md`
- `runtime-health.md`
- `speckit-status.md`

## Roadmap

Planning and prioritization for token efficiency, MCP expansion, dynamic merged routes, and UX/runtime improvements are tracked in [docs/roadmap.md](docs/roadmap.md).

## Validation Commands

```bash
bun run check
bun run typecheck
bun run test
bun run build
```

Test layers:

- unit: `tests/unit`
- integration: `tests/integration`
- workflow: `tests/workflow`

Fixture repositories:

- `packages/testing/fixtures/single-ts`
- `packages/testing/fixtures/bun-monorepo`
- `packages/testing/fixtures/docs-heavy`
- `packages/testing/fixtures/docker-iac`
