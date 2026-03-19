# Contract: Engine Retirement Runtime Surface

## Purpose

Define required runtime and adapter surface after retiring `codebase-memory-mcp`.

## Supported Engine Surface

- Active engines include Srclight and other non-retired engines.
- Retired engine `codebase-memory-mcp` is absent from:
  - Engine schema IDs
  - Default config engine blocks
  - Adapter registry exports
  - Compose-rendered services

## Routing and Discovery Contract

1. Discovery remains live-discovered for active engines.
2. Unified routing must not expose retired engine adapter/tool registrations.
3. Srclight code-intelligence flows remain available without retired-engine fallback branches.

## Runtime Service Contract

1. Rendered compose output contains zero `mm-codebase-memory` services.
2. Runtime startup/readiness evidence references only active engines.
3. Engine-specific bootstrap logic has no retired-engine branch behavior.

## Validation Contract

- Config/default validation confirms zero retired engine keys.
- Adapter registry validation confirms zero retired adapter IDs.
- Runtime/compose validation confirms zero retired service names.
- Integration/workflow tests confirm continued Srclight code-intelligence behavior.
