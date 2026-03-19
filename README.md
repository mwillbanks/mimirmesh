<div align="center">
  <img src="logo.svg" alt="MímirMesh logo" width="160" height="auto" />
  <h1>MímirMesh</h1>
  <p><b>Local-first project intelligence for MCP-enabled coding workflows</b></p>
</div>

## Early Alpha

MímirMesh is in **early alpha**.

- behavior, commands, and defaults can change quickly
- some workflows are still hardening
- you should expect occasional breakage between releases

Use [docs/roadmap.md](docs/roadmap.md) to see where the platform is heading.

## What You Get

- an interactive CLI (`mimirmesh`, alias `mm`)
- a local MCP server (`mimirmesh-server`)
- a local MCP client (`mimirmesh-client`)
- project-scoped runtime state under `.mimirmesh/`
- bundled first-party skills under `.agents/skills/`
- unified tool routing with provenance-aware MCP responses

## Requirements

Required:

- macOS or Linux
- [Bun](https://bun.sh/) 1.3+
- Docker Engine with Docker Compose support
- Git

Optional but useful:

- NVIDIA container runtime for GPU mode (`runtime.gpuMode=on`)
- Python `uv` for automatic Spec Kit bootstrap (`mimirmesh speckit init`)

If Docker is unavailable, MímirMesh stays truthful and reports degraded or failed runtime-backed operations with actionable diagnostics.

## Install

Install the latest published release:

```bash
curl -fsSL https://github.com/mwillbanks/mimirmesh/releases/latest/download/install.sh | bash
```

Default install path is `~/.local/bin`. Override with:

```bash
MIMIRMESH_INSTALL_DIR="$HOME/.local/bin" curl -fsSL https://github.com/mwillbanks/mimirmesh/releases/latest/download/install.sh | bash
```

## Quick Start

From a target repository:

```bash
mimirmesh init
```

For non-interactive environments:

```bash
mimirmesh init --non-interactive
```

Then check status:

```bash
mimirmesh runtime status
mimirmesh mcp list-tools
```

## Default Runtime Engines

MímirMesh ships with these runtime services by default:

| Service | Purpose | Notes |
|---|---|---|
| `mm-srclight` | Code intelligence (symbols, search, hierarchy, tracing) | Preferred route for unified code-intel tools |
| `mm-document-mcp` | Documentation retrieval and ranking | Used by routed docs flows |
| `mm-adr-analysis` | ADR and architecture analysis | Powers architecture/documentation tools |

Runtime behavior:

- engines are discovered from live runtime state
- unified tools are preferred over engine passthrough tools
- transport-safe aliases are exposed for MCP clients that reject dotted names
- all state is project-scoped in `.mimirmesh/runtime/`

## Daily Commands

```text
mimirmesh
mimirmesh init
mimirmesh setup
mimirmesh refresh
mimirmesh doctor

mimirmesh runtime start
mimirmesh runtime stop
mimirmesh runtime restart
mimirmesh runtime status

mimirmesh mcp list-tools
mimirmesh mcp tool <tool> [json]

mimirmesh install ide
mimirmesh skills install [skill-name]
mimirmesh skills update [skill-name]
mimirmesh skills remove [skill-name]

mimirmesh update --check
mimirmesh update
```

## Internal Projects and Bundled Capabilities

MímirMesh includes first-party skill packages and runtime images in this repository.

- skill bundle source: `packages/skills/`
- runtime image definitions: `docker/images/`
- runtime compose templates/scripts: `packages/runtime/`

Bundled core skills:

- `mimirmesh-agent-router`
- `mimirmesh-code-navigation`
- `mimirmesh-code-investigation`
- `mimirmesh-speckit-delivery`
- `mimirmesh-architecture-delivery`
- `mimirmesh-integration-analysis`
- `mimirmesh-operational-policies`

## Developer Setup

```bash
bun install
bun run build
```

Install locally built binaries:

```bash
MIMIRMESH_INSTALL_DIR="$HOME/.local/bin" bun run scripts/install.ts
```

Validation commands:

```bash
bun run typecheck
bun run test
bun run build
```

Integration tests need Docker runtime support and are intentionally optional in constrained CI environments:

```bash
MIMIRMESH_RUN_INTEGRATION_TESTS=false bun run scripts/run-integration-tests.ts
```

## CI/CD Notes

GitHub Actions workflows in this repository run typecheck, tests, build, and Biome checks.
Runtime-heavy live validation is not required on hosted runners and can be gated with `MIMIRMESH_RUN_INTEGRATION_TESTS=false`.

## Roadmap and Direction

- roadmap: [docs/roadmap.md](docs/roadmap.md)
- architecture: [docs/architecture/overview.md](docs/architecture/overview.md)
- runtime operations: [docs/operations/runtime.md](docs/operations/runtime.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, standards, and pull request expectations.

## License

[MIT](LICENSE)
