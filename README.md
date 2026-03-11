# MímirMesh

MímirMesh is a local-first project intelligence platform with:

- a production CLI (`mimirmesh` and `mm`)
- a unified MCP server (`mimirmesh-server`)
- an MCP client/orchestration binary (`mimirmesh-client`)
- project-scoped runtime orchestration in `.mimirmesh/`
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

docs/
  architecture/
  operations/
  runbooks/
  features/
  adr/
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
mimirmesh init
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
