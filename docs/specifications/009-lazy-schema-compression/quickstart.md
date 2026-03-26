# Quickstart: Token Reduction via Lazy Tool Registration and Schema Compression

## Objective

Validate the session-scoped lazy tool registration and schema compression flow end to end, including config policy reload, MCP-compatible notifications, CLI visibility, and final validation gates.

## Execution Governance

- Implement and harden the feature under `agent-execution-mode` in `hardening` mode.
- After claiming completion, run `agent-execution-mode` in `agentic-self-review` mode and resolve safe findings before handoff.
- Apply `code-discipline`, `repo-standards-enforcement`, `mm-unit-testing`, and `biome-enforcement` throughout implementation and validation.

## Prerequisites

- Bun workspace dependencies installed
- A repository-local `.mimirmesh/config.yml` available or creatable through the existing config flow
- Runtime-capable environment for focused integration checks
- MCP client or CLI harness able to observe `notifications/tools/list_changed`

## 1. Run targeted package and workflow tests first

```bash
cd /Volumes/Projects/mimirmesh
bun test packages/mcp-core packages/runtime packages/config apps/cli tests/workflow
```

Expected result:

- router/compression/session-surface tests pass
- config schema/default reload tests pass
- CLI workflow regressions for tool listing/loading/schema views pass

## 2. Validate initial compressed core tool surface

```bash
cd /Volumes/Projects/mimirmesh
bun run apps/server/src/index.ts
```

Manual checks with an MCP client:

- initial `listTools()` shows only core unified tools plus required management tools
- tool descriptions are visibly compressed but still present for every published tool
- deferred engine groups are indicated without exposing their passthrough tools as already loaded

## 3. Validate explicit deferred-group load and notification refresh

```bash
cd /Volumes/Projects/mimirmesh
bun run apps/cli/src/cli.ts mcp load-tools srclight
```

Expected result:

- the CLI shows progress for live discovery and registration
- the server emits `notifications/tools/list_changed`
- refreshing `listTools()` shows compressed `srclight_*` tools for the requesting session only
- startup health remains degraded or blocked until the core discovery/readiness gate has passed

## 4. Validate on-demand full schema access

```bash
cd /Volumes/Projects/mimirmesh
bun run apps/cli/src/cli.ts mcp tool-schema srclight_search --view full
```

Expected result:

- compressed/default view remains concise
- full view exposes fuller schema detail through the standard MCP-compatible inspection path
- no custom protocol or side channel is required

## 5. Validate session isolation and policy reload

```bash
cd /Volumes/Projects/mimirmesh
bun test tests/integration packages/runtime/tests apps/server
```

Manual checks:

- loading a deferred engine group in one session does not change another active session’s visible tool count
- after editing `.mimirmesh/config.yml`, future list/load operations observe the new policy within 5 seconds
- already-loaded groups remain stable until explicit refresh
- lazy-load logs include timestamps, engine name, discovered tool count, and success/failure status

## 6. Run repository-native validation

```bash
cd /Volumes/Projects/mimirmesh
bun run typecheck
bun run test
bun run build
```

Expected result:

- no type errors
- tests pass under Bun-native repo commands
- build succeeds for the compiled server/CLI surfaces

## 7. Run mandatory Biome enforcement as the final remediation pass

```bash
cd /Volumes/Projects/mimirmesh
bunx @biomejs/biome check --write --unsafe --changed --no-errors-on-unmatched --files-ignore-unknown=true --reporter=json
```

Expected result:

- zero remaining Biome errors on changed files
- if Biome edits files, re-run `bun run typecheck`, `bun run test`, and `bun run build`

## 8. Finish with mandatory self-review gate

- state completion only after the hardening implementation, tests, docs, and validation have actually passed
- immediately run `agent-execution-mode` in `agentic-self-review`
- fix safe findings before concluding the feature work

## Observed Validation Snapshot

Measured from the CI-safe benchmark and integration fixtures added for this feature:

| Outcome | Result |
|---------|--------|
| SC-001 default surface reduction vs eager baseline | 41.44% smaller |
| SC-002 partially loaded session vs eager baseline | 27.78% smaller after one engine group is visible |
| SC-003 lazy-load completion target | pass, guarded by `< 2s` in `tests/integration/mcp/lazy-load-latency.test.ts` |
| SC-005 live policy propagation target | pass, guarded by the policy-refresh workflow validation suite |
| SC-007 notification plus refresh visibility target | pass, covered by MCP startup and integration refresh tests |
| RVO-004 compressed schema target | 40.93% smaller for the representative `srclight_search_symbols` schema payload |

Benchmark references:

- `packages/mcp-core/tests/registry/router.performance.test.ts`
- `tests/integration/mcp/lazy-load-latency.test.ts`
- `tests/workflow/mcp-policy-refresh.test.ts`
- `apps/server/tests/startup/start-server.test.ts`
