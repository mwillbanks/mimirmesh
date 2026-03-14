# Implementation Plan: Srclight Full Capability Enablement

**Branch**: `004-srclight-full-capability` | **Date**: 2026-03-18 | **Spec**: `/Volumes/Projects/mimirmesh/docs/specifications/004-srclight-full-capability/spec.md`
**Input**: Feature specification from `/Volumes/Projects/mimirmesh/docs/specifications/004-srclight-full-capability/spec.md`

## Summary

Deliver complete Srclight capability integration by covering the full 29-tool surface through discovery-backed unified routing, introducing a global GPU policy (`gpuMode: auto|on|off`) resolved once in runtime orchestration for all GPU-capable engines, and defaulting local Ollama embedding connectivity for zero-guess setup. The implementation updates config schema/defaults, runtime GPU resolution and compose/image selection, Srclight adapter routing/input execution paths, and validation/docs so runtime truth remains evidence-based.

## Technical Context

**Language/Version**: TypeScript (Bun workspace) plus Python 3.12 in engine containers  
**Primary Dependencies**: `@modelcontextprotocol/sdk`, Docker Compose, Srclight (`srclight[all]`), Zod schemas in `packages/config`  
**Storage**: Project-local runtime artifacts in `.mimirmesh/runtime/*`; repo-local Srclight state in `.srclight/*`  
**Testing**: Bun test suites in package-local tests, plus root integration/workflow tests  
**Target Platform**: macOS/Linux hosts running Docker; Linux containers; mixed amd64/arm64 host support via GPU policy resolution  
**Project Type**: Bun workspace monorepo with CLI apps and shared packages  
**Performance Goals**: Preserve fast local code-intelligence workflows; use CUDA acceleration when available without regressing non-GPU startup reliability  
**Constraints**: Discovery-backed routing only, no synthetic tool catalogs, local-first operation, no legacy `gpuEnabled` fallback mapping  
**Scale/Scope**: One feature spanning config, runtime orchestration, compose rendering, Srclight adapter routing, tests, and docs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Live discovery gate: Routing remains matched against live-discovered tool inventories only.
- [x] Upstream runtime gate: Real Srclight serve/index workflows are retained; no emulation path introduced.
- [x] Readiness gate: Existing required bootstrap (`srclight index`) remains readiness prerequisite.
- [x] Degraded truth gate: GPU `on` failures and embedding limitations are explicitly classified by execution outcome.
- [x] Local-first gate: Local Ollama defaults and host bridge access are used; no hosted inference requirement introduced.
- [x] Monorepo boundary gate: Shared logic changes stay in `packages/*`; no reusable logic moves into apps.
- [x] Modularity gate: GPU policy resolver is centralized in runtime orchestration and consumed downstream.
- [x] CLI experience gate: No new CLI interaction surface in this feature; existing CLI quality standards remain unaffected.
- [x] Testing gate: Plan includes package-local and integration/workflow validations for routing, runtime, and degraded states.
- [x] Documentation gate: `docs/features/*` and specification contracts are explicit deliverables.

## Project Structure

### Documentation (this feature)

```text
docs/specifications/004-srclight-full-capability/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── global-gpu-policy.md
│   └── srclight-routing-coverage.md
└── tasks.md
```

### Source Code (repository root)

```text
docker/
└── images/
    └── srclight/

packages/
├── config/
│   └── src/
│       ├── schema/
│       └── defaults/
├── runtime/
│   └── src/
│       ├── compose/
│       ├── services/
│       └── images/
├── mcp-adapters/
│   └── srclight/
│       └── src/
└── mcp-core/
    └── src/

tests/
└── integration/
```

**Structure Decision**: Existing monorepo package boundaries are retained. Runtime policy resolution is implemented centrally in `packages/runtime`, with adapter and compose consumers receiving resolved decisions.

## Phase 0: Research Outcomes

Research completed in `/Volumes/Projects/mimirmesh/docs/specifications/004-srclight-full-capability/research.md`.

Resolved decision set:

1. Global GPU policy is `gpuMode: auto|on|off` with default `auto`.
2. GPU resolution happens once in runtime orchestration and produces per-engine effective decisions.
3. Srclight runtime variant selection is policy-driven (CPU vs CUDA) to avoid non-GPU host failures.
4. Unified coverage remains discovery-backed and expands to full 29-tool reachability.
5. `inspect_platform_code` dispatch is input-driven (`get_platform_variants` vs `platform_conditionals`).
6. Effective embedding model is `embedModel ?? defaultEmbedModel` with automatic activation when Ollama URL is present.
7. No legacy compatibility mapping from `gpuEnabled` is added.

## Phase 1: Design and Contracts

Design artifacts generated:

- Data model: `/Volumes/Projects/mimirmesh/docs/specifications/004-srclight-full-capability/data-model.md`
- Contract: `/Volumes/Projects/mimirmesh/docs/specifications/004-srclight-full-capability/contracts/global-gpu-policy.md`
- Contract: `/Volumes/Projects/mimirmesh/docs/specifications/004-srclight-full-capability/contracts/srclight-routing-coverage.md`
- Quickstart: `/Volumes/Projects/mimirmesh/docs/specifications/004-srclight-full-capability/quickstart.md`

Design highlights:

1. Global runtime resolver emits per-engine `effectiveUseGpu` and runtime variant (`cpu|cuda`).
2. Compose rendering consumes resolved decision to emit or suppress GPU reservation blocks.
3. Adapter env receives resolved GPU policy signals (`SRCLIGHT_GPU_MODE`, optional `SRCLIGHT_GPU_ENABLED`).
4. Unified routing includes five new tool classes and two corrections while keeping passthrough-only tools explicit.
5. Embedding activation semantics are deterministic and testable through effective model precedence.

## Agent Context Update

Run:

```bash
/Volumes/Projects/mimirmesh/.specify/scripts/bash/update-agent-context.sh copilot
/Volumes/Projects/mimirmesh/.specify/scripts/bash/update-agent-context.sh codex
```

Expected result: Copilot and codex agent context file updated with newly introduced feature technologies and constraints.

## Post-Design Constitution Re-Check

- [x] Live discovery gate still satisfied by regex matching against discovered tools.
- [x] Upstream runtime gate still satisfied with real Srclight runtime and bootstrap commands.
- [x] Readiness/degraded truth gates remain satisfied; GPU policy adds explicit fail-fast diagnostics for `gpuMode:on`.
- [x] Local-first gate strengthened through default local Ollama host bridge behavior.
- [x] Monorepo/modularity/testing/docs gates satisfied by scoped package changes plus explicit test/doc deliverables.

## Phase 2 Planning Readiness

Phase 0 and Phase 1 deliverables are complete for this feature.
The next command (`/speckit.tasks`) can now generate dependency-ordered implementation tasks directly from:

- `spec.md`
- `plan.md`
- `research.md`
- `data-model.md`
- `contracts/*`
- `quickstart.md`

## Complexity Tracking

No constitutional violations requiring justification.
