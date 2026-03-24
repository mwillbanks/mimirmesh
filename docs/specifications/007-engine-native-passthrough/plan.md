# Implementation Plan: Engine-Native Passthrough Namespacing

**Branch**: `007-engine-native-passthrough` | **Date**: 2026-03-24 | **Spec**: `/Volumes/Projects/mimirmesh/docs/specifications/007-engine-native-passthrough/spec.md`
**Input**: Feature specification from `/Volumes/Projects/mimirmesh/docs/specifications/007-engine-native-passthrough/spec.md`

## Summary

Change externally published passthrough MCP tool names from `mimirmesh`-prefixed aliases to canonical engine-native names in the form `<engine>_<tool>`, while preserving unified tool names and existing internal routing truth unless internal changes are required for correct external behavior. The implementation covers server publication, router invocation, CLI inspection parity, guided failures for retired aliases, readiness/bootstrap evidence, multi-engine validation reuse, and documentation updates that reflect observed runtime behavior.

## Technical Context

**Language/Version**: TypeScript in a Bun workspace monorepo, with Python-based upstream engines running in containers  
**Primary Dependencies**: `@modelcontextprotocol/sdk`, Bun test, Docker Compose runtime orchestration, existing MímirMesh runtime/router/adapter packages  
**Storage**: Project-local runtime artifacts under `.mimirmesh/runtime/*` plus discovery/routing state files derived from live runtime endpoints  
**Testing**: Package-local Bun test suites plus root integration and workflow tests  
**Target Platform**: macOS/Linux hosts running Docker with local-first MímirMesh runtime surfaces  
**Project Type**: Bun workspace monorepo with CLI apps, MCP server/client apps, and shared packages  
**Performance Goals**: Preserve current passthrough and unified tool invocation behavior with no additional lookup hops or synthetic discovery delay  
**Constraints**: Live discovery only, no hard-coded engine tool inventories, preserve external-only rename decision, maintain CLI shared-state consistency across TUI and direct commands  
**Scale/Scope**: One feature spanning server publication, client transport mapping, CLI inspection flows, routing/discovery metadata, adapter metadata, tests, docs, and operational skills

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Live discovery gate: Passthrough publication remains sourced from live discovery and runtime readiness instead of static tool catalogs.
- [x] Upstream runtime gate: No upstream engine startup or config translation path is replaced; the feature operates on publication and validation surfaces only.
- [x] Readiness gate: Plan includes explicit bootstrap verification and readiness/status assertions before engine-native passthrough tools are shown as available.
- [x] Degraded truth gate: Retired aliases return explicit rename diagnostics, and CLI/tool listing surfaces must report pending or degraded readiness truthfully instead of synthetic success.
- [x] Local-first gate: The change does not introduce hosted fallback behavior and preserves current local-first engine/runtime selection.
- [x] Monorepo boundary gate: Shared naming and routing behavior stays in `packages/*`; runnable publication and CLI entry points remain in `apps/*`.
- [x] Modularity gate: The plan keeps naming helpers, router behavior, discovery metadata, and CLI presentation changes separated by concern.
- [x] CLI experience gate: CLI-facing changes explicitly define direct-command and TUI parity, shared state usage, visible readiness/progress semantics, machine-readable output, and prompt-safe non-interactive behavior.
- [x] Testing gate: Plan includes package-local tests, root integration/workflow validation, bootstrap verification, and multi-engine/non-canonical regression coverage.
- [x] Documentation gate: `docs/features/*`, quickstart validation, and skill guidance remain explicit deliverables tied to observed runtime behavior.

## Project Structure

### Documentation (this feature)

```text
docs/specifications/007-engine-native-passthrough/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── passthrough-publication.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── server/
│   ├── src/
│   │   ├── middleware/
│   │   └── startup/
│   └── tests/
├── client/
│   └── src/
└── cli/
    └── src/
        ├── commands/
        ├── lib/
        └── workflows/

packages/
├── mcp-core/
│   ├── src/
│   └── tests/
├── runtime/
│   ├── src/
│   └── tests/
└── mcp-adapters/
    ├── src/
    ├── srclight/
    ├── document-mcp/
    └── mcp-adr-analysis-server/

docs/
└── features/

tests/
├── integration/
└── workflow/
```

**Structure Decision**: Keep reusable naming, discovery, and routing logic in shared packages; limit apps to external publication, client transport, and CLI presentation/invocation surfaces. Validation remains split between package-local tests and root integration/workflow suites.

## Phase 0: Research Outcomes

Research completed in `/Volumes/Projects/mimirmesh/docs/specifications/007-engine-native-passthrough/research.md`.

Resolved decision set:

1. The rename is an external MCP publication change first, not a forced internal routing-table rewrite.
2. The `<engine>` prefix comes from canonical MímirMesh engine IDs rather than adapter namespace strings, upstream labels, or user aliases.
3. Retired `mimirmesh` passthrough aliases are guided failures, not dual-published compatibility names.
4. The naming contract applies to passthrough-capable MímirMesh engines with canonical engine IDs, including future engines, while excluding arbitrary proxied external MCP servers without canonical IDs.
5. Core validation must cover server publication, router invocation, CLI parity, readiness/bootstrap truth, integration/workflow listings, and user-facing docs/skills.
6. CLI surfaces continue to use existing direct-command and TUI flows, but they must share one state model for naming, readiness visibility, and machine-readable output.

## Phase 1: Design and Contracts

Design artifacts generated:

- Data model: `/Volumes/Projects/mimirmesh/docs/specifications/007-engine-native-passthrough/data-model.md`
- Contract: `/Volumes/Projects/mimirmesh/docs/specifications/007-engine-native-passthrough/contracts/passthrough-publication.md`
- Quickstart: `/Volumes/Projects/mimirmesh/docs/specifications/007-engine-native-passthrough/quickstart.md`

Design highlights:

1. `Published Passthrough Tool` captures the external `<engine>_<tool>` name, canonical engine ID, and live-discovery-backed publication status.
2. `Internal Passthrough Route` remains the internal routing truth unless an internal adjustment is required to preserve correct external behavior.
3. `Retired Alias Mapping` provides deterministic guidance from retired `mimirmesh` aliases to the canonical engine-native replacement name.
4. `Engine Publication Policy` separates engines that participate in the contract from arbitrary proxied external MCP servers that do not.
5. CLI inspection and invocation surfaces must consume the same router/context-derived state so TUI, direct commands, and machine-readable outputs remain aligned.
6. Validation extends beyond unit renaming helpers to readiness/bootstrap evidence, multi-engine assertions, and exclusion of non-canonical external servers.

## CLI Interaction Contract

- **Direct command flow**: Operators validate publication through `mimirmesh-client list-tools`, `mimirmesh-client tool <name> ...`, and local CLI inspection surfaces without introducing new prompts.
- **TUI flow**: Existing full-screen inspection surfaces continue to present tool inventories from the shared CLI state model; this feature only changes displayed passthrough names and readiness-driven visibility.
- **Visible states**: When bootstrap or discovery is incomplete, CLI inspection surfaces show current status or degraded reason and do not present undiscovered passthrough tools as available.
- **Shared state model**: TUI and direct-command flows must consume the same router/context-backed publication metadata and retired-alias guidance.
- **Machine-readable mode**: Existing structured output modes, where supported, must emit the same published engine-native names and replacement guidance as human-readable surfaces.
- **Prompt safety**: Non-interactive passthrough inspection and invocation remain prompt-safe; no new prompt sequences are introduced by this feature.

## Agent Context Update

Run:

```bash
/Volumes/Projects/mimirmesh/.specify/scripts/bash/update-agent-context.sh copilot
```

Expected result: Copilot agent context file updated with the feature's planning context and constraints.

## Post-Design Constitution Re-Check

- [x] Live discovery and upstream runtime gates remain satisfied because the feature changes publication, validation, and docs rather than upstream engine behavior.
- [x] Readiness and degraded-truth gates are now explicitly covered through bootstrap verification, readiness/status assertions, and guided-failure diagnostics.
- [x] CLI experience gate is satisfied by the defined direct/TUI flow contract, shared state requirement, machine-readable expectations, and prompt-safety requirement.
- [x] Monorepo/modularity/testing/docs gates are satisfied by keeping shared logic in packages, app-specific surfaces in apps, and explicit test/doc work in the plan and tasks.
- [x] Local-first gate remains unchanged and does not require new fallback decisions.

## Phase 2 Planning Readiness

Phase 0 and Phase 1 deliverables are complete for this feature.
The next command can implement or refine dependency-ordered work directly from:

- `spec.md`
- `plan.md`
- `research.md`
- `data-model.md`
- `contracts/passthrough-publication.md`
- `quickstart.md`
- `tasks.md`

## Complexity Tracking

No constitutional violations requiring justification.
