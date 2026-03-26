# Data Model: Deterministic Skill Registry, Retrieval, Caching, Compression, and Authoring

## Skill Record

- **Purpose**: Canonical normalized representation of a skill package derived from repository or bundled source files while preserving source fidelity.
- **Fields**:
  - `id`: stable internal identifier generated via Bun UUIDv7 support
  - `repoId`: repository scope identifier
  - `name`: canonical skill name
  - `description`: human-readable summary
  - `license`: optional declared license
  - `compatibility`: optional compatibility hint
  - `metadata`: preserved frontmatter metadata, including unknown compatible keys
  - `source`: source location metadata including root path, `SKILL.md` path, provider, and optional revision
  - `rawMarkdown`: original source document
  - `frontmatterSource`: original frontmatter text when present
  - `bodyMarkdown`: body text after frontmatter split
  - `contentHash`: deterministic immutable package hash
  - `schemaVersion`: normalized schema version
  - `parseWarnings`: deterministic validation or preservation warnings
  - `rawCompression`: optional at-rest compression metadata for raw markdown blobs
  - `normalizedCompression`: optional at-rest compression metadata for normalized JSON blobs
  - `discoveredAt`, `indexedAt`, `updatedAt`: timestamps
- **Validation Rules**:
  - `name` is unique within a repository scope
  - `contentHash` changes whenever normalized package content changes
  - unknown metadata fields are preserved, not dropped

## Skill Section

- **Purpose**: Structured subsection of a skill body used for targeted reads, indexing, and compressed-memory derivation.
- **Fields**:
  - `id`
  - `skillId`
  - `ordinal`
  - `kind`: `instructions`, `example`, `reference_hint`, `compatibility`, or `other`
  - `headingPath`: heading ancestry
  - `text`
  - `tokenEstimate`
  - `sectionHash`
- **Validation Rules**:
  - `ordinal` ordering is deterministic for the source document
  - `sectionHash` is stable for equivalent normalized section content

## Skill Asset

- **Purpose**: Full-fidelity representation of one file under `references/**`, `scripts/**`, `templates/**`, examples, or auxiliary content.
- **Fields**:
  - `id`
  - `skillId`
  - `path`
  - `assetType`: `reference`, `script`, `template`, `example`, or `auxiliary`
  - `mediaType`
  - `textContent`: nullable for non-text files
  - `blobRef`: optional binary or external storage pointer if needed later
  - `compression`: optional compression metadata when large text or binary assets are stored compressed at rest
  - `contentHash`
  - `tokenEstimate`
- **Validation Rules**:
  - `path` is unique within a skill package
  - `contentHash` is immutable for unchanged asset content
  - assets remain addressable even when the caller requests metadata-only or index-only reads

## Skill Descriptor

- **Purpose**: Smallest discoverable representation returned by default from `skills.find` and referenced in `skills.resolve`.
- **Fields**:
  - `name`
  - `shortDescription`
  - `cacheKey`
  - optional opt-in fields: `description`, `contentHash`, `compatibility`, `summary`, `matchReason`
  - `assetCounts`: counts by asset class when explicitly requested
  - `capabilities`: derived flags such as `hasReferences`, `hasScripts`, `hasTemplates`, `hasExamples`
- **Validation Rules**:
  - default descriptor contains `name`, `shortDescription`, and `cacheKey`
  - `shortDescription` is derived from the first non-empty human-readable description source in normalized skill content, normalized to single-space plain text, and truncated to at most 160 characters with a trailing ellipsis only when truncation occurs
  - `cacheKey` is derived from `repoId`, canonical `name`, descriptor schema version, and immutable `contentHash`
  - `cacheKey` changes whenever any default descriptor field value changes
  - any additional fields appear only when explicitly requested

## Compressed Skill Memory

- **Purpose**: Low-token structured summary used by `skills.read` memory mode and by lexical indexing.
- **Fields**:
  - `name`
  - `description`
  - `usageTriggers`
  - `doFirst`
  - `avoid`
  - `requiredInputs`
  - `outputs`
  - `decisionRules`
  - `referencesIndex`, `scriptsIndex`, `templatesIndex`, `examplesIndex`
  - `compatibility`
  - `contentHash`
  - `derivationVersion`
- **Validation Rules**:
  - derived from the current normalized skill record deterministically
  - never includes full asset bodies unless explicitly escalated by a subsequent read request

## Skill Read Selection

- **Purpose**: Composable request plan for progressive disclosure.
- **Fields**:
  - `name`
  - `mode`: `memory`, `instructions`, `assets`, or `full`
  - `include`: requested response parts such as `instructions`, `referencesIndex`, or `templates`
  - `select`: named subsets for sections and asset paths
  - `readSignature`: deterministic signature for caching and idempotent reads
- **Validation Rules**:
  - `name` is required
  - body retrieval for assets requires explicit `include` of the relevant asset class
  - `readSignature` changes whenever `mode`, `include`, or `select` changes

## Skill Resolution Request and Result

- **Purpose**: Deterministic matching request and ordered output for `skills.resolve`.
- **Fields**:
  - request: `prompt`, optional `taskMetadata`, optional `mcpEngineContext`, optional requested result fields, `limit`
  - result entries: `name`, optional `matchReason`, optional `score`, optional `configInfluence`, optional `readHint`
  - `precedenceApplied`: resolved ranking order used for this request
- **Validation Rules**:
  - identical request inputs plus identical repository state produce identical ordered results
  - `mcpEngineContext` can refine ranking only after explicit prompt, alias, trigger, and lexical stages have been evaluated according to the active precedence
  - `AGENTS.md` does not contribute to ranking inputs

## Skill Policy

- **Purpose**: Repository-local `skills` config policy under `.mimirmesh/config.yml`.
- **Fields**:
  - `alwaysLoad`
  - `resolve.precedence`
  - `resolve.limit`
  - `read.defaultMode`
  - `read.progressiveDisclosure`
  - `cache.negativeCache.enabled`
  - `cache.negativeCache.ttlSeconds`
  - `compression.enabled`
  - `compression.algorithm`
  - `compression.fallbackAlgorithm`
  - `compression.profile`
  - `embeddings.enabled`
  - `embeddings.fallbackOnFailure`
  - `embeddings.providers[]`
- **Validation Rules**:
  - precedence entries are unique and ordered deterministically
  - embeddings provider entries are optional when embeddings are disabled
  - default read behavior must map to supported read modes
  - primary compression algorithm is `zstd`; fallback gzip is used only when explicitly configured or required for interoperability

## Skill Cache Entry

- **Purpose**: Repository-scoped cached positive result keyed by immutable content identity and read shape.
- **Fields**:
  - `repoId`
  - `lookupKey`: skill name or discovery key
  - `contentHash`
  - `readSignature`
  - `payload`
  - `createdAt`
- **Validation Rules**:
  - cache hits are valid only when `contentHash` and `readSignature` still match current state
  - cache entries are never shared across repositories

## Skill Negative Cache Entry

- **Purpose**: Repository-scoped record of a not-found lookup.
- **Fields**:
  - `repoId`
  - `lookupKey`
  - `createdAt`
  - `expiresAt`
- **Validation Rules**:
  - refresh can invalidate targeted or all negative-cache entries for the repository
  - not-found results never leak across repositories

## Skill Embedding Entry

- **Purpose**: Optional vectorized representation for reranking and discovery assistance.
- **Fields**:
  - `skillId`
  - `targetType`: skill, section, or derived summary target
  - `model`
  - `dims`
  - `embeddingHash`
  - `providerType`
  - `createdAt`
- **Validation Rules**:
  - embeddings are optional and absent when disabled
  - embeddings never determine core skill availability

## Embedding Provider Configuration

- **Purpose**: Ordered provider configuration used for OpenAI SDK-compatible embedding calls and fallback routing.
- **Fields**:
  - `type`: `llama_cpp`, `lm_studio`, `openai`, or `openai_compatible_remote`
  - `model`
  - `baseUrl`
  - `apiKey`
  - `timeoutMs`
  - `maxRetries`
- **Validation Rules**:
  - provider order is deterministic
  - `baseUrl` is required for local and generic compatible endpoints
  - `apiKey` is required only where the provider mode needs it

## Embeddings Install Selection

- **Purpose**: Installer or update workflow selection describing how embeddings should be configured for the repository at onboarding time.
- **Fields**:
  - `mode`: `disabled`, `docker-llama-cpp`, `existing-lm-studio`, `existing-openai-compatible`, or `openai`
  - `model`
  - `baseUrl`
  - `apiKey`: optional for LM Studio and required for hosted or generic remote modes that enforce auth
  - `fallbackOnFailure`
- **Validation Rules**:
  - `disabled` writes no embeddings providers
  - `docker-llama-cpp` creates a local `llama_cpp` provider profile and a project-scoped local runtime profile
  - existing-runtime modes write provider configuration only and do not create a Docker-managed local runtime profile
  - required fields must be collected before a non-interactive install or update succeeds

## Local Model Runtime Profile

- **Purpose**: Installer-generated project-scoped runtime description for optional local llama.cpp hosting.
- **Fields**:
  - `serviceName`
  - `image`
  - `baseImage`
  - `variant`: `server-cuda`, `server-rocm`, `server-musa`, `server-intel`, `server-vulkan`, `server`, `light`, or `full`
  - `buildContext`
  - `dockerfile`
  - `accelerationMode`: `gpu` or `cpu`
  - `modelStoragePath`
  - `port`
  - `healthcheck`
- **Validation Rules**:
  - image identifies the project-scoped built image tag used by Docker Compose
  - `baseImage` must be an official `ghcr.io/ggml-org/llama.cpp` image
  - `buildContext` and `dockerfile` must point to the project-scoped Dockerfile build path rendered under `.mimirmesh/runtime`
  - the chosen variant must match detected platform or accelerator support or fall back to a supported CPU variant deterministically

## AGENTS Managed Section State

- **Purpose**: Deterministic patch target for repository guidance bootstrap and update.
- **Fields**:
  - `filePath`
  - `beginMarker`: `<!-- BEGIN MIMIRMESH SKILLS SECTION -->`
  - `endMarker`: `<!-- END MIMIRMESH SKILLS SECTION -->`
  - `renderedBody`
  - `contentHash`
  - `updatedAt`
- **Validation Rules**:
  - only content between markers is replaced
  - `renderedBody` must instruct agents to use `skills.find` before broad local skill loading, use `skills.read` with default `memory` mode and targeted selections before broader reads, use `skills.resolve` and `skills.refresh` for deterministic repository-aware behavior, and use `skills.create` and `skills.update` for guided authoring or maintenance
  - unrelated content outside markers is preserved byte-for-byte

## State Transitions

- filesystem skill sources + config policy -> `Skill Record`, `Skill Section`, and `Skill Asset`
- `Skill Record` -> `Skill Descriptor` and `Compressed Skill Memory`
- `Skill Read Selection` + current `Skill Record` -> progressive disclosure response and optional positive cache entry
- missing lookup + repo scope -> `Skill Negative Cache Entry`
- provider config + runtime availability -> `Skill Embedding Entry` when embeddings are enabled
- refresh request -> re-scan source material, recompute hashes, update records, and invalidate stale positive and negative cache entries
- install or update workflow -> `AGENTS Managed Section State` patch, bundled skill install/update state, and optional `Local Model Runtime Profile` generation
