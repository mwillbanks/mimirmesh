# Data Model: Remove Codebase-Memory MCP Engine

## Entity: EngineCatalog

- Purpose: Authoritative set of supported engine identifiers used by schema validation, defaults, CLI toggles, adapter selection, and runtime orchestration.
- Fields:
  - `engineIds` (set of enum values)
  - `requiredByDefault` (set of engine IDs)
- Validation rules:
  - `codebase-memory-mcp` must not exist in `engineIds`.
  - Remaining IDs must map to registered adapters.
- State transitions:
  - `legacy-catalog` -> `retired-catalog` during feature rollout.

## Entity: ProjectConfigDocument

- Purpose: Persisted `.mimirmesh/config.yml` with engine configuration and runtime settings.
- Fields:
  - `engines` (object keyed by supported engine ID)
  - `runtime` (runtime settings including `gpuMode`)
  - `migrationMetadata` (implicit by retired-key absence after write-back)
- Validation rules:
  - No persisted `engines["codebase-memory-mcp"]` after successful migration.
  - Existing explicit `engines.srclight` values must be preserved on overlap.
- State transitions:
  - `legacy` (contains retired key) -> `migrated` (retired key removed, Srclight backfilled, persisted once).

## Entity: LegacyEngineMigration

- Purpose: One-time transformation decision performed during config load when legacy key is present.
- Fields:
  - `legacyPresent` (boolean)
  - `overlapDetected` (boolean)
  - `backfilledFields` (list of Srclight fields populated from legacy)
  - `persisted` (boolean)
  - `failureReason` (nullable string)
- Validation rules:
  - `persisted=true` required for successful migration path.
  - `overlapDetected=true` implies no overwrite of existing Srclight values.
  - No automatic backup artifact creation.
- State transitions:
  - `detected` -> `transformed` -> `validated` -> `persisted` (success)
  - `detected|transformed|validated` -> `failed` (write failure or validation failure).

## Entity: AdapterRegistrySnapshot

- Purpose: Runtime-visible adapter list used for discovery and routing.
- Fields:
  - `adapters` (array of adapter IDs)
  - `codeIntelligenceAdapter` (expected `srclight`)
- Validation rules:
  - `codebase-memory-mcp` must not appear.
  - `srclight` remains present and enabled by default.

## Entity: RuntimeServiceTopology

- Purpose: Rendered compose service set and readiness evidence for active engines.
- Fields:
  - `serviceNames` (array)
  - `bootstrapModes` (map engine -> bootstrap mode)
  - `healthSummary` (engine status set)
- Validation rules:
  - `mm-codebase-memory` must not be rendered.
  - Srclight bootstrap/readiness evidence remains intact.
- State transitions:
  - `pre-retirement` topology -> `retired-engine` topology with one fewer engine service.
