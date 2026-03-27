# MimirMesh Roadmap

Date: 2026-03-19  
Status: Draft for prioritization and execution planning

## Purpose
This roadmap turns current product direction into prioritized, concrete features with explicit intent, complexity, token/performance impact, and dependency-aware sequencing.

## Planning Model
Prioritization is weighted toward token reduction first, then performance, while still preferring lower implementation complexity when feasible.

Weighted score (0-5):

$$
\text{Priority Score} = 0.45(\text{Token Impact}) + 0.25(\text{Perf Impact}) + 0.15(\text{Quality Impact}) + 0.15(\text{Complexity Ease})
$$

Where:
- Complexity: S=1, M=2, L=3, XL=4
- Complexity Ease = $5 - \text{Complexity}$
- Higher score means earlier priority unless blocked by dependencies

## Scoring Scale
- Token Impact: 1 (minimal) to 5 (very high)
- Perf Impact: 1 (minimal) to 5 (very high)
- Quality Impact: 1 (minimal) to 5 (very high)
- Complexity: S, M, L, XL

## Implementation Status
- Planned: not yet implemented
- In Progress: implementation underway
- Implemented: delivered in the repository

## Roadmap Backlog (Weighted + Dependency Aware)

| ID | Feature | Implementation Status | Intent | Complexity | Token Impact | Perf Impact | Quality Impact | Priority Score | Dependencies | Research |
|---|---|---|---|---|---:|---:|---:|---:|---|---|
| R1 | MCP Lazy Tool Registration | Implemented | Expose minimal routed surface first and lazily attach passthrough groups only when needed. | M | 5 | 4 | 4 | 4.20 | None | [atlassian-labs/mcp-compressor](https://github.com/atlassian-labs/mcp-compressor) |
| R2 | Tool Schema Compression Layer | Implemented | Reduce tool description verbosity and compress schema payloads for clients with constrained context. | M | 5 | 3 | 3 | 3.95 | R1 preferred | [atlassian-labs/mcp-compressor](https://github.com/atlassian-labs/mcp-compressor), [kdpa-llc/mcp-compression-proxy](https://github.com/kdpa-llc/mcp-compression-proxy) |
| R3 | On-Demand Skills Loading | Implemented | Load only relevant skills by task intent and active tool groups; avoid eager skill expansion. | M | 5 | 3 | 4 | 4.10 | None | [kdpa-llc/local-skills-mcp](https://github.com/kdpa-llc/local-skills-mcp) |
| R4 | Engine-Native Passthrough Namespacing | Implemented | Publish passthrough tools under upstream engine namespace (for example srclight_*) instead of mimirmesh-prefixed pass-through aliases. | S | 3 | 2 | 4 | 3.40 | None | Internal MCP server naming patterns |
| R5 | Route-Level Cost Hints | Planned | Add route metadata for expected token and latency cost so router can prefer cheapest viable path. | M | 4 | 4 | 4 | 4.00 | R1 | mcp-compressor strategy parallels |
| R6 | User-Registered External MCP Servers | Planned | Allow users to register any MCP server to MimirMesh and manage lifecycle/config from CLI + config + MCP APIs. | L | 4 | 4 | 5 | 3.85 | R1, R4 | Catalog/proxy patterns from compressor projects |
| R7 | Dynamic Merged Route DSL | Planned | Let users define merged unified routes across built-in and user-registered MCP servers with deterministic parameter mapping and merge behavior. | XL | 5 | 4 | 5 | 3.90 | R6, R5 | Existing unified routing + compression proxy concepts |
| R8 | MCP Catalog (Install/Update/Remove) | Planned | Introduce installable MCP catalog and package-management style lifecycle for MCP servers. | XL | 4 | 4 | 5 | 3.65 | R6 | Registry/catalog design from package managers |
| R9 | Runtime One-Command Self-Heal Update | Planned | Single command to detect mismatch and run update, migrations, repairs, container refresh, and MCP restart flow. | M | 3 | 5 | 5 | 3.95 | None | Current runtime-upgrade workflows |
| R10 | Installer Wizard v2 | Implemented | Guided, prompt-based installation and setup policy selection (instead of mostly implicit defaults). | M | 2 | 3 | 5 | 3.10 | None | Current CLI UX model |
| R11 | TUI Experience Redesign | Planned | Improve navigation, state transitions, action discoverability, and feedback quality in shell/TUI. | XL | 2 | 3 | 5 | 2.80 | None | Internal UX diagnostics |
| R12 | Optional Prompt Optimizer Service | Planned | Optional token compression service for prompts/evidence summaries, with explicit user opt-in. | M | 4 | 3 | 3 | 3.70 | R2 preferred | mcp-compressor + token optimizer design space |
| R13 | Global Runtime Mode (Optional) | Planned | Run shared MimirMesh runtime across multiple repos with project isolation boundaries instead of N project runtimes. | XL | 2 | 5 | 4 | 2.95 | R9 preferred | Multi-tenant local runtime patterns |
| R14 | Speckit-to-ADR Sync Guardrails | Planned | Detect architecture-sensitive spec/plan/impl changes and require ADR create/update workflow. | M | 2 | 2 | 5 | 2.95 | None | Spec Kit + ADR policy integration |
| R15 | Documentation Search-First Policy Enforcement | Planned | Default doc retrieval through document-mcp and architecture context before broad searches. | S | 3 | 2 | 4 | 3.40 | None | document-mcp operational patterns |

## Recommended Execution Sequence
Ordering below combines weighted scoring with dependency constraints.

### Phase 1: Immediate Token and Perf Wins (Low-Mid Complexity)
1. R1 MCP Lazy Tool Registration
2. R3 On-Demand Skills Loading
3. R2 Tool Schema Compression Layer
4. R5 Route-Level Cost Hints
5. R4 Engine-Native Passthrough Namespacing
6. R15 Documentation Search-First Policy Enforcement

Phase 1 outcomes:
- Lower default tool/schema footprint per session
- Lower skill inflation in agent context
- Better route selection cost efficiency
- Cleaner passthrough naming model

### Phase 2: Platform Expansion (External MCP Management)
1. R6 User-Registered External MCP Servers
2. R7 Dynamic Merged Route DSL
3. R8 MCP Catalog (Install/Update/Remove)

Phase 2 outcomes:
- MimirMesh becomes MCP orchestrator, not only bundled-engine router
- Unified routes can be user-defined and deterministic
- Catalog enables ecosystem growth and updateability

### Phase 3: Reliability and Experience
1. R9 Runtime One-Command Self-Heal Update
2. R10 Installer Wizard v2
3. R11 TUI Experience Redesign

Phase 3 outcomes:
- Lower operational friction
- Better onboarding and setup confidence
- Better day-2 UX and maintainability

### Phase 4: Optional/Advanced Modes
1. R12 Optional Prompt Optimizer Service
2. R13 Global Runtime Mode (Optional)
3. R14 Speckit-to-ADR Sync Guardrails (can be advanced to Phase 2 if governance urgency is high)

Phase 4 outcomes:
- Additional token savings where needed
- Better multi-repo efficiency for heavy users
- Stronger architecture governance consistency

## Feature Definitions (Concrete Scope)

### R6 User-Registered External MCP Servers
Scope:
- Add config model for external MCP server registration
- Add CLI: register, unregister, list, health, enable, disable
- Add MCP admin tools for registration/lifecycle
- Persist discovered tool metadata and health snapshots

Acceptance criteria:
- A user can register an arbitrary stdio/sse MCP server
- Registered server tools are discoverable and invokable
- Health/readiness reflected in runtime status and diagnostics

### R7 Dynamic Merged Route DSL
Scope:
- New route config schema defining:
  - route name
  - upstream tool sequence/fallbacks
  - parameter mapping templates
  - merge strategy (first-success, ranked-merge, deterministic fan-in)
  - evidence truncation and dedupe policy
- Runtime validation for deterministic behavior
- Support config + CLI + MCP admin updates

Acceptance criteria:
- A user can define merged routes against built-in and external MCP servers
- Route execution is deterministic and reproducible
- Route-level token and latency metrics are captured

### R8 MCP Catalog
Scope:
- Catalog index format and source configuration
- Install/update/remove commands
- Version pinning and compatibility checks
- Security model (allowed source list, checksum/signature support)

Acceptance criteria:
- User can install server package from catalog source
- Update path is explicit and reversible
- Runtime reflects catalog-managed MCP inventory

## Cross-Cutting Non-Functional Requirements
- Deterministic routing and merge behavior
- Backward compatibility for current unified routed contract
- Explicit degraded/failed states (no optimistic health claims)
- Token budget awareness in route planning
- Strict config validation before runtime apply

## Risks and Mitigations
- Risk: Overly flexible DSL creates nondeterministic behavior
  - Mitigation: enforce deterministic merge primitives only
- Risk: External MCP catalog introduces security surface
  - Mitigation: allowlist sources, checksums, optional signatures
- Risk: Token optimization harms response quality
  - Mitigation: quality gates and fallback to full context paths
- Risk: Skill lazy-loading misses needed capabilities
  - Mitigation: intent classifier fallback and explicit escalation hooks

## Success Metrics by Theme

### Token and Perf
- >= 35% reduction in average tool-schema/context tokens per session
- >= 25% reduction in median tool call latency for common workflows
- >= 40% reduction in unnecessary passthrough exposure on startup

### Platform Capability
- External MCP registration operational with health checks and lifecycle controls
- Dynamic merged routes operational via config, CLI, and MCP admin APIs
- Catalog operations support install, update, remove with version controls

### Experience and Reliability
- Runtime self-heal command reduces multi-step update workflows to one guided flow
- Installer wizard reduces failed first-run setup rate
- TUI task completion time improves for core flows (status, setup, upgrade, inspect)

## Delivery Notes
- This roadmap is sequencing guidance, not a substitute for accepted feature specifications.
- All implementation work should follow Spec Kit workflow and repository ADR requirements.
