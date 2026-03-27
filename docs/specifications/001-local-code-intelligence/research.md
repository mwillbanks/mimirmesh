# Phase 0 Research: Srclight Runtime Replacement

## Decision 1: Replace `codebrain` with a first-class `srclight` engine entry while leaving the rest of the runtime model intact

**Decision**: Introduce a new engine identity, adapter, config schema, and runtime assets for `srclight`, and remove the `codebrain`-specific config translation, runtime image, bootstrap, and routing modules once Srclight is wired through the same runtime lifecycle.

**Rationale**: The user request is explicit about replacing `codebrain`, and the current runtime/discovery/bootstrap system is already generic enough to absorb a new engine without inventing a separate orchestration path.

**Alternatives considered**:
- Keep the `codebrain` engine ID and swap its internals for Srclight: rejected because it hides a real engine replacement behind a misleading identifier and keeps stale config semantics.
- Add Srclight beside codebrain without removal: rejected because it leaves the deprecated engine surface in place and increases routing ambiguity.

## Decision 2: Use a real Python Srclight container built under `docker/images/srclight` from the published upstream package

**Decision**: Build a checked-in `docker/images/srclight` image around Python 3 and the published `srclight` package, following the upstream Docker baseline (`pip install srclight`) instead of a fake wrapper or no-op container.

**Rationale**: Upstream already ships a minimal real Dockerfile with `python:3-slim` and `pip install srclight`. Using the published package preserves upstream behavior while keeping the runtime build reproducible and small.

**Alternatives considered**:
- Download the GitHub repo tarball in the image and run source checkout commands: rejected because the published package already contains the supported CLI/server surface and is simpler to pin.
- Keep runtime image definitions embedded only in `materialize.ts`: rejected because the feature explicitly requires a real image under `docker/images/srclight` and checked-in assets are easier to inspect and maintain.

## Decision 3: Prefer upstream HTTP transport for the bridge by running Srclight as an SSE server inside the container

**Decision**: Extend the MímirMesh bridge to support upstream HTTP transports and connect to Srclight over `StreamableHTTPClientTransport` with `SSEClientTransport` fallback, while keeping the outward-facing bridge contract (`/health`, `/discover`, `/call`) unchanged.

**Rationale**: Srclight recommends SSE for warm, persistent workspace-oriented usage. MímirMesh already runs a long-lived project-scoped engine container, so a warm SSE server fits the runtime model better than spawning a fresh stdio process per bridge connection. The MCP TypeScript SDK supports both streamable HTTP and SSE client transports.

**Alternatives considered**:
- Keep Srclight on stdio inside the existing bridge: rejected as the primary design because it loses the warm-server benefit that Srclight documents as the preferred mode for persistent use.
- Expose Srclight directly without the MímirMesh bridge: rejected because it would bypass MímirMesh’s discovery, health, retry, and runtime-state conventions.

## Decision 4: Extend bootstrap so native engine commands can be treated as readiness-critical work

**Decision**: Expand the bootstrap contract beyond MCP tool invocation so the runtime can execute native container commands for engines like Srclight, specifically `srclight index`, and record success/failure in `.mimirmesh/runtime/bootstrap-state.json`.

**Rationale**: The user explicitly requires native `srclight index` during bootstrap. Current bootstrap only supports calling discovered MCP tools through the bridge, which is the wrong abstraction for a required CLI indexing step.

**Alternatives considered**:
- Force bootstrap through an MCP tool such as `reindex()`: rejected because the requirement explicitly calls for native `srclight index` and the CLI is the canonical upstream indexing path.
- Hide indexing inside container startup: rejected because readiness evidence must remain explicit and re-runnable rather than buried in opaque container boot logic.

## Decision 5: Keep Srclight’s native repo-local `.srclight/` index layout and mount `.mimirmesh` separately for runtime state

**Decision**: Let Srclight manage its native `.srclight/` directory inside the mounted repository while MímirMesh continues to persist health, connection, routing, and bootstrap evidence under `.mimirmesh/runtime/*`.

**Rationale**: Upstream Srclight uses `.srclight/index.db` and related sidecar files as the canonical storage model and auto-manages `.gitignore`. Preserving that layout avoids divergent flags and keeps the implementation aligned with upstream docs and CLI behavior.

**Alternatives considered**:
- Relocate the Srclight database into `.mimirmesh/indexes/srclight`: rejected because it diverges from the default upstream repo-local behavior and would require additional path translation across index and serve commands.
- Persist no runtime evidence outside `.srclight/`: rejected because MímirMesh runtime state files remain the authoritative health and routing evidence for the rest of the platform.

## Decision 6: Treat embeddings as an optional capability layered on top of a healthy base engine

**Decision**: Base Srclight readiness requires successful server startup, discovery, and non-embedding index completion. Local Ollama embeddings are optional configuration that enable semantic tools and enhancement behaviors only when configured and reachable.

**Rationale**: The feature must work fully offline and without third-party API keys by default. Srclight docs also treat embeddings as optional and document fallback behavior when embedding services are unavailable.

**Alternatives considered**:
- Require embeddings for all deployments: rejected because it would violate the local-first, no-hosted-key default and turn an enhancement into a hard dependency.
- Ignore embedding health entirely: rejected because users still need truthful diagnostics when semantic search is configured but unavailable.

## Decision 7: Make Srclight the preferred unified routing target for code-intelligence tools while preserving live fallback behavior

**Decision**: Add Srclight routing rules with higher priority than `codebrain` and, where capability overlap exists, higher priority than existing secondary code-intelligence routes so unified code tools resolve to Srclight first when discovery proves the relevant tool exists.

**Rationale**: The feature goal is not just to add another engine; it is to make Srclight the real code-intelligence engine in practice. Unified tools are the stable contract for agents, so routing priority must reflect the new primary engine.

**Alternatives considered**:
- Keep existing routing priorities and merely expose Srclight passthrough tools: rejected because unified behavior would remain effectively unchanged.
- Hard-code unified routes to Srclight tool names: rejected because live discovery remains a constitutional requirement.

## Decision 8: Use a dedicated `mimirmesh.srclight` passthrough namespace and document the change explicitly

**Decision**: Expose live-discovered passthrough tools under a dedicated `mimirmesh.srclight.*` namespace while keeping unified tool names unchanged.

**Rationale**: The existing `mimirmesh.codebase.*` passthrough namespace is already occupied by `codebase-memory-mcp`. Reusing that namespace would require a larger compatibility migration and route-collision handling that is outside the direct codebrain-to-Srclight replacement.

**Alternatives considered**:
- Reuse `mimirmesh.codebase.*` immediately: rejected because it collides with existing discovery-backed passthrough exposure and broadens scope into a namespace migration.
- Mirror every Srclight tool into both namespaces: rejected because duplicate passthrough surfaces make routing, docs, and diagnostics harder to keep truthful.