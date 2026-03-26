# Quickstart: Deterministic Skill Registry, Retrieval, Caching, Compression, and Authoring

## Objective

Validate deterministic skill discovery, progressive disclosure reads, repository-scoped cache refresh, guided authoring, managed `AGENTS.md` updates, first-class embeddings setup selection, optional Docker-managed local llama.cpp provisioning, and OpenAI-compatible embedding provider fallback end to end.

## Execution Governance

- Implement and harden the feature under `agent-execution-mode` in `hardening` mode.
- Apply `code-discipline`, `repo-standards-enforcement`, `mm-unit-testing`, and `biome-enforcement` throughout implementation and validation.
- After claiming completion, run `agent-execution-mode` in `agentic-self-review` mode and resolve safe findings before handoff.

## Prerequisites

- Bun workspace dependencies installed
- repository-local `.mimirmesh/config.yml` available or creatable through existing config flow
- runtime-capable environment for PostgreSQL-backed indexing, optional embedding checks, and optional Docker Compose-based local llama.cpp service checks
- repository with bundled skills installed under `.agents/skills/` or available for install
- for macOS embedding validation, prefer an LM Studio OpenAI-compatible endpoint instead of local llama.cpp if the local containerized llama.cpp path is not desired for that environment

## 1. Run targeted package and workflow tests first

```bash
cd /Volumes/Projects/mimirmesh
bun test packages/skills packages/mcp-core packages/config packages/runtime apps/cli tests/workflow
```

Expected result:

- parser and fidelity-preservation tests pass
- CLI skill command and workflow tests for find/read/resolve/refresh/create/update pass
- disclosure-planning and deterministic resolution tests pass
- config schema and managed `AGENTS.md` patching tests pass
- provider configuration, fallback behavior, and Compose-generation tests pass
- CLI workflow regressions for skills install/update/find/read/resolve/refresh pass

## 2. Validate minimal discovery and progressive disclosure

```bash
cd /Volumes/Projects/mimirmesh
bun run apps/server/src/index.ts
```

Manual MCP checks:

- `mimirmesh skills find` returns the minimal discovery list without full skill bodies
- `mimirmesh skills read <skill-name>` defaults to compressed memory output
- `mimirmesh skills resolve <prompt>` returns a deterministic ordered result set
- `mimirmesh skills refresh` is the sole mutation path for the repository-scoped index and cache state
- `skills.find` without criteria returns `name`, shortened description, and cache key
- published MCP tool definitions for `skills.find`, `skills.read`, `skills.resolve`, `skills.refresh`, `skills.create`, and `skills.update` keep concise descriptions present in the startup tool surface
- opt-in fields appear only when explicitly requested
- `skills.read` in memory mode returns compressed memory only
- targeted index and named-asset reads do not return unrelated content

## 3. Validate deterministic resolution and refresh

```bash
cd /Volumes/Projects/mimirmesh
bun run apps/cli/src/cli.ts skills resolve --prompt "update the skill install workflow"
bun run apps/cli/src/cli.ts skills refresh
bun run apps/cli/src/cli.ts skills find --query "code navigation"
```

Expected result:

- repeated resolve calls with identical inputs return identical ordering
- refresh invalidates stale positive and negative cache assumptions for the current repository
- embeddings-off mode still produces deterministic results

## 4. Validate installer embeddings selection, local llama.cpp provisioning, and provider fallback behavior

```bash
cd /Volumes/Projects/mimirmesh
bun run apps/cli/src/cli.ts install
```

Manual checks:

- when bundled skills are selected, install prompts for an embeddings setup strategy unless a non-interactive flag already supplied it
- the strategy choices include Docker-managed llama.cpp, existing LM Studio, existing OpenAI-compatible runtime, OpenAI, and disabled mode
- selecting an existing runtime path prompts for the required base URL, model, and API key only when that strategy requires them
- the chosen strategy is persisted into `.mimirmesh/config.yml` and is usable immediately after install without a manual config edit

```bash
cd /Volumes/Projects/mimirmesh
bun run apps/cli/src/cli.ts skills refresh --reindex-embeddings
```

Manual checks:

 - installer or update flows can generate a project-scoped Dockerfile-backed Compose service for official `ghcr.io/ggml-org/llama.cpp` local hosting when that strategy is selected
 - non-interactive image selection prefers a supported GPU-capable official base image when available and falls back to a supported CPU-oriented official base image otherwise
 - embedding requests use the configured provider order through the shared `openai` SDK-compatible path
 - provider failure diagnostics are actionable and fallback to the next configured provider when allowed

For live validation on macOS, use LM Studio when the local llama.cpp container cannot be brought up:

```yaml
skills:
  embeddings:
    enabled: true
    fallbackOnFailure: true
    providers:
      - type: lm_studio
        model: text-embedding-nomic-embed-text-v1.5
        baseUrl: http://localhost:1234/v1
        timeoutMs: 30000
        maxRetries: 2
```

## 5. Validate managed `AGENTS.md` guidance behavior

```bash
cd /Volumes/Projects/mimirmesh
bun run apps/cli/src/cli.ts skills install
bun run apps/cli/src/cli.ts skills create --prompt "Create a skill that teaches deterministic registry discovery."
bun run apps/cli/src/cli.ts skills update custom-skill --prompt "Refine the custom skill update flow."
```

Manual checks:

- `AGENTS.md` is created if absent
- the MimirMesh managed section is inserted if missing
- rerunning install or update updates only the managed block between the explicit markers
- unrelated content outside the managed block remains unchanged
- `skills.update` without a bundled target stays on the bundled maintenance path; `skills.update <skill-name>` uses the guided authoring path for non-bundled skills

## 6. Validate guided authoring and update workflows

```bash
cd /Volumes/Projects/mimirmesh
bun run apps/cli/src/cli.ts skills create
bun run apps/cli/src/cli.ts skills update mimirmesh-agent-router
```

Expected result:

- interactive prompts guide creation and update safely
- recommendations, gap analysis, and consistency analysis are surfaced before write when requested
- written skill packages preserve full fidelity and pass validation

## 7. Run repository-native validation

```bash
cd /Volumes/Projects/mimirmesh
bun run typecheck
bun run test
bun run build
```

Expected result:

- no type errors
- Bun-native tests pass
- build succeeds for CLI and server surfaces

## 8. Run mandatory Biome enforcement as the final remediation pass

```bash
cd /Volumes/Projects/mimirmesh
bunx @biomejs/biome check --write --unsafe --changed --no-errors-on-unmatched --files-ignore-unknown=true --reporter=json
```

Expected result:

- zero remaining Biome errors on changed files
- if Biome edits files, rerun `bun run typecheck`, `bun run test`, and `bun run build`

## 9. Finish with the self-review gate

- confirm docs under `docs/features/` reflect observed behavior
- run mandatory `agentic-self-review`
- fix safe findings before concluding
