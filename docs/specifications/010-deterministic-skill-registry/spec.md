# Feature Specification: Deterministic Skill Registry, Retrieval, Caching, Compression, and Authoring

**Feature Branch**: `010-deterministic-skill-registry`  
**Created**: 2026-03-26  
**Status**: Accepted  
**Input**: User description: "MimirMesh Deterministic Skill Registry, Retrieval, Caching, Compression, and Authoring"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Minimal Skill Discovery and Reading (Priority: P1)

An agent working inside a repository needs to discover relevant skills and read only the smallest useful amount of skill content before deciding what to do next. The agent should be able to list or search skills through one discovery entry point and progressively disclose only the exact sections it needs.

**Why this priority**: This is the primary token-reduction and workflow-simplification outcome. If discovery and targeted reading are not minimal and deterministic, the rest of the subsystem fails its core value proposition.

**Independent Test**: Can be fully tested by calling the discovery and read flows against a repository with multiple installed skills and verifying that the default responses remain minimal, targeted reads return only requested content, and no full skill package is returned unless explicitly requested.

**Acceptance Scenarios**:

1. **Given** a repository with installed skills, **When** an agent calls skill discovery without search criteria, **Then** the system returns a minimal list view through a single discovery entry point without returning full skill bodies.
2. **Given** a repository with installed skills, **When** an agent calls skill discovery with search criteria, **Then** the system returns a minimal ranked result set with only explicitly requested optional fields.
3. **Given** a discovered skill, **When** an agent requests a minimal read, **Then** the system returns only the smallest useful payload for that skill.
4. **Given** a discovered skill with references, scripts, templates, examples, and auxiliary assets, **When** an agent requests only selected parts, **Then** the system returns only those selected parts and no unrelated content.

---

### User Story 2 - Deterministic Resolution and Refresh (Priority: P1)

An agent needs MimirMesh to determine which skills are relevant for a task and to refresh stale assumptions safely. The system must resolve skills using prompt content, repository configuration, and optional task context while remaining deterministic and cache-aware across repeated runs.

**Why this priority**: Deterministic resolution and refresh behavior make the subsystem trustworthy. Without this, ranking, caching, and progressive disclosure become ambiguous and agents cannot safely depend on the system.

**Independent Test**: Can be fully tested by running repeated resolve and refresh flows against the same repository inputs, then validating stable ordering, repository-scoped cache behavior, correct negative-cache handling, and predictable refresh invalidation.

**Acceptance Scenarios**:

1. **Given** the same prompt, repository configuration, and optional task metadata, **When** the agent resolves skills repeatedly, **Then** the system returns the same ordered result set every time.
2. **Given** a repository-scoped cache entry identified by immutable content hashes, **When** the underlying skill content changes or a refresh is requested, **Then** stale cache assumptions are invalidated for that repository.
3. **Given** a skill lookup that previously returned no match, **When** the same repository repeats the lookup before refresh, **Then** the system can reuse a repository-scoped negative-cache result without leaking that result to other repositories.
4. **Given** embeddings are disabled, **When** an agent resolves skills, **Then** the system still produces deterministic results using non-embedding inputs.

---

### User Story 3 - Guided Skill Authoring and Updating (Priority: P2)

A user or agent wants to create a new skill or improve an existing one. The system should guide the author through templates, prompts, recommendations, consistency analysis, gap analysis, validation, and writing of full skill package contents while preserving quality and full fidelity.

**Why this priority**: Authoring is a major product differentiator, but it depends on the core runtime discovery and resolution model being stable first.

**Independent Test**: Can be fully tested by creating a new skill package and updating an existing one through guided workflows, then verifying that the generated or modified assets are preserved, validated, and compliant without requiring manual repair.

**Acceptance Scenarios**:

1. **Given** a user wants a new skill, **When** the user invokes guided creation, **Then** the system uses maintained templates and prompts, performs quality analysis, and can write a complete skill package.
2. **Given** an existing skill package, **When** the user invokes guided update, **Then** the system can recommend changes, apply requested updates, and validate the package before and after modification.
3. **Given** a skill package containing auxiliary assets and unknown metadata fields, **When** the system creates or updates that package, **Then** it preserves full fidelity and does not silently discard unknown compatible fields.

---

### User Story 4 - Repository Skill Policy and Agent Guidance Bootstrap (Priority: P2)

A repository using MimirMesh needs to configure skill behavior locally and ensure that agents are directed toward MimirMesh for skill workflows. Installation and update flows should manage repository skill policy and a maintained section in `AGENTS.md` without damaging unrelated user content.

**Why this priority**: This enables repository-local governance and ensures MimirMesh becomes the preferred path for skill discovery and use inside managed repositories.

**Independent Test**: Can be fully tested by enabling the feature in a repository, editing `.mimirmesh/config.yml`, and running install or update flows to verify that skill behavior changes take effect and `AGENTS.md` is created or updated safely.

**Acceptance Scenarios**:

1. **Given** a repository with MimirMesh installed, **When** the repository defines skill policy under the `skills` key, **Then** discovery, read, resolve, refresh, and cache behavior follow that local configuration.
2. **Given** a repository without `AGENTS.md`, **When** install or update runs, **Then** the system creates `AGENTS.md` with the managed MimirMesh section.
3. **Given** a repository with `AGENTS.md` but without the MimirMesh managed section, **When** install or update runs, **Then** the system adds the missing managed section without altering unrelated content.
4. **Given** a repository with an existing managed MimirMesh section, **When** install or update runs, **Then** the system validates and updates only that managed section while preserving unrelated content outside it.

### Edge Cases

- What happens when a skill package is partially malformed but still contains readable assets?
  - The system reports the exact validation failures, returns only safely retrievable content, and does not silently normalize away invalid or unknown source material.
- What happens when a repository refreshes skills while a cached negative result exists for a previously missing skill?
  - The refresh clears the stale negative-cache assumption for that repository and forces the next lookup to re-evaluate current repository state.
- What happens when two or more skills match equally well for a resolution request?
  - The system applies configured precedence rules or, if none are configured, a deterministic built-in default precedence so the result order remains stable.
- What happens when embeddings are unavailable, disabled, or misconfigured?
  - Discovery and resolution continue in deterministic non-embedding mode, and the degraded condition is reported clearly without blocking core functionality.
- What happens when `AGENTS.md` contains user-authored content around the managed section?
  - The managed section is updated in place while unrelated user-authored content before and after the section is preserved exactly.

## Assumptions

### Confirmed assumptions

- The MCP tool surface for the skill subsystem is exactly `skills.find`, `skills.read`, `skills.resolve`, `skills.refresh`, `skills.create`, and `skills.update`; separate descriptor-specific or content-specific tools are intentionally excluded to keep the MCP surface small.
- Published MCP tool definitions for the six skill tools must keep concise descriptions present in the tool surface; description compression may shorten wording, but it must not omit the description field.
- `skills.find` defaults to the smallest useful payload and returns `name`, a shortened description, and a cache key unless callers explicitly opt in to additional fields.
- `shortened description` means a deterministic plain-text summary derived from the first non-empty human-readable description source in normalized skill content, with whitespace normalized and length capped for stable low-token discovery responses.
- `cache key` means a deterministic discovery-cache identifier derived from repository scope, canonical skill name, descriptor schema version, and immutable content identity so agents can recognize reusable cached descriptor state.
- `skills.read` is composable and progressively disclosed; callers can request indexes without bodies, request selected named assets without unrelated assets, combine instruction and asset requests, and use compressed memory as the default low-token representation.
- `skills.resolve` may use explicit prompt text, repository-local `.mimirmesh/config.yml`, optional task metadata, and optional MCP engine context, but it MUST NOT use `AGENTS.md` as a runtime resolution or ranking signal.
- The canonical repository-local config file is `.mimirmesh/config.yml`, and the canonical configuration root for this subsystem is `skills`.
- Version one supports full fidelity now, including `SKILL.md`, metadata, body content, references, scripts, templates, examples, auxiliary files, and unknown fields or metadata preserved without destructive loss.
- Cache behavior is repository-scoped and requires immutable content-hash keyed positive caching, negative caching for not-found lookups, and refresh-driven invalidation of stale negative-cache state.
- Embeddings are optional overall but default off for minimal installs and on for recommended and full installs; embeddings are configurable via CLI and `.mimirmesh/config.yml`.
- Local llama.cpp provisioning is optional overall. Supported provider modes are Docker-managed local llama.cpp, LM Studio, OpenAI, and OpenAI-compatible remote endpoints. All embedding integrations are normalized through the OpenAI SDK-compatible application path.
- Installer and update flows treat embeddings setup as a first-class configuration choice and must support Docker-managed local hosting, existing compatible runtimes, and disabled mode without forcing a Docker-managed path when an existing compatible runtime is available.
- Installer-managed local llama.cpp hosting uses a project-scoped Dockerfile build rendered into the runtime Compose stack. Host-native llama.cpp execution is not a supported installer-managed deployment path.
- Compression is a core contract. The canonical normalized representation is JSON, the primary compression algorithm is zstd, and the optional compatibility compression algorithm is gzip, implemented via Bun zstd or gzip built-ins.
- Stable sortable identifiers use `Bun.randomUUIDv7()`.
- MimirMesh manages repository-level agent guidance by creating or updating a dedicated MimirMesh section in `AGENTS.md`; this is used for instruction and enforcement, not as a runtime resolution source.
- A bundled installable MimirMesh skill lives under `packages/skills` to teach agents to use MimirMesh for skill workflows, reduce eager skill loading, reinforce progressive disclosure, and prefer MimirMesh MCP-first behavior.

### Conservative defaults chosen for planning

- Default `skills.find` payload: `name`, shortened description, and cache key.
- Default `skills.read` mode: `memory`.
- Default progressive disclosure posture: strict.
- Default resolution posture: deterministic; explicit prompt and configured behavior outrank embeddings.
- Default compression posture: enabled.
- Default repository-managed guidance posture: always ensure the MimirMesh section exists in `AGENTS.md`.
- Default local provider posture: when local hosting is selected, render a project-scoped Dockerfile build that wraps an official llama.cpp base image, prefer a supported GPU-capable base image when the detected environment matches, and otherwise fall back to a supported CPU-oriented official base image.
- Default provider fallback posture: configured local provider first, then configured OpenAI-compatible fallbacks in order, while lexical and explicit matching continue to work when embeddings are unavailable.

### Still implementation-defined but bounded

- Managed `AGENTS.md` section markers and required guidance content are finalized by the design artifacts; only formatting details such as blank-line spacing may still vary during implementation so long as create, insert, validate, update, and surrounding-content preservation all remain supported.
- The built-in resolve precedence remains configurable per repository. The current recommended default is: always-load skills, explicit prompt name match, alias, trigger, lexical, embeddings, then MCP engine context.
- Exact `skills.read` parameter names may change during implementation, but the required capability set is fixed: composable include selection, targeted named asset selection, indexes without bodies, and bodies without unrelated payloads.
- The negative-cache default TTL may be finalized during implementation so long as repository config can control it.
- Docker Compose details for provider services such as ports, health checks, model mounts, build context, Dockerfile path, and service options may be finalized during implementation so long as official llama.cpp images are used through the Dockerfile-based container path and environment-matching base-image selection is preserved.
- OpenAI-compatible remote providers may require provider-specific validation for auth, model naming, timeout, retry, and embedding response compatibility, but those checks do not change the core provider model.

### Explicit non-assumptions

- `AGENTS.md` participates in runtime skill resolution.
- Embeddings are mandatory.
- Local llama.cpp hosting is mandatory.
- Full skill packages are returned by default.
- A large MCP tool surface is acceptable.
- Protobuf or MessagePack is required as the canonical format.
- Cache scope should be global across repositories.
- Authoring tools are advisory only.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The skill subsystem MUST expose only these MCP tools for the feature scope: `skills.find`, `skills.read`, `skills.resolve`, `skills.refresh`, `skills.create`, and `skills.update`.
- **FR-001a**: Published MCP tool definitions for the skill subsystem MUST include concise descriptions for each tool, and description compression MUST shorten or deduplicate wording without omitting the description field.
- **FR-002**: `skills.find` MUST serve as the single entry point for both skill listing and skill search.
- **FR-003**: `skills.find` called without search criteria MUST return a minimal list-oriented result set containing `name`, a shortened description, and a cache key unless optional fields are explicitly requested.
- **FR-004**: `skills.find` called with search criteria MUST return a minimal search-oriented result set with deterministic filtering and ranking.
- **FR-005**: `skills.find` MUST return additional optional fields only when they are explicitly requested.
- **FR-006**: Discovery results MUST remain aware of full skill fidelity without returning full instructions, reference bodies, script bodies, template bodies, or other full asset contents by default.
- **FR-007**: `skills.read` MUST require a skill identifier and MUST default to the compressed `memory` representation as the smallest useful read.
- **FR-008**: `skills.read` MUST support composable progressive disclosure so callers can request only the precise combination of skill sections and assets they need in a single request.
- **FR-009**: `skills.read` MUST support index-only reads without bodies, named-target reads without unrelated assets, metadata-only reads, and body retrieval for references, scripts, templates, examples, and auxiliary assets.
- **FR-010**: `skills.read` MUST support a compressed memory mode optimized for low token consumption and structured enough to preserve JSON-compatible access patterns.
- **FR-011**: `skills.read` MUST support combined requests such as instructions plus selected references and MUST NOT return unrelated skill content unless that content is explicitly requested.
- **FR-012**: `skills.resolve` MUST determine relevant skills using explicit prompt text, repository-local MimirMesh configuration, optional task metadata, and optional MCP engine context when such context is available.
- **FR-013**: `skills.resolve` MUST NOT use `AGENTS.md` as an input source for resolution or ranking.
- **FR-014**: `skills.resolve` MUST honor deterministic precedence rules defined by repository configuration and MUST apply a deterministic built-in precedence when configuration does not override defaults, with explicit prompt and configured behavior outranking embeddings.
- **FR-015**: `skills.resolve` MUST return a minimal result suitable for helping an agent decide what to read next rather than returning full skill contents.
- **FR-016**: `skills.refresh` MUST serve as the single entry point for refreshing registry state, indexed metadata, and cache assumptions for a repository.
- **FR-017**: Cache behavior MUST support immutable content-hash-based reuse for unchanged skill payloads.
- **FR-018**: Cache behavior MUST support repository-scoped negative caching for not-found skills.
- **FR-019**: `skills.refresh` MUST invalidate stale positive and negative cache assumptions for the addressed repository.
- **FR-020**: The subsystem MUST preserve full fidelity for the Agent Skills package, including `SKILL.md`, frontmatter, body content, metadata, `references/**`, `scripts/**`, `templates/**`, examples, auxiliary files, unknown custom metadata, and future-compatible unknown fields.
- **FR-021**: The subsystem MUST preserve both normalized representations and original source fidelity without destructive loss.
- **FR-022**: `skills.create` MUST provide guided authoring that uses MimirMesh-maintained templates and prompts and can generate or write a complete skill package when requested.
- **FR-023**: `skills.create` MUST perform consistency analysis, gap analysis, completeness analysis, quality recommendations, and specification or convention validation before save or immediately after creation.
- **FR-024**: `skills.update` MUST provide guided update flows with the same level of analysis, recommendation, validation, and writing support as creation.
- **FR-025**: `skills.update` MUST support recommending changes, generating update plans, or applying updates directly.
- **FR-026**: Repository-local skill behavior MUST be configurable under the `skills` key in `.mimirmesh/config.yml`.
- **FR-027**: The `skills` configuration MUST support always-loaded skills, retrieval behavior, ranking behavior, embeddings behavior, embedding model selection, provider ordering, provider fallback behavior, compression behavior, default read behavior, cache behavior, negative-cache behavior, progressive disclosure defaults, and deterministic precedence rules.
- **FR-028**: Embeddings MUST be optional for the subsystem overall and MUST support local llama.cpp via Docker Compose, LM Studio, OpenAI, and OpenAI-compatible remote endpoints through a shared OpenAI SDK-compatible application path.
- **FR-028a**: Installer-managed local llama.cpp hosting MUST use a project-scoped Dockerfile build and Docker Compose runtime path rooted in `.mimirmesh/runtime`, and MUST NOT depend on a host-native llama.cpp execution path.
- **FR-029**: Installer presets MUST default embeddings off for minimal installs and on for recommended and full installs.
- **FR-029a**: Install and update workflows that configure skills MUST treat embeddings setup as a first-class operator decision, support at least Docker-managed local llama.cpp, existing LM Studio runtimes, existing OpenAI-compatible runtimes, hosted OpenAI, and disabled mode, and persist the required configuration for the selected mode.
- **FR-029b**: Install and update workflows MUST NOT force a Docker-managed embeddings runtime when the selected mode is an existing compatible runtime.
- **FR-030**: Disabling embeddings MUST NOT prevent core deterministic discovery, reading, resolution, refresh, authoring, or validation behavior.
- **FR-031**: Compression MUST be a core contract of the subsystem, MUST use JSON as the canonical normalized representation, and MUST support minimal payload delivery together with progressive disclosure.
- **FR-032**: Compressed delivery MUST use zstd as the primary algorithm, MUST support gzip as an optional compatibility algorithm, and MUST preserve structured access patterns without preventing JSON-compatible fallback access.
- **FR-033**: MimirMesh MUST include a bundled installable agent skill under `packages/skills` that teaches agents to prefer MimirMesh skill operations.
- **FR-034**: Install and update flows MUST ensure repositories contain a managed MimirMesh section in `AGENTS.md` that directs agents to prefer MimirMesh for skill discovery, resolution, reading, and progressive disclosure before broader local skill loading.
- **FR-035**: If `AGENTS.md` does not exist, install or update flows MUST create it.
- **FR-036**: If `AGENTS.md` exists but does not contain the managed MimirMesh section, install or update flows MUST add that section.
- **FR-037**: If `AGENTS.md` contains the managed MimirMesh section, install or update flows MUST validate and update that section as needed.
- **FR-038**: Managed updates to `AGENTS.md` MUST preserve unrelated user-authored content outside the managed section.
- **FR-039**: Repository-scoped skill state, including cache and negative-cache behavior, MUST NOT leak results or stale assumptions across repositories.
- **FR-040**: The subsystem MUST make MimirMesh the preferred path for skill discovery and usage inside repositories where MimirMesh is installed.
- **FR-041**: Newly generated stable sortable identifiers for subsystem-managed records MUST use `Bun.randomUUIDv7()`.
- **FR-042**: When provider fallback is configured, resolution and reranking flows MUST try the configured local provider first, then configured OpenAI-compatible fallbacks in order, while deterministic lexical and explicit matching remain available when embeddings are unavailable.
- **FR-043**: The default `shortDescription` field returned by `skills.find` MUST be derived deterministically from the first non-empty human-readable description source in normalized skill content, normalized to single-space plain text, and truncated to at most 160 characters with a trailing ellipsis only when truncation occurs.
- **FR-044**: The default `cacheKey` field returned by `skills.find` MUST be derived deterministically from repository scope, canonical skill name, descriptor schema version, and immutable content identity, and it MUST change whenever any default descriptor field value changes.

### Runtime Truth and Validation Requirements *(mandatory for runtime, MCP, adapter, or orchestration features)*

- **RTV-001**: Skill discovery, reading, resolution, and refresh behavior MUST be validated against live repository skill content and current repository-local configuration rather than synthetic catalogs or assumed state.
- **RTV-002**: The system MUST NOT rely on hard-coded full skill inventories to represent current repository skill availability.
- **RTV-003**: Install and update flows that manage skill guidance MUST verify `AGENTS.md` managed-section creation, insertion, or update before reporting success.
- **RTV-004**: Degraded states for malformed skills, unreadable assets, stale caches, or unavailable embeddings MUST report proven root cause, affected skill operations, and corrective actions.
- **RTV-005**: Repository-scoped cache and negative-cache behavior MUST be validated through execution-based refresh and re-read scenarios.
- **RTV-006**: Core deterministic functionality MUST remain valid when embeddings are disabled or unavailable.
- **RTV-007**: Feature documentation under `docs/features/` MUST be updated with observed discovery behavior, progressive disclosure behavior, refresh semantics, cache behavior, authoring workflow outcomes, and `AGENTS.md` management outcomes.
- **RTV-008**: Runtime readiness and status assertions MUST verify repository-scoped indexing evidence, health classification, and runtime state artifacts before discovery, resolve, or refresh flows report current skill state as ready.

### CLI Experience Requirements *(mandatory for CLI, TUI, interactive workflow, or operator-facing command features)*

- **CLI-001**: Operator-facing authoring, update, install, and refresh workflows MUST present progress, current state, and results through structured output built with Pastel, Ink, and `@inkjs/ui`.
- **CLI-002**: Long-running skill refresh, analysis, creation, and update operations MUST show visible progress indicators until completion, failure, or cancellation.
- **CLI-003**: Guided create and update flows MUST use interactive prompts when they improve skill quality, configuration correctness, or authoring safety.
- **CLI-003a**: Guided install and update flows that configure skills MUST prompt for embeddings strategy and any required base URL, model, or API key values when those details were not supplied non-interactively.
- **CLI-004**: Human-readable output MUST be the default for skill authoring and maintenance workflows.
- **CLI-005**: Machine-readable output MAY be offered when explicitly requested for inspection-oriented skill workflows and deterministic maintenance workflows that report structured outcomes, and it MUST remain semantically equivalent to the default human-first output.
- **CLI-006**: Feature documentation MUST describe operator-visible states, prompts, progressive disclosure behavior, and any machine-readable mode behavior for affected workflows.

### Key Entities *(include if feature involves data)*

- **Skill Package**: The complete repository-local representation of one Agent Skill, including canonical instructions, metadata, nested assets, unknown compatible fields, and original source fidelity.
- **Skill Descriptor**: The minimal discoverable representation of a skill returned by default from discovery or resolution flows so an agent can decide what to read next; it includes `name`, deterministic `shortDescription`, and deterministic `cacheKey` by default.
- **Skill Read Selection**: A request describing which specific sections or assets of a skill should be disclosed, such as top-level instructions, a reference index, one named script, or a compressed memory view.
- **Skill Resolution Result**: The deterministic ordered set of skills deemed relevant for a task together with minimal evidence sufficient for the next read decision.
- **Skill Cache Entry**: A repository-scoped cached record keyed by immutable content identity that can represent either a positive payload or a negative not-found result.
- **Skill Policy**: The repository-local `skills` configuration that defines ranking precedence, embeddings usage, compression defaults, progressive disclosure defaults, cache behavior, and always-loaded skills.
- **AGENTS Managed Section**: The repository instruction block in `AGENTS.md` that MimirMesh owns and maintains to direct agents toward MimirMesh-first skill workflows.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In validation scenarios with at least 25 available skills, default discovery responses are at least 70% smaller than the equivalent full-fidelity aggregate skill payload for the same result set.
- **SC-002**: In at least 95% of curated validation scenarios, an agent can choose the next relevant skill action using one discovery response and at most one targeted read without loading unrelated full skill content.
- **SC-003**: Targeted read requests return only requested sections and zero unrelated asset bodies in 100% of validation scenarios.
- **SC-004**: Given identical inputs, repeated resolution requests produce the same ordered results in 100% of deterministic validation runs.
- **SC-005**: Repository-scoped refresh invalidates stale positive and negative cache assumptions within 5 seconds in standard local validation conditions.
- **SC-006**: Guided creation and update workflows produce specification-compliant skill packages without manual repair in at least 90% of representative validation scenarios.
- **SC-007**: Install and update workflows preserve unrelated content outside the managed `AGENTS.md` section in 100% of validation scenarios.
- **SC-008**: Disabling embeddings preserves successful execution of all core discovery, read, resolve, refresh, create, and update validation scenarios.

### Runtime Validation Outcomes *(mandatory for runtime, MCP, adapter, or orchestration features)*

- **RVO-001**: Discovery and resolution results reflect only skills actually available from the current repository skill sources at validation time.
- **RVO-002**: Refresh validation proves that stale positive and negative cache assumptions are cleared for the addressed repository and do not leak across repositories.
- **RVO-003**: Degraded scenarios produce reproducible diagnostics naming the failing skills, failing assets, or disabled subsystems and the corrective action required.
- **RVO-004**: Validation confirms that embeddings-off mode still supports deterministic core functionality without functional regressions.
- **RVO-005**: Documentation under `docs/features/` matches observed discovery, read, resolve, refresh, authoring, and `AGENTS.md` management behavior used during validation.

### CLI Experience Outcomes *(mandatory for CLI, TUI, interactive workflow, or operator-facing command features)*

- **CLO-001**: Operators can identify current progress state and result for skill refresh, create, and update workflows without ambiguity.
- **CLO-002**: Guided authoring workflows reduce invalid or incomplete skill-package submissions by providing prompts, analysis, and recommendations before save.
- **CLO-003**: Operators can understand which disclosure mode they are using and what information will be returned before committing to broader context expansion.
- **CLO-004**: Machine-readable inspection or deterministic maintenance output, when supported, can be requested explicitly without degrading the default human-first experience.
