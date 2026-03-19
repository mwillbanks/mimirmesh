# MímirMesh Production Implementation Specification

- **Specification ID:** `mimirmesh-production-implementation-v1`
- **Version:** `1.0`
- **Status:** `Draft`
- **Created At:** `2026-03-11`
- **Updated At:** `2026-03-11`

---

## 1. Overview

MímirMesh is a local-first project intelligence platform for software repositories.

It provides:

- a Bun-based monorepo
- a production-grade interactive CLI
- a unified MCP proxy server
- an MCP client and orchestration layer
- embedded MCP engine integration
- Docker-based local runtime management
- local project configuration, logging, memory, templates, and reports
- immediate readiness for coding agents in IDEs and terminal workflows
- integration with Spec Kit for spec-driven development workflows

MímirMesh is intended to reduce onboarding time, improve implementation accuracy, preserve project understanding, and enable reliable local agentic workflows across many different repositories.

This specification defines the full implementation expectations for the initial production-ready version of MímirMesh.

---

## 2. Product Objectives

### 2.1 Primary objectives

MímirMesh must allow a user to:

- install the tool locally from generated build artifacts
- enter a repository and initialize a fully working local runtime with one command
- immediately use the CLI and unified MCP server from IDEs, coding agents, and terminal workflows
- understand how a project works, how it is deployed, how it interfaces with external systems, and where changes should be made
- preserve local working memory and project context
- scaffold high-quality repository documentation and agent-facing structures
- operate within a spec-driven development workflow using Spec Kit
- configure, inspect, and update its own runtime and behavior through the CLI and MCP

### 2.2 Non-negotiable success requirements

This specification is only satisfied if the delivered implementation provides all of the following:

1. The generated artifacts can be used to install MímirMesh locally end to end.
2. After installation, a user can enter a project and immediately initialize and use MímirMesh without ad hoc manual repair steps.
3. The system is comprehensively tested across CLI, runtime, MCP server, MCP client, and workflow layers.

### 2.3 Secondary objectives

- local-first by default
- macOS-first support
- Linux compatibility as a supported secondary target
- minimal host pollution
- centralized shared storage where practical
- strong terminal UX
- graceful degraded behavior when one engine or subsystem fails
- additive, non-destructive repository scaffolding

---

## 3. Scope

### 3.1 In scope

- Bun workspace monorepo
- Pastel-based CLI
- official MCP TypeScript SDK based server and client
- Docker Compose runtime generation and orchestration
- embedded MCP engine adapters
- per-project `.mimirmesh/` state
- local config, logs, memory, templates, reports, and runtime metadata
- repository analysis and indexing orchestration
- IDE and coding-agent MCP installation workflows
- Spec Kit detection, initialization support, and status visibility
- Biome-based formatting and linting
- single-file build artifacts for CLI, server, and client
- unit, integration, and workflow tests

### 3.2 Out of scope for the initial production release

- Windows support
- cloud-hosted runtime
- team-shared multi-user memory backend
- web UI or desktop UI
- remote hosted synchronization service
- distributed multi-machine runtime orchestration

---

## 4. Foundational Decisions

### 4.1 Package manager, runtime, and build tool

The repository must use **Bun** as:

- package manager
- workspace manager
- runtime where appropriate
- build tool for compiled executables

The build must produce compiled single-file binaries for:

- `cli`
- `server`
- `client`

### 4.2 CLI framework and UX stack

The CLI must use:

- `pastel`
- `ink`
- `@inkjs/ui`

The CLI must follow Pastel’s opinionated filesystem-based command model.

### 4.3 Formatting and linting

The repository must use **Biome** for:

- formatting
- linting
- fix application where appropriate

Biome is the authoritative formatter and linter for the repository.

### 4.4 MCP implementation

The MCP server and MCP client layers must use the official **Model Context Protocol TypeScript SDK**.

Middleware must be used where appropriate for:

- logging
- request tracing
- error handling
- config-aware routing
- timeouts
- retries
- degraded-mode signaling
- auth or token injection where required by integrated services

No protocol shortcuts, fake transports, or hand-rolled MCP substitutes are acceptable.

### 4.5 Spec-driven development workflow

MímirMesh must integrate with **GitHub Spec Kit** as the project’s spec-driven development workflow layer.

MímirMesh itself may recommend repository documentation structure and may surface Spec Kit status, but it must not invent its own competing specification and task management system for feature delivery.

This specification document governs the implementation of MímirMesh itself. Once the repository is initialized for delivery work, Spec Kit will be used for implementation flow inside the repository.

---

## 5. Repository Architecture

The repository must be implemented as a Bun workspace monorepo.

### 5.1 Required root structure

```text
mimirmesh/
├── package.json
├── bun.lock
├── tsconfig.json
├── biome.json
├── README.md
├── AGENTS.md
├── docs/
│   ├── architecture/
│   ├── operations/
│   ├── runbooks/
│   ├── features/
│   ├── decisions/
│   └── specifications/
│       └── mimirmesh-production-implementation-v1.md
├── apps/
│   ├── cli/
│   ├── server/
│   └── client/
├── packages/
│   ├── config/
│   ├── logging/
│   ├── runtime/
│   ├── mcp-core/
│   ├── mcp-adapters/
│   ├── ui/
│   ├── reports/
│   ├── workspace/
│   ├── templates/
│   ├── installer/
│   └── testing/
├── docker/
│   ├── compose/
│   ├── images/
│   └── scripts/
└── scripts/
```

### 5.2 Workspace responsibilities

#### `apps/cli`
The user-facing CLI application.

Responsibilities:
- command handling
- interactive UX
- runtime orchestration
- install and update workflows
- config operations
- report viewing and generation
- MCP invocation passthrough
- IDE integration workflows

#### `apps/server`
The unified MCP proxy server.

Responsibilities:
- expose MímirMesh MCP surface
- route unified tools to embedded engines
- expose passthrough tools
- normalize and merge responses
- honor engine enablement and config
- provide tool discovery
- provide config-aware runtime status

#### `apps/client`
The internal MCP client and orchestration layer.

Responsibilities:
- talk to embedded engine MCP servers
- manage transport details
- standardize request handling
- execute fan-out calls
- provide higher-level orchestration helpers reused by CLI and server

#### `packages/config`
Responsibilities:
- config schema
- defaults
- validation
- migration support
- read and write helpers

#### `packages/logging`
Responsibilities:
- structured logging
- global error logging
- session log lifecycle
- redaction rules
- log event models

#### `packages/runtime`
Responsibilities:
- Docker Compose generation
- runtime startup and shutdown
- health checks
- connection metadata
- project runtime lifecycle control

#### `packages/mcp-core`
Responsibilities:
- tool registry
- shared result envelope types
- routing primitives
- merge policies
- normalization interfaces
- middleware hooks

#### `packages/mcp-adapters`
Responsibilities:
- adapter implementations for each embedded engine
- health checks
- fan-out mapping
- native tool passthrough registration
- result normalization

#### `packages/ui`
Responsibilities:
- terminal design system
- base Ink and Pastel components
- composable higher-level components
- spinner and progress patterns
- prompt wrappers
- status and error display patterns

#### `packages/reports`
Responsibilities:
- project summary generation
- architecture report generation
- deployment report generation
- runtime health report generation
- Spec Kit status reporting

#### `packages/workspace`
Responsibilities:
- repo shape detection
- language detection
- framework detection
- monorepo detection
- mount planning
- documentation source discovery
- deployment and IaC file discovery

#### `packages/templates`
Responsibilities:
- document templates
- AGENTS guidance templates
- runbook templates
- architecture templates
- local override resolution

#### `packages/installer`
Responsibilities:
- artifact metadata
- install helpers
- update workflow support
- version detection
- packaging helpers

#### `packages/testing`
Responsibilities:
- test fixtures
- fake repositories
- runtime test helpers
- MCP harnesses
- install verification helpers

---

## 6. CLI Design Specification

### 6.1 Command names

Primary binary name:

```text
mimirmesh
```

Optional alias:

```text
mm
```

### 6.2 UX requirements

The CLI must feel like a polished production tool.

It must:

- always show current state
- always show progress for active work
- always use proper spinners during active operations
- always present clear step transitions
- always provide high-quality interactive prompts
- always use proper selection lists where choices are needed
- always distinguish info, success, warning, and error output
- never leave the user uncertain about what is happening

### 6.3 CLI design system

The UI package must be structured around composition and reuse.

Recommended structure:

```text
packages/ui/src/
├── base/
├── components/
├── patterns/
├── hooks/
└── theme/
```

Rules:
- base components are low-level primitives
- higher-level components compose base components
- avoid duplicate components with slightly different wrappers
- prefer extending through props and composition
- new components require actual justification

### 6.4 Required command surface

At minimum, the CLI must implement:

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
mimirmesh mcp tool <tool> [args...]

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

### 6.5 Command behavior expectations

#### `init`
Must:
- validate prerequisites
- create `.mimirmesh/`
- initialize config
- generate runtime metadata
- generate Docker Compose config
- start runtime
- initialize enabled engines
- detect repo shape
- run initial indexing
- generate baseline reports
- offer IDE and agent integration
- detect or initialize Spec Kit
- end in a confirmed ready state

#### `setup`
Must scaffold repository structures and guidance files non-destructively.

#### `refresh`
Must re-run indexing and regenerate derived reports and metadata.

#### `doctor`
Must diagnose install, runtime, engine, Docker, config, and connectivity issues.

#### `mcp tool`
Must allow direct invocation of unified or passthrough tools through the local MímirMesh MCP stack.

#### `update`
Must detect newer versions and support self-update and runtime component update where supported.

---

## 7. MCP Architecture Specification

### 7.1 Core model

MímirMesh must expose a **single MCP server** to users and tooling.

That server must behave as:

- a unified public MCP surface
- a proxy for embedded MCP engines
- an orchestrator for parallel tool execution
- a result normalization and merge layer
- a config-aware routing layer

### 7.2 Required MCP characteristics

The unified MCP server must:

- expose unified tools
- expose passthrough tools
- support tool discovery
- route to one or more engines per tool
- execute in parallel where safe
- normalize result shapes
- deduplicate overlapping results
- rank merged results
- include source attribution metadata
- honor engine enablement and disablement from config
- expose runtime and config-aware status

### 7.3 Unified tool classes

Initial unified tool families must include:

- project understanding
- code understanding
- doc understanding
- dependency tracing
- integration tracing
- issue investigation
- architecture analysis
- ADR generation
- documentation generation
- runtime and config inspection

Required initial unified tools:

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

### 7.4 Passthrough tools

Engine-native tools that do not map cleanly to unified tool families must still be exposed.

Required namespace pattern:

- `mimirmesh.codebase.*`
- `mimirmesh.codebrain.*`
- `mimirmesh.docs.*`
- `mimirmesh.adr.*`

### 7.5 Fan-out behavior

When a unified tool maps to more than one engine:

1. validate which engines are enabled and healthy
2. run requests in parallel where safe
3. collect raw results
4. normalize into a shared envelope
5. deduplicate overlaps
6. rank and merge outputs
7. return merged results plus provenance metadata

### 7.6 Middleware requirements

Middleware must be used for:
- logging
- timing
- routing guards
- degraded-mode signaling
- retries
- timeouts
- request enrichment
- error normalization

---

## 8. Embedded Engine Integration Specification

MímirMesh must integrate multiple embedded MCP engines inside its runtime.

### 8.1 Required embedded engines

#### `codebase-memory-mcp`
Status:
- retired by specification `005-remove-codebase-memory`

Historical role:
- structural code graph
- repository memory
- entity and relationship discovery
- code-oriented project understanding

#### `codebrain`
Role:
- semantic code search
- AST-aware analysis
- vector-backed semantic retrieval
- complementary code intelligence

#### document engine
Default implementation target:
- `document-mcp`

Role:
- local document ingestion
- markdown, PDF, DOCX, and HTML support where supported
- semantic documentation retrieval
- document monitoring or incremental refresh where practical

#### `mcp-adr-analysis-server`
Role:
- ADR analysis
- architecture reasoning
- inferred decision support
- architecture-linked output

### 8.2 Adapter responsibilities

Each adapter must provide:
- health check
- startup validation
- config translation
- mount planning
- native tool registration
- unified tool contribution mapping
- result normalization
- runtime status introspection
- clear degraded behavior when partially unavailable

### 8.3 Shared backend policy

Preferred shared backend:
- PostgreSQL
- `pgvector`

MímirMesh should centralize metadata, embeddings, and merged intelligence where practical.

If an embedded engine requires independent local storage, that may be tolerated, but MímirMesh must still maintain enough central metadata to support its own reports, status, orchestration, and merged tool behavior.

---

## 9. Runtime Specification

### 9.1 Runtime model

Every repository initialized with MímirMesh must have a project-local runtime rooted at:

```text
.mimirmesh/
```

### 9.2 Required project-local structure

```text
.mimirmesh/
├── config.yml
├── logs/
│   ├── error.log
│   └── sessions/
├── memory/
├── templates/
├── reports/
├── indexes/
├── runtime/
│   ├── docker-compose.yml
│   ├── connection.json
│   └── health.json
└── cache/
```

### 9.3 Runtime responsibilities

The runtime must support:
- local orchestration of embedded services
- project-specific lifecycle
- runtime health checks
- repo mounting
- local state persistence
- safe restart and refresh flows
- per-project isolation

### 9.4 Docker Compose requirements

The runtime must be expressed through Docker Compose.

Target services include:
- PostgreSQL
- runtime helper services where needed
- embedded engine services or engine wrappers
- any supporting internal services required for stable orchestration

### 9.5 Mounting policy

The local repository must be mounted into the runtime.

Also mount:
- `.mimirmesh/`
- templates where needed
- logs path where needed
- cache or indexes where needed

### 9.6 Connectivity policy

Preferred:
- no user-managed fixed external ports

Primary communication approach:
- local runtime bridge
- container-exec or internal bridge where practical
- per-project connection metadata stored in `.mimirmesh/runtime/connection.json`

Fallback:
- ephemeral or random ports recorded in local runtime metadata

### 9.7 Failure handling

The runtime layer must clearly handle:
- Docker not installed
- Docker daemon not running
- compose startup failure
- service health failure
- engine-specific startup failure
- database unavailable
- partial degraded mode

---

## 10. Configuration Specification

### 10.1 Config location

Project-local configuration must live at:

```text
.mimirmesh/config.yml
```

### 10.2 Config responsibilities

The config must store, at minimum:

- project identity metadata
- enabled and disabled engines
- engine-specific configuration
- document engine selection
- ADR engine mode
- runtime preferences
- logging preferences
- IDE integration state
- template override locations
- update channel preferences
- runtime metadata references

### 10.3 Config validation

Config must be schema-validated.

Invalid config must:
- fail with clear messaging
- identify exact failing sections where practical
- prevent ambiguous destructive actions

### 10.4 Config operations

The CLI must support:
- get
- set
- enable engine
- disable engine
- validate

The MCP surface must also expose config inspection and controlled config mutation where appropriate.

---

## 11. Setup and Documentation Scaffolding Specification

### 11.1 Purpose

MímirMesh must scaffold repository documentation and agent guidance structures in a non-destructive way.

### 11.2 Recommended docs structure

MímirMesh should recommend and scaffold, when absent:

```text
docs/
├── architecture/
├── operations/
├── runbooks/
├── features/
├── decisions/
└── specifications/
```

### 11.3 Top-level recommended files

Where absent, MímirMesh may scaffold:
- `AGENTS.md`
- supporting guidance or template documents relevant to MímirMesh use

### 11.4 Non-destructive behavior

Scaffolding must be additive.
Existing files and directories must be preserved.
When content already exists, MímirMesh should add only missing pieces or offer merge-safe guidance.

---

## 12. Template System Specification

### 12.1 Purpose

MímirMesh must support template-driven documentation generation.

### 12.2 Local override location

Project-local template overrides must live under:

```text
.mimirmesh/templates/
```

### 12.3 Supported initial template families

- architecture
- feature
- runbook
- operational note
- decision note
- agent guidance

### 12.4 Generation behavior

When a user or agent requests documentation, MímirMesh must be able to:
- infer document type
- recommend location
- apply the right template
- respect local overrides
- expose this through both CLI and MCP

---

## 13. Spec Kit Integration Specification

### 13.1 Purpose

MímirMesh must integrate cleanly with Spec Kit so the repository can operate inside a spec-driven development workflow without duplicating that workflow logic.

### 13.2 Required capabilities

MímirMesh must support:
- detection of whether Spec Kit is initialized in the repository
- guided initialization support
- status reporting
- doctor-style validation of Spec Kit readiness
- report visibility into Spec Kit state
- agent-visible status via MCP

### 13.3 Required command surface

At minimum:
- `mimirmesh speckit init`
- `mimirmesh speckit status`
- `mimirmesh speckit doctor`

### 13.4 Agent-visible behavior

Through reports and MCP, agents must be able to determine:
- whether Spec Kit is initialized
- whether the repo is expected to use Spec Kit
- whether the project appears ready for spec-driven implementation work

---

## 14. IDE and Agent Integration Specification

### 14.1 Supported targets

MímirMesh must support guided setup for:
- VS Code
- Cursor
- Claude Code compatible local workflows
- Codex compatible local workflows
- other MCP-capable local tools where configuration patterns are supported

### 14.2 Installation behavior

During or after `init`, MímirMesh must offer to install MCP configuration for chosen targets.

### 14.3 Multi-tool behavior

The system must support a developer using multiple IDEs or coding agents without destructive config collisions.

### 14.4 Ready-state requirement

After successful initialization, an attached agent must be able to:
- connect to the MímirMesh MCP
- call unified tools
- call passthrough tools
- inspect runtime state
- read generated reports
- determine Spec Kit status
- start meaningful work immediately

---

## 15. Notes and Memory Specification

### 15.1 Purpose

MímirMesh must provide local project memory that improves continuity during an engagement.

### 15.2 Storage

Local note and memory material must live under:

```text
.mimirmesh/memory/
```

### 15.3 Required note operations

CLI must support:
- add
- list
- search

Equivalent MCP access should be available where appropriate.

### 15.4 Memory expectations

Memory is for:
- project-specific working context
- constraints
- discovered gotchas
- local investigation notes
- implementation guidance relevant to the current project

---

## 16. Reporting Specification

### 16.1 Required reports

After `init` and `refresh`, MímirMesh must generate:

```text
.mimirmesh/reports/project-summary.md
.mimirmesh/reports/architecture.md
.mimirmesh/reports/deployment.md
.mimirmesh/reports/runtime-health.md
.mimirmesh/reports/speckit-status.md
```

### 16.2 Report expectations

#### `project-summary.md`
Must summarize:
- repo shape
- languages
- frameworks
- package managers
- key directories
- likely application boundaries

#### `architecture.md`
Must summarize:
- major subsystems
- services
- dependencies
- relevant architecture findings
- important entrypoints where inferable

#### `deployment.md`
Must summarize:
- detected deployment mechanisms
- CI/CD files
- IaC files
- containerization
- environment-related hints where safely inferable

#### `runtime-health.md`
Must summarize:
- Docker state
- runtime state
- engine state
- DB state
- degraded-mode state if present

#### `speckit-status.md`
Must summarize:
- whether Spec Kit is initialized
- whether the repo appears ready for spec-driven work
- key paths or status signals where appropriate

---

## 17. Logging Specification

### 17.1 Log layout

```text
.mimirmesh/logs/
├── error.log
└── sessions/
    └── <session-id>/
        ├── cli.log
        ├── mcp.log
        ├── runtime.log
        ├── engines.log
        └── tool-calls.log
```

### 17.2 Logging policy

Default behavior:
- global error logging enabled
- session logging enabled for interactive sessions
- verbose and debug logging configurable

### 17.3 Logging requirements

Logs must:
- be project-local
- be session-aware
- support diagnosing runtime and engine failures
- avoid leaking credentials or sensitive tokens

---

## 18. Installer and Update Specification

### 18.1 Installer requirement

The build system must produce artifacts that allow local installation of MímirMesh end to end.

The install story must be clean and repeatable.

### 18.2 Required deliverables

At minimum:
- compiled binaries
- install script or install flow
- version metadata
- update metadata consumable by the CLI
- packaging support suitable for private distribution

### 18.3 Update requirement

The CLI must support:
- version check
- self update
- runtime component update where supported
- install-state verification after update

---

## 19. Testing Specification

### 19.1 Quality bar

Testing is mandatory.
Coverage must be near-full for core packages and critical command paths.

### 19.2 Required test layers

#### Unit tests
Must cover:
- config schema and validation
- CLI argument and command behavior
- UI state helpers where practical
- MCP routing and merge logic
- adapter normalization logic
- report generation
- scaffolding logic
- template resolution
- update logic
- Spec Kit detection logic

#### Integration tests
Must cover:
- `init` against fixture repositories
- `setup` additive non-destructive behavior
- runtime startup and shutdown
- Docker unavailable behavior
- engine enable and disable behavior
- MCP server startup
- MCP client to unified server tool invocation
- passthrough tool invocation
- fan-out and merge behavior

#### Workflow tests
Must cover:
- install from produced artifacts
- initialize a repository to ready state
- connect through supported MCP pathways
- refresh indexing
- generate reports
- check Spec Kit status
- update config and observe correct behavior

### 19.3 Fixture repositories

The repository must include realistic fixtures for:
- single-package TypeScript project
- Bun workspace monorepo
- docs-heavy repository
- repo with Docker and IaC artifacts

### 19.4 Environment isolation

Tests must avoid mutating the developer’s actual machine state beyond isolated temp environments and clearly controlled runtime fixtures.

---

## 20. Operational Error Handling Specification

### 20.1 Docker unavailable

If Docker is not installed or not running, MímirMesh must:
- detect the condition clearly
- explain that runtime-backed operations require Docker
- provide actionable next steps
- fail safely without corrupting local project state

### 20.2 Partial engine failure

If one engine fails:
- healthy engines should continue where possible
- the user must be informed of degraded mode
- affected tool results must indicate reduced confidence or missing engine participation where relevant

### 20.3 Invalid config

If config is invalid:
- fail clearly
- show validation details
- refuse ambiguous or destructive operations until corrected

### 20.4 Runtime connectivity failure

If the CLI cannot reach the per-project runtime:
- inspect runtime metadata
- determine whether the runtime is stopped, unhealthy, or misconfigured
- present the likely cause and next step

---

## 21. Definition of Done

The implementation defined by this specification is complete only when all of the following are true:

- the monorepo is in place
- Bun workspaces are configured correctly
- Biome is configured and enforced
- the CLI is implemented with Pastel and proper interactive UX
- the MCP server and client are implemented with the official SDK
- embedded engine adapters exist and are routable
- Docker Compose runtime generation and lifecycle work
- `.mimirmesh/` local state is created and managed correctly
- `init`, `setup`, `refresh`, `doctor`, `config`, `runtime`, `mcp`, `note`, `document`, `report`, `install ide`, `update`, and `speckit` flows work
- reports are generated correctly
- IDE and agent integration works
- install artifacts are generated and usable
- unit, integration, and workflow tests pass
- a user can install MímirMesh, enter a repository, initialize it, and start using it immediately without manual cleanup

---

## 22. Explicit Unacceptable Outcomes

The implementation is not acceptable if any of the following are true:

- it only scaffolds files without delivering working runtime behavior
- the MCP server is incomplete, fake, or non-functional
- the CLI is only partially interactive or has weak UX
- spinners and progress states are not consistently used
- install requires ad hoc manual patchwork
- Docker failure handling is vague
- tests are superficial
- the repository becomes over-fragmented with pointless helper abstractions
- engine integration is hardcoded in a way that prevents routing, disabling, or degraded operation
- an agent cannot use the tool immediately after initialization

---

## 23. Recommended Initial Delivery Phases

### Phase 1
Foundation:
- monorepo
- Bun workspace setup
- Biome
- Pastel CLI shell
- MCP SDK server and client skeleton
- config and logging packages
- build outputs

### Phase 2
Runtime:
- Docker Compose generation
- per-project runtime metadata
- runtime lifecycle commands
- PostgreSQL and shared backend setup

### Phase 3
Engine integration:
- Srclight adapter
- codebase-memory adapter (retired in `005-remove-codebase-memory`)
- codebrain adapter
- document engine adapter
- ADR adapter
- health and status integration

### Phase 4
Unified behavior:
- unified tool registry
- passthrough tools
- fan-out and merge logic
- reports
- templates
- setup scaffolding
- IDE install flows
- Spec Kit status and init flows

### Phase 5
Hardening:
- installer and update flows
- integration tests
- workflow tests
- fixture repos
- production polish

---

## 24. Final Principle

MímirMesh must feel finished on first use.

A user must be able to install it, point it at a repository, initialize the project runtime, connect their agent tooling, and immediately get reliable code, docs, architecture, runtime, and workflow intelligence through both CLI and MCP.

That first-pass success is the standard this implementation must meet.
