# Phase 0 Research: Deterministic Skill Registry, Retrieval, Caching, Compression, and Authoring

## Decision 1: Extend `@mimirmesh/skills` as the domain package instead of creating a parallel skill-runtime package

- **Decision**: Put skill parsing, normalization, content hashing, disclosure planning, repository-scoped cache policy, authoring orchestration, and `AGENTS.md` managed-section logic into `packages/skills`, then have CLI and MCP handlers call into that package.
- **Rationale**: The repository already has `@mimirmesh/skills` for bundled skill catalog and install/update behavior. Extending that package keeps all skill-domain rules in one reusable boundary and avoids duplicating catalog logic in `apps/server` or `apps/cli`.
- **Alternatives considered**:
  - New `packages/skill-registry` package: rejected because it would duplicate existing bundled-skill and install logic with little architectural gain.
  - App-local implementations in CLI or server: rejected because it violates monorepo boundary rules and would fragment skill behavior across entry points.

## Decision 2: Use runtime-managed PostgreSQL as the indexed metadata store, with the filesystem remaining the source of truth

- **Decision**: Treat repository and bundled skill files as authoritative source material while persisting normalized skill records, descriptor data, repository-scoped cache state, compressed JSON or markdown blobs, and optional embeddings in the existing runtime PostgreSQL service.
- **Rationale**: The feature needs deterministic querying, repository-scoped cache invalidation, and optional vector search, all of which fit the existing runtime PostgreSQL service already rendered by `packages/runtime`. Keeping the filesystem as the source of truth preserves full fidelity and avoids turning the database into the only copy of skill content.
- **Alternatives considered**:
  - File-only JSON indexes under `.mimirmesh/`: rejected because cache invalidation, cross-command querying, and optional embeddings become harder to manage and less testable.
  - Database-only source of truth: rejected because it would weaken source fidelity guarantees and complicate authoring workflows that must write real skill files.

## Decision 3: Use Bun built-in SQL plus raw migrations and PostgreSQL `vector`, not an ORM

- **Decision**: Access PostgreSQL through Bun’s built-in SQL client, use deterministic paired SQL migration files under the runtime or skills package boundary, and store embeddings directly in PostgreSQL `vector` columns managed by the runtime schema.
- **Rationale**: The repository already standardizes on Bun and does not currently use an ORM. Raw SQL keeps the storage layer small, deterministic, and fully compatible with the existing pgvector-enabled runtime service while avoiding wrapper sprawl and an unnecessary vector helper dependency.
- **Alternatives considered**:
  - Introduce an ORM: rejected because it adds abstraction surface area and repository-wide overhead without solving a demonstrated problem.
  - Add a separate vector helper dependency: rejected because vector support is only one part of the storage layer and Bun SQL plus raw SQL remain the primary persistence path.

## Decision 4: Keep the MCP surface to six tools with a single discovery and a single read contract

- **Decision**: Expose exactly `skills.find`, `skills.read`, `skills.resolve`, `skills.refresh`, `skills.create`, and `skills.update`, with `skills.find` handling both list and search and `skills.read` handling all progressive disclosure behaviors.
- **Rationale**: The specification explicitly requires a minimal surface and rejects fragmentation into separate descriptor, asset, and content tools. Centralizing list/search and read/disclosure behavior keeps the tool contract easy for agents to learn and helps control token usage.
- **Alternatives considered**:
  - Separate list and search tools: rejected because it enlarges the MCP surface without adding capability.
  - Separate asset index and asset body tools: rejected because progressive disclosure can be represented within a single composable read contract.

## Decision 5: Set deterministic built-in precedence to favor explicit intent over heuristics

- **Decision**: Use the built-in precedence order `alwaysLoad -> explicitName -> aliasOrTrigger -> lexical -> embeddings -> mcpEngineContext`, with repository config allowed to override the order deterministically.
- **Rationale**: This ordering matches the feature’s deterministic requirements and keeps optional heuristics behind explicit intent and direct lexical evidence. It also ensures embeddings improve ranking only when enabled rather than becoming a hidden primary selector.
- **Alternatives considered**:
  - Embeddings before lexical matching: rejected because it makes ranking less predictable and harder to reason about when embeddings are enabled.
  - MCP engine context before explicit prompt cues: rejected because task context should refine, not override, direct prompt intent.

## Decision 6: Use explicit managed section markers in `AGENTS.md`

- **Decision**: Manage repository guidance inside markers `<!-- BEGIN MIMIRMESH SKILLS SECTION -->` and `<!-- END MIMIRMESH SKILLS SECTION -->`, replacing only content inside those markers during install and update flows.
- **Rationale**: Explicit markers make idempotent updates and unrelated-content preservation easy to validate. They are straightforward to snapshot-test and make manual inspection of the managed block unambiguous.
- **Alternatives considered**:
  - Heuristic heading-based replacement: rejected because it risks overwriting user-authored content and is harder to validate deterministically.
  - Whole-file regeneration: rejected because it violates the requirement to preserve unrelated user content.

## Decision 7: Default discovery to `name`, shortened description, and cache key and use `mode/include/select` for composable reads

- **Decision**: `skills.find` returns `name`, a shortened description, and a cache key by default, with all additional descriptor fields opt-in. `skills.read` uses a stable contract of `mode`, `include`, and `select` to express progressive disclosure.
- **Rationale**: Agents need enough default discovery context to infer likely relevance and reuse cached knowledge without triggering extra reads. The shortened description and cache key must therefore be derived deterministically from normalized skill content and immutable content identity, while the `mode/include/select` shape still gives callers a deterministic way to request only compressed memory, indexes, or named assets without expanding the tool surface.
- **Alternatives considered**:
  - Defaulting discovery to `name` only: rejected because it does not provide enough context for cache-aware reuse or coarse relevance filtering.
  - Separate parameter families for each asset type: rejected because it creates a fragmented and harder-to-extend read contract.

## Decision 8: Treat compression as structured minimal delivery first, with Bun-built-in zstd and gzip support for at-rest blobs and explicit compression metadata

- **Decision**: Make compression a contract of structured minimal descriptor responses and derived compressed-memory payloads over MCP, while also allowing at-rest blob storage and any explicit encoded export path to use Bun built-in zstd as the primary compression primitive and Bun gzip as an explicit compatibility fallback when configured or required for interoperability. MCP read responses remain structured JSON and surface compression metadata rather than opaque binary payloads.
- **Rationale**: The specification requires compression to reduce tokens and preserve structured targeted access. Structured minimal payloads satisfy that requirement directly, while explicit compression metadata keeps the zstd or gzip contract visible without breaking JSON-native progressive disclosure.
- **Alternatives considered**:
  - Make binary zstd blobs the only contract: rejected because it complicates structured reads, debugging, and portability while providing no direct benefit to the MCP contract.
  - No derived compressed-memory representation: rejected because the feature explicitly calls for low-token memory-oriented reads.

## Decision 9: Use the `openai` SDK as the single embedding client abstraction with explicit provider types and fallback chains

- **Decision**: Route all embedding integrations through the `openai` SDK package and model provider configurations as ordered provider types: `llama_cpp`, `lm_studio`, `openai`, and `openai_compatible_remote`.
- **Rationale**: The user requires one application-layer client abstraction for local and remote OpenAI-compatible endpoints. Using the same SDK across providers reduces adapter drift and keeps provider fallback policy centralized.
- **Alternatives considered**:
  - Provider-specific SDKs per endpoint: rejected because they increase surface area and make fallback behavior inconsistent.
  - Direct HTTP clients without a shared SDK abstraction: rejected because the feature explicitly requires OpenAI SDK compatibility as the application contract.

## Decision 10: Provision local model hosting with a Dockerfile-backed official `ggml-org/llama.cpp` Compose service only

- **Decision**: When local model hosting is selected, installer and update flows generate Docker Compose service definitions that build from a project-scoped Dockerfile wrapping an official `ghcr.io/ggml-org/llama.cpp` base image. GPU-capable official base images are selected when the detected platform supports them; otherwise the local runtime falls back to a supported CPU-oriented official base image.
- **Rationale**: The user requires official images only, wants a reliable local-hosting path on macOS, and does not want a fragile host-native llama.cpp assumption preserved. A Dockerfile-backed Compose build keeps deployment project-scoped, repeatable, and reusable for future model handling instead of relying on host architecture quirks.
- **Alternatives considered**:
  - Non-official llama.cpp images: rejected by requirement.
  - Manual operator setup outside Compose generation: rejected because installer-managed provisioning is part of the requested technical plan.
  - Host-native llama.cpp execution: rejected because it is fragile on supported macOS environments and would preserve a known broken deployment path.

## Decision 11: Use installer presets and first-class embeddings strategy selection, but keep embeddings and local hosting non-blocking

- **Decision**: Minimal installs keep embeddings off by default; recommended and full installs default to embeddings on with Docker-managed `llama_cpp`, but install or update flows must explicitly let operators choose Docker-managed llama.cpp, existing LM Studio, existing OpenAI-compatible runtimes, hosted OpenAI, or disabled mode. The selected mode persists the required provider configuration and does not force Docker-managed hosting when an existing compatible runtime is already available.
- **Rationale**: This matches the spec, aligns with the local-first constitution, and makes embeddings additive rather than required while respecting operator-owned runtime setups. It also keeps onboarding coherent by collecting provider details when they matter instead of requiring follow-up manual config repair.
- **Alternatives considered**:
  - Enable embeddings for all installs: rejected because minimal installs explicitly require them off.
  - Make embeddings mandatory for ranking quality: rejected because the feature requires deterministic core functionality without embeddings.
