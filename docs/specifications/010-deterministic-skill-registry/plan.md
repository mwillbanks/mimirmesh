# Implementation Plan: Deterministic Skill Registry, Retrieval, Caching, Compression, and Authoring

**Branch**: `010-deterministic-skill-registry` | **Date**: 2026-03-26 | **Spec**: `/Volumes/Projects/mimirmesh/docs/specifications/010-deterministic-skill-registry/spec.md`
**Input**: Feature specification from `/Volumes/Projects/mimirmesh/docs/specifications/010-deterministic-skill-registry/spec.md`

## Summary

Add a first-party MimirMesh skill subsystem that keeps the MCP surface limited to `skills.find`, `skills.read`, `skills.resolve`, `skills.refresh`, `skills.create`, and `skills.update`; publishes concise descriptions for each of those tools instead of omitting them; defaults `skills.find` to minimal descriptor discovery with `name`, shortened description, and cache key, and `skills.read` to compressed `memory` reads; normalizes Agent Skills packages into a deterministic internal model while preserving full source fidelity; supports strict progressive disclosure and composable targeted reads; persists indexed skill metadata and repository-scoped cache state in the runtime-managed PostgreSQL service; uses Bun built-ins for UUID and compression primitives with JSON as the canonical normalized representation, zstd as the primary compression algorithm, and gzip as an optional compatibility algorithm; uses Bun SQL plus the runtime PostgreSQL `vector` extension for optional vector storage concerns; routes optional embeddings through a single OpenAI SDK-compatible abstraction; provisions official `ghcr.io/ggml-org/llama.cpp` local hosting through a project-scoped Dockerfile build rendered into Docker Compose when local model hosting is selected; and integrates repository-local `skills` config, bundled skills, installer preset defaults, first-class embeddings strategy selection, and a managed `AGENTS.md` guidance section that is used for instruction and enforcement only. Shared skill-domain logic will live in `@mimirmesh/skills`, MCP registration and unified-tool contracts will be extended in `@mimirmesh/mcp-core`, runtime persistence, migrations, compression storage, vector indexing, and provider runtime wiring will be handled through existing runtime services, and CLI authoring and maintenance flows will extend the current `mimirmesh skills` command family with shared Ink workflows.

## Assumption Alignment

### Confirmed implementation assumptions

- Tool surface is fixed to `skills.find`, `skills.read`, `skills.resolve`, `skills.refresh`, `skills.create`, and `skills.update`; no separate descriptor-only or content-only MCP tools will be introduced.
- Default discovery output is `name`, shortened description, and cache key, and every additional field beyond that baseline is opt-in.
- `shortDescription` is derived deterministically from the first non-empty human-readable description source in normalized skill content, normalized to single-space plain text, and capped at 160 characters with a trailing ellipsis only when truncated.
- `cacheKey` is derived deterministically from repository scope, canonical skill name, descriptor schema version, and immutable content identity so agents can safely detect reusable descriptor cache state.
- Default read mode is `memory`, and read requests must remain composable so callers can mix instruction bodies, indexes without bodies, and selected named assets in a single request.
- Resolution may use explicit prompt text, repository-local `.mimirmesh/config.yml`, optional task metadata, and optional MCP engine context, but never `AGENTS.md`.
- The canonical config file is `.mimirmesh/config.yml` with skill policy rooted under `skills`.
- Full-fidelity package support includes `SKILL.md`, metadata, references, scripts, templates, examples, auxiliary files, and unknown compatible fields without destructive loss.
- Cache behavior is repository-scoped, content-hash keyed for positive reuse, includes negative caching for not-found lookups, and must support stale negative-cache invalidation through refresh.
- Embeddings are optional overall, default off for minimal installs, and default on for recommended and full installs.
- Installer and update flows treat embeddings setup as a first-class decision and must support Docker-managed local hosting, existing LM Studio runtimes, existing OpenAI-compatible runtimes, hosted OpenAI, and disabled mode without forcing a Docker-managed path.
- Supported embedding provider modes are local `llama_cpp` via Docker Compose, `lm_studio`, `openai`, and `openai_compatible_remote`, all normalized through the shared OpenAI SDK-compatible path.
- Installer-managed local `llama_cpp` hosting uses a project-scoped Dockerfile build wrapped around an official `ghcr.io/ggml-org/llama.cpp` base image. Host-native llama.cpp execution is not a supported installer-managed path.
- Compression is mandatory with JSON normalization, zstd primary compression, and gzip compatibility fallback via Bun built-ins.
- Stable sortable generated identifiers use `Bun.randomUUIDv7()`.
- Installer and update flows always ensure a dedicated managed MimirMesh section exists in `AGENTS.md`, but that file is never used as a runtime resolution input.
- The feature includes a bundled installable MimirMesh skill under `packages/skills` that teaches MimirMesh-first skill workflows and progressive disclosure.

### Conservative defaults carried into implementation

- Default `skills.find` payload: `name`, shortened description, and cache key.
- Default `skills.read` mode: `memory`.
- Default disclosure posture: strict progressive disclosure.
- Default resolution posture: deterministic; explicit prompt and configured behavior outrank embeddings.
- Default compression posture: enabled.
- Default repository-managed guidance posture: always ensure the MimirMesh `AGENTS.md` section exists.
- Default local provider posture: a project-scoped Dockerfile wraps an official llama.cpp base image, recommend a supported GPU-capable base image when available, otherwise fall back to an official CPU-oriented base image.
- Default provider fallback posture: configured local provider first, then configured OpenAI-compatible fallbacks in order, while lexical and explicit matching remain available when embeddings are unavailable.

### Bounded implementation details

- The managed `AGENTS.md` heading, marker pair, and required guidance content are finalized by the contract and data model; only cosmetic formatting such as blank-line spacing may vary during implementation so long as create, insert, validate, update, and surrounding-content preservation remain supported.
- The default built-in resolve precedence is expected to start with always-load skills, explicit prompt name match, alias, trigger, lexical, embeddings, then MCP engine context; repository config may override this order.
- Exact `skills.read` parameter names may change during implementation, but composable include selection, targeted named asset selection, indexes without bodies, and bodies without unrelated payload are mandatory capabilities.
- Negative-cache default TTL remains implementation-defined so long as repository config can override it.
- Docker Compose details for local providers such as ports, health checks, mounts, build context, and Dockerfile path remain implementation-defined within the bounds of the Dockerfile-based official llama.cpp image path and environment-matched base-image selection.
- OpenAI-compatible remote endpoints may need provider-specific validation for auth, model naming, timeout, retry, and embedding response compatibility, but those validations do not change the shared provider contract.

## Technical Context

**Language/Version**: TypeScript 6.0.2 on Bun 1.3.x  
**Primary Dependencies**: `@modelcontextprotocol/sdk` 1.27.1, `openai`, Zod 4.3.x, YAML 2.8.x, Pastel 4, Ink 6, `@inkjs/ui` 2, existing workspace packages `@mimirmesh/skills`, `@mimirmesh/mcp-core`, `@mimirmesh/runtime`, `@mimirmesh/config`, `@mimirmesh/installer`, `@mimirmesh/ui`, Bun built-in SQL access to the runtime PostgreSQL service, and Bun built-in compression or UUID APIs (`Bun.randomUUIDv7`, `Bun.zstdCompress`, `Bun.zstdDecompress`, `Bun.gzipSync`, `Bun.gunzipSync`)  
**Storage**: Runtime-managed PostgreSQL with pgvector-backed vector columns for indexed skill metadata, repository-scoped cache state, compressed JSON or markdown blobs, optional embeddings, and migration history; repository-local files remain the source of truth for skill packages, `.mimirmesh/config.yml`, `.agents/skills/`, and `AGENTS.md`  
**Testing**: `bun test packages`, `bun test apps`, targeted package tests for `packages/skills`, `packages/mcp-core`, `packages/config`, and `packages/runtime`, CLI workflow tests under `apps/cli/tests/**`, and gated integration coverage through `bun run scripts/run-integration-tests.ts`  
**Target Platform**: Local-first macOS/Linux Bun workspace with stdio MCP server, CLI/TUI workflows, and Docker Compose runtime services  
**Project Type**: Bun workspace monorepo with CLI app, MCP server app, and shared packages  
**Performance Goals**: Default discovery responses at least 70% smaller than equivalent full-fidelity aggregate payloads, deterministic resolution stability at 100% for identical inputs, targeted read isolation at 100%, and repository-scoped refresh invalidation within 5 seconds under standard local conditions  
**Constraints**: Keep the MCP surface to six tools; preserve full skill fidelity; keep strict progressive disclosure as the default; publish concise descriptions for each MCP tool without omitting them; make `skills.find` default to `name`, shortened description, and cache key and `skills.read` default to `memory`; make embeddings, local llama.cpp hosting, and remote OpenAI-compatible providers optional and non-blocking; keep installer embeddings setup first-class without forcing Docker-managed hosting when an existing compatible runtime is selected; avoid `AGENTS.md` as a ranking source; preserve unrelated `AGENTS.md` content; use official `ghcr.io/ggml-org/llama.cpp` images only through the project-scoped Dockerfile/Compose local-hosting path; prefer existing workspace packages and Bun built-ins over wrapper layers; and keep machine-readable output explicitly scoped to inspection workflows and deterministic maintenance outcomes only when requested
**Scale/Scope**: Repository-local and bundled skill catalogs, full asset indexing for multi-file skill packages, repository-scoped positive and negative caches, optional embedding reranking with ordered provider fallback chains, installer preset integration, optional Docker Compose provisioning for local llama.cpp services, and authoring/update guidance across dozens to hundreds of skills per repository

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Live discovery gate: Skill availability comes from actual repository and bundled skill sources plus current config state, not synthetic catalogs detached from repository contents.
- [x] Upstream runtime gate: Optional persistence and embedding flows will use the real runtime PostgreSQL/pgvector service and real local or remote OpenAI-compatible embedding integrations when enabled, including official `ghcr.io/ggml-org/llama.cpp` images for local hosting.
- [x] Readiness gate: Runtime-backed indexing and `AGENTS.md` managed-section maintenance will include explicit bootstrap/refresh verification before reporting repository skill state as current.
- [x] Degraded truth gate: Malformed skills, unreadable assets, stale caches, and disabled or unavailable embeddings will report proven root cause and affected operations.
- [x] Local-first gate: Core functionality is repository-local and deterministic without hosted dependencies; optional embeddings prefer local llama.cpp runtime execution and only use remote OpenAI-compatible providers when configured or required by fallback policy.
- [x] Monorepo boundary gate: Reusable parser, storage, authoring, and guidance logic stays in `packages/*`; CLI and server apps remain orchestration and presentation entry points only.
- [x] Modularity gate: Skill parsing, storage, disclosure planning, resolution, authoring, and managed-file patching are separated by concern instead of accumulating in a single `index.ts` or command handler.
- [x] CLI experience gate: CLI-facing create, update, install, refresh, and inspection flows will reuse Ink/Pastel workflows, show visible progress, and keep a shared skills workflow model for direct commands and any future TUI surfaces.
- [x] Testing gate: Package-local tests will cover parsing, hashing, disclosure planning, config policy, storage, and managed-section patching; root integration/workflow tests will cover end-to-end tool handlers and install/update flows.
- [x] Documentation gate: `docs/features/*` updates will record observed skill discovery, read, resolve, refresh, authoring, config, and `AGENTS.md` management behavior.

**Post-Design Re-check**: PASS. The design keeps skill-domain logic in `@mimirmesh/skills`, uses existing runtime and installer boundaries, preserves local-first deterministic behavior when embeddings are disabled, and routes CLI-facing work through shared workflow surfaces with explicit documentation and test coverage.

## Project Structure

### Documentation (this feature)

```text
/Volumes/Projects/mimirmesh/docs/specifications/010-deterministic-skill-registry/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── skills-mcp.md
└── tasks.md
```

### Source Code (repository root)

```text
/Volumes/Projects/mimirmesh/apps/server/
├── src/
│   ├── startup/
│   │   └── start-server.ts
│   └── tools/
│       ├── unified/
│       └── passthrough/

/Volumes/Projects/mimirmesh/apps/cli/
├── src/
│   ├── commands/skills/
│   ├── workflows/
│   └── lib/
└── tests/

/Volumes/Projects/mimirmesh/packages/skills/
├── src/
│   ├── catalog.ts
│   ├── install.ts
│   └── index.ts
├── mimirmesh-agent-router/
├── mimirmesh-architecture-delivery/
├── mimirmesh-code-investigation/
├── mimirmesh-code-navigation/
├── mimirmesh-integration-analysis/
├── mimirmesh-operational-policies/
├── mimirmesh-speckit-delivery/
└── tests/

/Volumes/Projects/mimirmesh/packages/mcp-core/
├── src/
│   ├── registry/
│   ├── routing/
│   ├── discovery/
│   ├── transport/
│   └── types/
└── tests/

/Volumes/Projects/mimirmesh/packages/runtime/
├── src/
│   ├── compose/
│   ├── services/
│   ├── discovery/
│   ├── state/
│   └── types/
└── tests/

/Volumes/Projects/mimirmesh/packages/config/
├── src/
│   ├── schema/
│   ├── defaults/
│   ├── mutations/
│   ├── readers/
│   └── writers/
└── tests/

/Volumes/Projects/mimirmesh/packages/installer/
├── src/
│   ├── index.ts
│   ├── install-policy.ts
│   └── install-state.ts

/Volumes/Projects/mimirmesh/docs/
├── features/
├── runbooks/
└── specifications/
```

**Structure Decision**: Extend `@mimirmesh/skills` into the domain package for parsing, normalization, Bun-built-in hashing or compression helpers, disclosure planning, repository-scoped caching, provider orchestration, authoring workflows, and `AGENTS.md` managed-section patching. Extend `@mimirmesh/mcp-core` for unified tool definitions and handler contracts that call the skills domain package. Keep runtime service wiring, PostgreSQL schema migrations, `vector` extension indexing, Compose generation for local llama.cpp services, and runtime evidence in `@mimirmesh/runtime`. Keep config schema and defaults in `@mimirmesh/config`. Keep installer preset and provider-selection policy in `@mimirmesh/installer`. Keep CLI presentation and prompts in `apps/cli`, and keep MCP server bootstrap or registration in `apps/server`.

## Implementation Notes

- Execution remains governed by `agent-execution-mode` in `hardening`, with mandatory `agentic-self-review` after completion.
- `code-discipline` drives three core decisions in this plan: extend the existing `@mimirmesh/skills` package instead of creating a parallel skill-runtime package, use Bun SQL plus raw SQL migrations against the existing runtime PostgreSQL service instead of adding an ORM, and use Bun built-ins directly for UUID or compression primitives rather than wrapper utilities.
- Built-in defaults implemented from this plan should remain conservative and deterministic: `skills.find` returns `name`, shortened description, and cache key by default, `skills.read` returns `memory` by default, explicit prompt and configured behavior outrank embeddings in default resolution, and provider fallback prefers configured local hosting before configured remote providers.
- `repo-standards-enforcement` requires Bun-native validation (`typecheck`, `test`, `build`) and package-boundary discipline across `packages/*` and `apps/*`.
- `mm-unit-testing` requires parser, cache, managed-file patching, disclosure logic, provider fallback logic, and Compose-generation paths to be covered with deterministic package-local tests that mock filesystem and runtime state; real Docker/runtime behavior belongs in gated integration tests only where necessary. Any shared helper that would start Docker-backed PostgreSQL or Compose services from package or app tests must honor `MIMIRMESH_RUN_INTEGRATION_TESTS=false` so hosted CI remains runtime-free by default.
- `biome-enforcement` remains the final remediation pass after implementation validation, using the repository’s required changed-files JSON reporter command.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
