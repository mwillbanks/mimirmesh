# Contract: Skill Registry MCP and CLI Surface

## Purpose

Defines the external MCP, config, and CLI contract for deterministic skill discovery, progressive disclosure reads, resolution, refresh, authoring, and managed repository guidance.

## MCP Tool Surface

The subsystem exposes exactly these tools:

```text
skills.find
skills.read
skills.resolve
skills.refresh
skills.create
skills.update
```

No parallel descriptor-only, asset-only, or content-only tools are added.
Each published MCP tool definition must keep a concise description field; description compression may shorten or deduplicate wording, but it must not omit the description field.

## `skills.find`

### Purpose

- list skills when no search criteria are supplied
- search skills when criteria are supplied

### Request

```ts
type SkillsFindRequest = {
  query?: string;
  names?: string[];
  include?: Array<
    | "description"
    | "contentHash"
    | "capabilities"
    | "assetCounts"
    | "compatibility"
    | "summary"
    | "matchReason"
  >;
  limit?: number;
  offset?: number;
};
```

### Response

```ts
type SkillsFindResponse = {
  results: Array<{
    name: string;
    shortDescription: string;
    cacheKey: string;
  } & Partial<{
    description: string;
    contentHash: string;
    capabilities: {
      hasReferences: boolean;
      hasScripts: boolean;
      hasTemplates: boolean;
      hasExamples: boolean;
    };
    compatibility: string | null;
    summary: string;
    matchReason: string;
    assetCounts: {
      references: number;
      scripts: number;
      templates: number;
      examples: number;
      auxiliaryFiles: number;
    };
  }>>;
  total: number;
};
```

### Contract Rules

- default minimal result contains `name`, `shortDescription`, and `cacheKey`
- `shortDescription` is derived from the first non-empty human-readable description source in normalized skill content, normalized to single-space plain text, and truncated to at most 160 characters with a trailing ellipsis only when truncation occurs
- `cacheKey` is derived from repository scope, canonical skill name, descriptor schema version, and immutable content identity and changes whenever any default descriptor field value changes
- additional fields appear only when explicitly requested
- full instructions, asset bodies, and full package payloads are never returned by default
- ordering is deterministic for identical inputs and repository state

## `skills.read`

### Purpose

- read only the requested parts of a skill

### Request

```ts
type SkillsReadRequest = {
  name: string;
  mode?: "memory" | "instructions" | "assets" | "full";
  include?: Array<
    | "description"
    | "metadata"
    | "instructions"
    | "sectionIndex"
    | "referencesIndex"
    | "scriptsIndex"
    | "templatesIndex"
    | "examplesIndex"
    | "auxiliaryIndex"
    | "references"
    | "scripts"
    | "templates"
    | "examples"
    | "auxiliary"
    | "fullText"
  >;
  select?: {
    sections?: string[];
    references?: string[];
    scripts?: string[];
    templates?: string[];
    examples?: string[];
    auxiliary?: string[];
  };
};
```

### Response

```ts
type SkillsReadResponse = {
  name: string;
  mode: "memory" | "instructions" | "assets" | "full";
  contentHash: string;
  readSignature: string;
  compression: {
    representation: "structured-memory" | "none";
    algorithm: "zstd" | "gzip" | "none";
    scope: "transport" | "at-rest" | "export";
  };
  includedParts: string[];
  selected?: {
    sections?: string[];
    references?: string[];
    scripts?: string[];
    templates?: string[];
    examples?: string[];
    auxiliary?: string[];
  };
  memory?: {
    name: string;
    description: string;
    usageTriggers: string[];
    doFirst: string[];
    avoid: string[];
    requiredInputs: string[];
    outputs: string[];
    decisionRules: string[];
    referencesIndex?: Array<{ path: string; mediaType: string | null; contentHash: string }>;
    scriptsIndex?: Array<{ path: string; mediaType: string | null; contentHash: string }>;
    templatesIndex?: Array<{ path: string; mediaType: string | null; contentHash: string }>;
    examplesIndex?: Array<{ path: string; mediaType: string | null; contentHash: string }>;
    compatibility?: string | null;
    derivationVersion: string;
  };
  metadata?: Record<string, unknown>;
  instructions?: {
    sections: Array<{ headingPath: string[]; text: string }>;
  };
  indexes?: Partial<{
    references: Array<{ path: string; mediaType: string | null; contentHash: string }>;
    scripts: Array<{ path: string; mediaType: string | null; contentHash: string }>;
    templates: Array<{ path: string; mediaType: string | null; contentHash: string }>;
    examples: Array<{ path: string; mediaType: string | null; contentHash: string }>;
    auxiliary: Array<{ path: string; mediaType: string | null; contentHash: string }>;
  }>;
  assets?: Partial<{
    references: Array<{ path: string; mediaType: string | null; textContent?: string }>;
    scripts: Array<{ path: string; mediaType: string | null; textContent?: string }>;
    templates: Array<{ path: string; mediaType: string | null; textContent?: string }>;
    examples: Array<{ path: string; mediaType: string | null; textContent?: string }>;
    auxiliary: Array<{ path: string; mediaType: string | null; textContent?: string }>;
  }>;
};
```

### Contract Rules

- `name` is required
- `memory` mode is the canonical compressed delivery contract for MCP and returns structured JSON memory output only
- zstd is the primary compression algorithm and gzip is the compatibility fallback for at-rest blobs and any explicitly encoded export path; default MCP responses remain structured JSON envelopes and report compression metadata rather than returning opaque binary blobs
- indexes and bodies are separated; asset bodies require explicit request
- only selected named assets are returned when `select` is used
- unrelated content is never included implicitly

## `skills.resolve`

### Purpose

- determine relevant skills for the current repository and task context

### Request

```ts
type SkillsResolveRequest = {
  prompt: string;
  taskMetadata?: Record<string, unknown>;
  mcpEngineContext?: Record<string, unknown>;
  include?: Array<"matchReason" | "score" | "configInfluence" | "readHint">;
  limit?: number;
};
```

### Response

```ts
type SkillsResolveResponse = {
  results: Array<{
    name: string;
    shortDescription: string;
    cacheKey: string;
  } & Partial<{
    matchReason: string;
    score: number;
    configInfluence: string[];
    readHint: {
      mode: "memory" | "instructions" | "assets" | "full";
      include?: string[];
      select?: Record<string, string[]>;
    };
  }>>;
  precedenceApplied: string[];
  usedMcpEngineContext: boolean;
  total: number;
};
```

### Contract Rules

- resolution inputs are prompt, repository config, optional task metadata, and optional MCP engine context
- `AGENTS.md` is not a ranking source
- default precedence is `alwaysLoad -> explicitName -> aliasOrTrigger -> lexical -> embeddings -> mcpEngineContext`
- `mcpEngineContext` must be treated as optional structured input and must not outrank explicit prompt, alias, trigger, or lexical signals unless repository configuration explicitly changes precedence
- repository config may override precedence deterministically
- default responses stay minimal and guide the next read decision

## `skills.refresh`

### Purpose

- rescan skill sources, refresh indexed state, and invalidate stale cache assumptions

### Request

```ts
type SkillsRefreshRequest = {
  names?: string[];
  scope?: "repo" | "all";
  invalidateNotFound?: boolean;
  reindexEmbeddings?: boolean;
};
```

### Response

```ts
type SkillsRefreshResponse = {
  scope: "repo" | "all";
  refreshedSkills: string[];
  invalidatedPositiveCacheEntries: number;
  invalidatedNegativeCacheEntries: number;
  embeddingsReindexed: number;
  runtimeReadiness: {
    ready: boolean;
    healthClassification: "healthy" | "degraded" | "unavailable";
    stateArtifactPaths: string[];
    message: string;
  };
  diagnostics?: string[];
};
```

### Contract Rules

- refresh rescans skill sources, reindexes metadata, and invalidates stale positive and negative cache assumptions
- scope is repository-scoped by default
- embeddings reindexing is optional and non-blocking

## `skills.create`

### Purpose

- guide skill creation, analysis, generation, validation, and optional writes

### Request

```ts
type SkillsCreateRequest = {
  prompt: string;
  targetPath?: string;
  template?: string;
  mode?: "analyze" | "generate" | "write";
  includeRecommendations?: boolean;
  includeGapAnalysis?: boolean;
  includeCompletenessAnalysis?: boolean;
  includeConsistencyAnalysis?: boolean;
  validateBeforeWrite?: boolean;
};
```

### Response

```ts
type SkillsCreateResponse = {
  mode: "analyze" | "generate" | "write";
  targetPath?: string;
  generatedSkillName?: string;
  recommendations: string[];
  gapAnalysis: string[];
  completenessAnalysis: string[];
  consistencyFindings: string[];
  validation: {
    status: "passed" | "failed" | "skipped";
    findings: string[];
  };
  writeResult?: {
    status: "written" | "skipped";
    files: string[];
  };
};
```

### Contract Rules

- guided creation uses MimirMesh-maintained prompts and templates
- creation supports completeness analysis alongside gap analysis, consistency findings, and validation
- analysis-only, generate, and write modes are all supported
- validation and quality checks run before or immediately after write when requested

## `skills.update`

### Purpose

- guide skill update analysis, patch planning, validation, and optional writes

### Request

```ts
type SkillsUpdateRequest = {
  name: string;
  prompt: string;
  mode?: "analyze" | "patchPlan" | "write";
  includeRecommendations?: boolean;
  includeGapAnalysis?: boolean;
  includeCompletenessAnalysis?: boolean;
  includeConsistencyAnalysis?: boolean;
  validateBeforeWrite?: boolean;
  validateAfterWrite?: boolean;
};
```

### Response

```ts
type SkillsUpdateResponse = {
  name: string;
  mode: "analyze" | "patchPlan" | "write";
  recommendations: string[];
  gapAnalysis: string[];
  completenessAnalysis: string[];
  consistencyFindings: string[];
  validation: {
    status: "passed" | "failed" | "skipped";
    findings: string[];
  };
  patchPlan?: {
    summary: string;
    affectedFiles: string[];
  };
  writeResult?: {
    status: "written" | "skipped";
    files: string[];
  };
};
```

### Contract Rules

- update reuses the same prompt, analysis, and validation pipeline as creation
- update supports completeness analysis alongside gap analysis, consistency findings, and validation
- advisory-only, patch-plan, and write flows are supported

## Config Contract

Repository-local configuration lives at `.mimirmesh/config.yml` under the `skills` key.

```yaml
skills:
  alwaysLoad:
    - mimirmesh-skill-usage-enforcement

  resolve:
    precedence:
      - alwaysLoad
      - explicitName
      - aliasOrTrigger
      - lexical
      - embeddings
      - mcpEngineContext
    limit: 10

  read:
    defaultMode: memory
    progressiveDisclosure: strict

  cache:
    negativeCache:
      enabled: true
      ttlSeconds: 900

  compression:
    enabled: true
    algorithm: zstd
    fallbackAlgorithm: gzip
    profile: strict

  embeddings:
    enabled: true
    fallbackOnFailure: true
    providers:
      - type: llama_cpp
        model: Qwen/Qwen3-Embedding-0.6B-GGUF
        baseUrl: http://localhost:8012/v1
        timeoutMs: 30000
        maxRetries: 2
      - type: lm_studio
        model: text-embedding-model
        baseUrl: http://localhost:1234/v1
        timeoutMs: 30000
        maxRetries: 1
      - type: openai_compatible_remote
        model: remote-embedding-model
        baseUrl: https://example.invalid/v1
        apiKey: ${EMBEDDING_API_KEY}
        timeoutMs: 30000
        maxRetries: 2
```

Rules:

- the `openai` SDK package is the single application-layer embedding client abstraction
- provider fallback order is the declared order in config
- minimal installs default embeddings off and no local provider provisioning
- recommended and full installs default embeddings on with a Docker-managed local `llama_cpp` provider first when selected
- install and update workflows expose embeddings setup as a first-class choice with these supported modes: `disabled`, `docker-llama-cpp`, `existing-lm-studio`, `existing-openai-compatible`, and `openai`
- existing-runtime modes persist provider configuration only and must not force Docker-managed local hosting
- non-interactive install or update runs must fail fast when the selected embeddings mode is missing a required model, base URL, or API key value

## AGENTS Managed Section Contract

Managed block markers:

```text
<!-- BEGIN MIMIRMESH SKILLS SECTION -->
...managed content...
<!-- END MIMIRMESH SKILLS SECTION -->
```

Rules:

- create `AGENTS.md` if missing
- insert the managed block if missing
- update only the content inside the markers when present
- preserve unrelated user content outside the block unchanged

Required managed content template:

```md
## MimirMesh Skill Workflows

- Use `skills.find` before loading local skill content broadly.
- Use `skills.read` with default `memory` mode and targeted selections before broader reads.
- Use `skills.resolve` and `skills.refresh` for deterministic repository-aware skill selection and cache refresh.
- Use `skills.create` and `skills.update` for guided skill authoring and maintenance.
- Do not treat this `AGENTS.md` section as a runtime ranking source; runtime resolution comes from the MimirMesh skill subsystem and `.mimirmesh/config.yml`.
```

## Local llama.cpp Provisioning Contract

When local model hosting is selected through install or update workflows:

- installer or update flows generate project-scoped Docker Compose service definitions
- installer or update flows generate a project-scoped Dockerfile that wraps an official `ghcr.io/ggml-org/llama.cpp` base image
- only official `ghcr.io/ggml-org/llama.cpp` images are used as the Compose build base image
- the local-hosting contract is containerized; host-native llama.cpp execution is not a supported installer-managed path
- in non-interactive mode, platform and accelerator detection choose the best matching official base image deterministically
- when no matching GPU-capable official image exists, provisioning falls back to a supported CPU-oriented official base image
- generated service definitions remain reusable for future model-hosting workloads, not embeddings alone

## CLI Contract

### Affected command families

```text
mimirmesh skills install
mimirmesh skills update
mimirmesh skills create
mimirmesh skills find
mimirmesh skills read
mimirmesh skills resolve
mimirmesh skills refresh
```

### Required CLI behaviors

| Command group | Required behavior |
|--------------|-------------------|
| install/update | preserve existing interactive selection patterns, integrate managed `AGENTS.md` guidance behavior, prompt for embeddings strategy when skills are being configured, and persist any required embeddings provider settings for the selected mode |
| find/read/resolve/refresh | provide inspection-oriented access to the six-tool MCP contract with human-first output by default and clear provider or refresh diagnostics when embeddings are enabled |
| create/update authoring | `mimirmesh skills create` handles new-skill authoring and `mimirmesh skills update <skill-name>` handles existing-skill authoring; both must show progress, prompts, recommendations, and validation results through shared Ink workflows |

Rules:

- `mimirmesh skills update` without a skill target remains the repository-maintenance surface for installed-skill or managed-guidance updates
- `mimirmesh skills update <skill-name>` is the authoring surface for guided updates to an existing skill package

### Machine-readable expectations

Machine-readable output is supported only when explicitly requested for inspection-oriented skill workflows. It must expose semantically equivalent structured fields for:

- discovery results and totals
- read mode, included parts, and selected assets
- resolution order and match reasons when requested
- refresh invalidation results and reindex status
- managed `AGENTS.md` update outcome

Rules:

- `skills.find`, `skills.read`, `skills.resolve`, and `skills.refresh` machine-readable output must remain semantically equivalent to the default human-first output for the same request
- install or update workflows that report managed `AGENTS.md` changes in machine-readable mode must include creation, insertion, update, or no-op outcomes explicitly

Human-first output remains the default for authoring and maintenance workflows.
