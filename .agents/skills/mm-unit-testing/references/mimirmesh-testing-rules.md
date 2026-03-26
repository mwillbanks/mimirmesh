# MimirMesh Testing Rules

This reference defines the concrete rules for writing tests in this repository without breaking CI.

## Canonical environment facts

- `.github/workflows/ci.yml` sets `CI: true`.
- `.github/workflows/ci.yml` sets `MIMIRMESH_RUN_INTEGRATION_TESTS: "false"`.
- `packages/testing/src/integration/manager.ts` treats `false`, `0`, and `no` as disabled values for `MIMIRMESH_RUN_INTEGRATION_TESTS`.
- `scripts/run-integration-tests.ts` is the repository entrypoint for runtime-heavy integration execution.
- `bun run test` only covers package and app test suites; root CLI smoke coverage belongs under `tests/integration` and runs through `bun run test:integration`.

## What commonly breaks CI

The largest recurring failure mode is writing a test that silently uses local developer state:

- `.mimirmesh` directories or cached runtime files
- existing Docker images, containers, or builder cache
- a locally running runtime or service started outside the test
- filesystem state from the developer machine
- interactive terminal assumptions that differ when `CI=true`
- long-running CLI smoke tests that boot real install/runtime flows and leave cleanup to `rm` on hosted runners
- PTY dashboard smoke tests that rely on `script`/pseudo-terminal timing and do not materially add coverage beyond the integration suites

These assumptions frequently pass on a developer machine and fail in CI because the CI job is intentionally missing that local state.

## Decision rule: unit test vs integration test

Use a regular test when the code under test can be validated by mocking or stubbing:

- `node:fs` and `node:fs/promises`
- `Bun.spawn`
- `process.env`
- `console`
- Docker command wrappers
- path or configuration resolution

Use an integration test only when the test must verify real behavior across process or runtime boundaries, such as:

- real Docker image build or container lifecycle
- real engine startup
- real runtime orchestration
- real repository-local integration cache behavior under actual commands

## Required gating patterns

### Integration-enabled check

Use the same semantics as the repository integration manager:

```ts
const integrationEnabled = !["false", "0", "no"].includes(
  (process.env.MIMIRMESH_RUN_INTEGRATION_TESTS ?? "true").trim().toLowerCase(),
);
```

### CI check

```ts
const runningInCi = process.env.CI === "true";
```

### Skip integration or runtime-heavy tests

```ts
import { test } from "bun:test";

const integrationEnabled = !["false", "0", "no"].includes(
  (process.env.MIMIRMESH_RUN_INTEGRATION_TESTS ?? "true").trim().toLowerCase(),
);

const runtimeTest = integrationEnabled ? test : test.skip;

runtimeTest("runs against real runtime state", async () => {
  // integration-only behavior
});
```

### Skip non-integration tests that are still not CI-safe

Use this only when the test cannot be made deterministic with mocking.

```ts
import { test } from "bun:test";

const ciSafeTest = process.env.CI === "true" ? test.skip : test;

ciSafeTest("requires a local resource unavailable in CI", async () => {
  // intentionally skipped on CI
});
```

If the behavior can be mocked, do not use the CI skip. Convert it into a regular deterministic unit test instead.

## Required mocking behavior

For regular test runs, mock or stub any dependency on:

- `.mimirmesh` paths or contents
- Docker CLI execution
- container discovery, cleanup, or cache state
- file reads and writes outside temporary test fixtures
- current terminal capabilities when behavior changes in CI
- environment variables used for runtime gating

Typical examples:

- mock `Bun.spawn` instead of executing Docker
- mock `readFile`, `writeFile`, `mkdir`, and `rm` for `.mimirmesh` or cache interactions
- set `process.env.CI` and `process.env.MIMIRMESH_RUN_INTEGRATION_TESTS` explicitly inside the test and restore them afterward
- spy on `console.warn` or `console.log` rather than depending on live command output

## Placement rules

- Keep runtime-heavy tests in the integration suite, not the regular package test path.
- Keep parser, gating, and option-selection behavior in regular unit tests.
- Place root CLI smoke coverage under `tests/integration`, not `tests/workflow`.
- If a workflow-oriented test launches real install/runtime orchestration, shells out to built binaries, mutates temp repositories, or relies on runtime repair/upgrade side effects, reclassify it as integration instead of leaving it in the regular test path.
- If a pseudo-terminal smoke test is only validating shell launch behavior and still materially matters, keep it in `tests/integration`; otherwise replace it with a lighter deterministic assertion.
- When a file mixes both concerns, split the tests rather than letting ordinary test runs trigger runtime dependencies.

## Review checklist

Before concluding a testing change, verify:

- the test does not assume pre-existing `.mimirmesh` state
- the test does not assume Docker availability unless it is integration-scoped
- `MIMIRMESH_RUN_INTEGRATION_TESTS` is honored for integration behavior
- `CI=true` behavior is explicit when needed
- mocking covers external state instead of leaking machine-specific dependencies into unit tests
