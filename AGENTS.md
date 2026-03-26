# AGENTS.md

## Purpose

This repository builds **MímirMesh**, a local-first project intelligence platform composed of a CLI, MCP server, MCP client, runtime orchestration, and engine adapters.

Agents operating in this repository must follow the architectural, workflow, and engineering principles described here before implementing changes.

The goal is to maintain a **clean, production-grade system** that is reliable for both humans and coding agents.

---

# Core Principles

## Spec-Driven Development

All feature work must follow **Spec Kit** workflows.

Agents must:

1. Check whether a relevant specification exists.
2. If none exists, propose creating one using Spec Kit.
3. Implement only against an accepted specification.

Do not implement speculative features without a specification.

---

## Library and Package Discipline

The repository is a **Bun workspace monorepo**.

Structure:

```
apps/
  cli/
  server/
  client/

packages/
  ...
```

Rules:

* `apps/*` contain runnable applications.
* `packages/*` contain reusable shared logic.

Agents must **not place reusable logic inside apps**.

Shared functionality must be placed in a package.

---

## Composition Over Abstraction

Avoid unnecessary abstractions.

Preferred hierarchy:

1. reuse existing functionality
2. extend through composition
3. extend through configuration
4. only create a new abstraction when clearly justified

Common failure patterns to avoid:

* unnecessary helper utilities
* multiple similar components performing the same role
* thin wrappers around other functions without added value

---

## CLI UX Standards

The CLI is a **first-class product surface**.

Agents must follow these requirements:

* use **Pastel**
* build UI with **Ink** and **@inkjs/ui**
* always display the current state
* always use spinners for long-running operations
* always provide clear feedback to the user
* prefer interactive prompts over raw arguments where appropriate

Never degrade the CLI UX into plain logging output.

---

## Component Design System

CLI UI components must follow the design system structure.

```
packages/ui/
  base/
  components/
  patterns/
```

Rules:

* base components are primitives
* components compose base primitives
* patterns compose components

Agents must not create duplicate components for small differences.

Use props and composition instead.

---

## MCP Implementation Standards

All MCP implementations must use the official **Model Context Protocol TypeScript SDK**.

Rules:

* do not implement custom MCP protocol layers
* do not bypass the SDK
* use middleware for logging, retries, and routing logic
* maintain clear separation between MCP server and client layers

---

## Engine Adapter Model

MímirMesh integrates multiple MCP engines.

Adapters must:

* encapsulate engine behavior
* provide health checks
* expose passthrough tools
* normalize responses
* support enabling or disabling via configuration

Adapters must never leak engine-specific assumptions into unrelated layers.

---

## Runtime Management

Runtime orchestration is handled through Docker Compose.

Agents must:

* treat the runtime as **project-scoped**
* never assume global runtime state
* respect `.mimirmesh/` as the authoritative project runtime directory
* ensure operations are safe when Docker is unavailable

Runtime lifecycle commands must always surface clear user feedback.

---

## Configuration Rules

Project configuration lives in:

```
.mimirmesh/config.yml
```

Agents must:

* validate configuration before applying changes
* avoid silent configuration mutation
* provide clear error messages for invalid config states

---

## Logging Standards

Logs are stored in:

```
.mimirmesh/logs/
```

Rules:

* errors must always be recorded
* session logs must remain scoped to a single session
* logs must never expose secrets

---

## Testing Requirements

Testing is mandatory.

Agents must ensure:

* unit tests for core logic
* integration tests for CLI commands
* runtime tests for Docker orchestration
* MCP routing tests
* adapter tests for each engine

New functionality must not be merged without tests.

---

## Formatting and Linting

The repository uses **Biome**.

Agents must:

* run formatting and linting before finalizing changes
* never introduce formatting drift
* follow the repository configuration

---

## Documentation Expectations

Agents must update documentation when functionality changes.

Relevant areas include:

```
README.md
docs/
reports/
```

Generated reports must remain accurate.

---

## Safe Change Strategy

Before modifying existing code:

1. locate the correct package
2. verify whether functionality already exists
3. confirm compatibility with current architecture
4. implement changes with minimal disruption
5. update tests and documentation

---

## Behavior When Uncertain

If the correct implementation path is unclear:

1. search the repository for existing patterns
2. consult the specification
3. prefer minimal changes over speculative architecture changes
4. document assumptions if required

Agents must **not invent new architecture without justification**.

---

# Final Directive

Agents must prioritize:

* correctness
* maintainability
* strong UX
* architectural clarity
* full test coverage

The repository must remain understandable and stable for future contributors and coding agents.

<!-- BEGIN MIMIRMESH SKILLS SECTION -->
## MimirMesh Skill Workflows

- Use `skills.find` before loading local skill content broadly.
- Use `skills.read` with default `memory` mode and targeted selections before broader reads.
- Use `skills.resolve` and `skills.refresh` for deterministic repository-aware skill selection and cache refresh.
- Use `skills.create` and `skills.update` for guided skill authoring and maintenance.
- Do not treat this `AGENTS.md` section as a runtime ranking source; runtime resolution comes from the MimirMesh skill subsystem and `.mimirmesh/config.yml`.
<!-- END MIMIRMESH SKILLS SECTION -->
