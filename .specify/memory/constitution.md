<!--
Sync Impact Report
- Version change: 1.0.0 -> 1.1.0
- Modified principles:
	- V. Monorepo Boundaries, Modularity, and Verifiable Docs -> V. Monorepo Boundaries, Modularity, CLI Boundaries, and Verifiable Docs
- Added sections:
	- VI. CLI Experience and Interaction Quality
- Removed sections:
	- None
- Templates requiring updates:
	- ✅ .specify/templates/plan-template.md
	- ✅ .specify/templates/spec-template.md
	- ✅ .specify/templates/tasks-template.md
	- ✅ .github/prompts/speckit.plan.prompt.md (validated, no changes required)
	- ✅ .github/prompts/speckit.specify.prompt.md (validated, no changes required)
	- ✅ .github/prompts/speckit.tasks.prompt.md (validated, no changes required)
	- ✅ .github/prompts/speckit.implement.prompt.md (validated, no changes required)
	- ✅ .github/prompts/speckit.constitution.prompt.md (validated, no changes required)
	- ✅ docs/features/cli-command-surface.md
- Follow-up TODOs:
	- None
-->

# MimirMesh Constitution

## Core Principles

### I. Live Discovery and Execution Truth
All MCP engine integrations MUST be discovered from live runtime endpoints and
validated through successful runtime execution. Hard-coded tool catalogs,
placeholder services, and synthetic success responses are prohibited for
engine-owned capabilities. Configuration-dependent limitations MUST be
classified only after a live validation attempt against the active runtime.

Rationale: Product trust depends on truthful behavior reporting and on
discovering what is actually runnable in the current environment.

### II. Upstream-Real Engine Runtime
Containerized engines MUST run real upstream workloads with documented startup
commands, real configuration translation, real health checks, and accurate
degraded-mode reporting. Engine adapters MUST not emulate upstream tools when
the upstream implementation is unavailable; they MUST report unavailability with
actionable diagnostics.

Rationale: Runtime parity is required to avoid hidden drift between documented
capabilities and deployed behavior.

### III. Automatic Bootstrap and Readiness Verification
Required engine bootstrap and indexing steps MUST execute automatically and MUST
be verified before runtime readiness is reported as healthy. Runtime status MUST
publish verifiable state artifacts for discovery, health, bootstrap progress,
and degraded causes.

Rationale: Operators need deterministic startup behavior and objective
readiness evidence.

### IV. Local-First and Private-First Inference
The platform MUST prefer local and private execution over third-party hosted AI
services whenever a capable local option exists. External providers MAY be used
only when local execution is unavailable or explicitly configured, and this
selection MUST be visible in runtime status and diagnostics.

Rationale: Local-first execution protects privacy, improves control, and
reduces dependency risk.

### V. Monorepo Boundaries, Modularity, CLI Boundaries, and Verifiable Docs
The repository MUST keep clean monorepo boundaries: reusable logic belongs in
`packages/*`, runnable surfaces belong in `apps/*`, and adapter code MUST be
split by engine and concern. Oversized `index.ts` files that mix routing,
bootstrap, translation, and diagnostics concerns are prohibited. Package-local
tests are required for package behavior; root-level tests are reserved for
regression and full workflow validation. CLI state, presentation, and workflow
logic MUST remain composable and shared instead of being reimplemented per
command surface. Documentation under `docs/features` MUST reflect observed
runtime behavior, configuration prerequisites, bootstrap steps, degraded modes,
and validation outcomes.

Rationale: Explicit boundaries reduce coupling and keep behavior, tests, and
documentation auditable.

### VI. CLI Experience and Interaction Quality
The MimirMesh CLI is a primary product interface and MUST provide a polished,
interactive terminal experience. Commands MUST communicate progress,
operational state, and results clearly through structured visual output using
Pastel, Ink, and `@inkjs/ui`. Long-running operations MUST display visible
progress indicators and MUST NOT leave operators uncertain whether work is
continuing. Interactive workflows MUST prompt for user input when doing so
improves safety, configuration accuracy, or usability. The full-screen TUI and
direct subcommands MUST share a unified state model and visual language.
Output MUST be human-first and structured while still supporting
machine-readable modes when explicitly requested.

Rationale: The CLI is the operational control surface for the product, so UX
quality directly affects trust, safety, and day-to-day effectiveness.

## Runtime and Validation Standards

1. Runtime readiness is valid only when discovery, health checks, and required
bootstrap/indexing complete successfully for required engines.
2. Degraded mode MUST report root cause, affected tools, and operator actions;
it MUST never report synthetic health.
3. Discovery MUST source schemas and tool shapes from live bridges when
available; static fallbacks MAY exist only for platform-owned unified tools.
4. Config translation MUST be deterministic and test-covered, including
container env vars, mounts, startup commands, and health probe paths.
5. Runtime state files under `.mimirmesh/runtime/` are normative evidence for
health and routing status and MUST be kept coherent across lifecycle commands.
6. CLI state transitions MUST expose current operation, result, and degraded
conditions consistently across TUI and direct command execution.

## Delivery Workflow and Quality Gates

1. Every feature plan MUST include a constitution check that validates live
discovery, upstream-real runtime behavior, bootstrap readiness, and local-first
execution decisions.
2. Every feature spec MUST define acceptance scenarios for runtime validation,
degraded-mode truthfulness, and configuration-dependent behavior proven through
execution.
3. Every task list MUST include tasks for engine bootstrap verification,
readiness/status assertions, package-local tests, and `docs/features` updates
derived from observed results.
4. Every CLI-facing feature plan and spec MUST define the interactive flow,
visible progress states, shared state model usage, and whether
machine-readable output is supported.
5. Pull requests MUST fail review when they introduce hard-coded engine tool
inventories, placeholder runtime behavior, boundary violations, or stale feature
docs.
6. CLI changes MUST include verification for progress visibility, structured
output, prompt safety, and parity between TUI and direct command behavior.
7. Runtime and adapter changes MUST include automated tests for discovery,
routing, health classification, and failure-mode diagnostics.

## Governance

This constitution supersedes informal local practices for runtime and adapter
architecture.

Amendment process:
1. Propose amendment with rationale and affected artifacts.
2. Evaluate compatibility and classify version bump using semantic versioning.
3. Update constitution and all required templates/docs in the same change.
4. Pass compliance review before merge.

Versioning policy:
1. MAJOR: incompatible governance changes or principle removals/redefinitions.
2. MINOR: new principle or materially expanded mandatory guidance.
3. PATCH: wording clarifications without semantic requirement changes.

Compliance review expectations:
1. Every plan, spec, tasks file, and runtime-facing doc change MUST be checked
for constitutional alignment.
2. Reviewers MUST require evidence from live execution for claims about runtime
behavior and limitations.
3. Reviewers MUST reject CLI changes that regress structured output, progress
visibility, shared state usage, or prompt safety without explicit amendment.

**Version**: 1.1.0 | **Ratified**: 2026-03-13 | **Last Amended**: 2026-03-13
