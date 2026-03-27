<div align="center">
  <img src="logo.svg" alt="MímirMesh logo" width="160" height="auto" />
  <h1>MímirMesh</h1>
  <p><b>Local-first project intelligence for MCP-enabled coding workflows</b></p>
</div>

## What MímirMesh Is

MímirMesh is a local-first developer platform for AI-assisted software delivery.

It installs a project-scoped runtime, exposes a unified MCP tool surface, bundles first-party skills, and helps coding agents work against your repository with less noise, less duplicated context, and fewer token-wasting detours.

Instead of wiring together a pile of MCP servers, prompts, runtime containers, ad hoc repo instructions, and spec workflows by hand, MímirMesh gives you a repeatable project layer that makes those pieces work together.

## Why Use It

Most AI coding workflows break down in familiar ways:

- too many tools expose overlapping capabilities
- agents spend tokens discovering tools instead of using them
- project guidance is inconsistent across editors and agents
- code intelligence, documentation retrieval, and architecture context live in separate systems
- spec-driven delivery is optional in theory but absent in practice
- every repository ends up reinventing the same setup badly

MímirMesh exists to tighten that loop.

It gives you:

- a unified MCP surface that routes toward the right runtime-backed capability
- provenance-aware responses so you can understand where an answer came from
- bundled first-party skills that install into the repository and stay close to the work
- local-first runtime orchestration so your project intelligence is not floating around in random global state
- spec-driven delivery support through Spec Kit so requirements, plans, and implementation work stay connected
- lower token overhead by compressing tool and skill context instead of making agents rediscover everything on every run

## Why Not Just Use Raw MCP Servers or Prompts?

You can. Plenty of teams do.

The problem is that raw MCP server collections, loose prompt files, and hand-rolled repo instructions usually drift fast. They often duplicate capabilities, create tool selection confusion, and force agents to consume too much context before they can do useful work.

MímirMesh focuses on the layer between the repository and the agent:

- install once per project
- keep runtime state project-scoped
- compress and standardize the tool surface
- package reusable skills with the project
- improve code and document retrieval paths
- reduce context bloat so more of the model budget is spent on delivery instead of setup

## Early Alpha

MímirMesh is in **early alpha**.

- behavior, commands, and defaults can change quickly
- some workflows are still hardening
- you should expect occasional breakage between releases
- documentation is improving, but still behind the platform in a few areas

Recent work has significantly improved installation, MCP compression, skill-tool loading efficiency, and the foundations for lower-context agent execution. There is still a lot of ground to cover, but the platform is improving quickly.

Use [docs/roadmap.md](docs/roadmap.md) to see where the platform is heading.

## What You Get

- an interactive CLI (`mimirmesh`, alias `mm`)
- a local MCP server (`mimirmesh-server`)
- a local MCP client (`mimirmesh-client`)
- project-scoped runtime state under `.mimirmesh/`
- bundled first-party skills under `.agents/skills/`
- unified tool routing with provenance-aware MCP responses
- runtime-backed code and document intelligence without forcing every agent to rediscover your stack from scratch
- a foundation for spec-driven delivery workflows that stay attached to the repository

## How It Helps In Practice

MímirMesh is most valuable when you want AI tooling to behave more like a disciplined project system and less like a stateless chatbot.

Common use cases:

- standing up a repository with a consistent MCP and skills foundation
- giving agents better code navigation and investigation paths through routed tooling
- reducing context blowups caused by overlapping tools and repetitive skill instructions
- keeping implementation work aligned with specifications and plans
- improving repeatability across Codex, Claude, Cursor, GitHub Copilot, and other MCP-capable workflows
- keeping runtime services local and project-aware instead of scattering state across global machine setup


If you are tired of agents burning budget on tool discovery, shallow repo understanding, and repetitive setup context, MímirMesh is built for that problem.

## Before vs After MímirMesh

### Before

A typical repository-level AI setup often looks like this:

- multiple MCP servers with overlapping capabilities
- loose prompt files and repo instructions that drift over time
- inconsistent setup across editors, agents, and team members
- agents wasting tokens figuring out which tools exist and when to use them
- code, docs, and architecture context split across separate systems
- spec and implementation workflows living in different places

Result:

- more setup friction
- more context bloat
- less predictable delivery
- more repeated explanation for every session

### After

With MímirMesh installed in the project:

- the repository has a project-scoped runtime and a consistent AI delivery layer
- tools are compressed behind a more stable unified MCP surface
- first-party skills install into the repo and stay close to the actual work
- runtime-backed intelligence services improve code, docs, and architecture investigation paths
- spec-driven delivery workflows are easier to keep attached to implementation
- agents spend more of the available context budget doing useful work

Result:

- faster project bootstrap
- lower token waste
- less duplicated context
- more repeatable agent behavior
- better odds of getting useful delivery on the first pass

## Requirements

Required:

- macOS, Linux, or Windows
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

Windows PowerShell:

```powershell
irm https://github.com/mwillbanks/mimirmesh/releases/latest/download/install.ps1 | iex
```

Default install path is `~/.local/bin`. Override with:

```bash
MIMIRMESH_INSTALL_DIR="$HOME/.local/bin" curl -fsSL https://github.com/mwillbanks/mimirmesh/releases/latest/download/install.sh | bash
```

On Windows, `MIMIRMESH_INSTALL_DIR` overrides the PowerShell installer target directory.

## Quick Start

From a target repository:

```bash
mimirmesh install
```

For non-interactive environments:

```bash
mimirmesh install --non-interactive --preset minimal
```

Then check status:

```bash
mimirmesh runtime status
mimirmesh mcp list-tools
```

## What Makes It Different

MímirMesh is not trying to be just another MCP server.

Its value is in combining several layers that are usually left disconnected:

- **Runtime orchestration** so project services come up in a predictable way
- **Unified tool compression** so agents see a cleaner, more stable surface
- **Bundled skills** so project guidance is installable and reusable
- **Code intelligence routing** through runtime-backed intelligence services
- **Spec-driven delivery support** so workflows like Spec Kit are easier to operationalize inside real repositories
- **Project-scoped state** so one repository does not quietly pollute another

That combination is what helps reduce token waste, shrink context duplication, and improve the odds that an agent spends time delivering instead of wandering.

## Default Runtime Engines

MímirMesh ships with these runtime services by default. These improve retrieval, investigation, and architecture-aware delivery without forcing every user to assemble the stack manually. Specific implementations may evolve over time as the platform matures:

| Service | Purpose | Notes |
|---|---|---|
| code intelligence service | Symbols, search, hierarchy, and tracing support | Preferred route for unified code-intel tools |
| document retrieval service | Documentation retrieval and ranking | Used by routed docs flows |
| architecture analysis service | ADR and architecture analysis | Powers architecture and documentation tools |

Runtime behavior:

- engines are discovered from live runtime state
- unified tools are preferred over raw engine passthrough tools to keep the surface smaller and more stable
- transport-safe aliases are exposed for MCP clients that reject dotted names
- all state is project-scoped in `.mimirmesh/runtime/`

## Daily Commands

```text
mimirmesh
mimirmesh install
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

## Current Direction

The platform is currently focused on a few high-value areas:

- making installation and project bootstrap reliable
- compressing MCP surfaces so agents spend fewer tokens on discovery
- improving skill installation and skill-tool loading efficiency
- strengthening local runtime orchestration
- expanding routed intelligence through project-managed local services
- supporting spec-driven development and AI-assisted delivery with better defaults

This is still early work, but the direction is deliberate: better local project intelligence, tighter delivery loops, and less wasted context.

## Internal Projects and Bundled Capabilities

MímirMesh includes first-party skill packages and runtime assets in this repository.

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
Versioned release publishing is driven locally through `bun run release`, which builds multi-platform standalone artifacts and uploads them through `release-it`.
Runtime-heavy live validation is not required on hosted runners and can be gated with `MIMIRMESH_RUN_INTEGRATION_TESTS=false`.

## Learn More

- roadmap: [docs/roadmap.md](docs/roadmap.md)
- architecture: [docs/architecture/overview.md](docs/architecture/overview.md)
- runtime operations: [docs/operations/runtime.md](docs/operations/runtime.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, standards, and pull request expectations.

## License

[MIT](LICENSE)
