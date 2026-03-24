# Research: Engine-Native Passthrough Namespacing

## Decision 1: Keep live discovery and persisted routing truth stable while changing external MCP publication

- **Decision**: Preserve existing live discovery and routing-table generation behavior for passthrough capabilities unless an internal change is required for correct external behavior; apply the public rename at the external MCP publication and invocation boundary.
- **Rationale**: Current discovery and routing infrastructure already tracks the owning engine, engine tool, and public-facing passthrough identity used by internal router resolution. The feature specification explicitly limits required renames to externally published MCP names, which minimizes blast radius across runtime state, upgrade evidence, and package tests that assert discovery truth.
- **Alternatives considered**:
  - Rewrite routing-table and discovery `publicTool` entries to the new `<engine>_<tool>` form: rejected because it broadens migration risk into runtime persistence and internal regression surfaces without adding user value.
  - Publish both old and new names from discovery: rejected because the specification requires a single published contract and explicit rename failures instead of dual-publication.

## Decision 2: Use canonical MímirMesh engine IDs as the public passthrough prefix

- **Decision**: Derive the `<engine>` prefix in `<engine>_<tool>` from the canonical MímirMesh engine ID.
- **Rationale**: Canonical engine IDs are already stable across configuration, adapters, runtime state, and routing provenance. They are a better public contract source than dotted namespaces such as `mimirmesh.srclight`, upstream-reported product labels, or user-configured aliases.
- **Alternatives considered**:
  - Use existing adapter namespace strings and strip `mimirmesh.` during publication: rejected because it couples public naming to an internal dotted namespace field that may still need to exist for internal compatibility.
  - Use upstream runtime-reported labels: rejected because upstream naming may drift independently of MímirMesh's canonical engine model.
  - Allow per-project custom prefixes: rejected because it weakens documentation, tests, and operator expectations for a shared MCP contract.

## Decision 3: Treat retired aliases as guided failures, not compatibility aliases

- **Decision**: Do not publish retired `mimirmesh`-prefixed passthrough aliases; when invoked, they must fail with explicit replacement guidance naming the correct `<engine>_<tool>` target.
- **Rationale**: The specification requires one published passthrough contract and clear migration behavior. Guided failure preserves user upgrade clarity without keeping duplicate public surfaces alive.
- **Alternatives considered**:
  - Keep both names indefinitely: rejected because it leaves the old contract alive and makes documentation/tests ambiguous.
  - Keep both names for a temporary deprecation window: rejected because the spec chose immediate retirement with explicit guidance.
  - Let legacy aliases fail as generic unknown-tool errors: rejected because it increases migration cost and violates the clarified requirement.

## Decision 4: Apply the contract to passthrough-capable MímirMesh engines with canonical IDs, including future engines

- **Decision**: The naming contract covers all passthrough-capable MímirMesh engines that have canonical engine IDs, including future engines added under the same engine model.
- **Rationale**: The feature is about engine-native naming consistency, not a one-off Srclight rename. Binding the rule to canonical engine IDs makes it reusable for document and ADR engines and for future bundled engines.
- **Alternatives considered**:
  - Limit the contract to the currently bundled engines only: rejected because it would force future engine naming exceptions or repeated rename work.
  - Force arbitrary proxied external MCP servers into the same contract immediately: rejected because the spec excludes servers that do not participate in the canonical MímirMesh engine-ID model.

## Decision 5: Validate the rename at the publication, invocation, documentation, and workflow layers

- **Decision**: Validation must span server transport-name publication, passthrough invocation/error handling, package routing/discovery coverage where relevant, root integration/workflow tests, and the user-facing docs/skill guidance that currently document old names.
- **Rationale**: The user-visible contract changes at the MCP surface, but the current codebase also teaches and asserts those names in docs, skills, integration tests, and workflow tests. Leaving any of those layers stale would make the feature appear broken.
- **Alternatives considered**:
  - Limit validation to unit tests around the name transformation helper: rejected because it would miss the server registration surface and end-to-end publication behavior.
  - Update only feature docs and skip skill docs: rejected because skill guidance is part of the repo's operational agent surface and currently instructs users to call old passthrough names.
