---
name: mm-unit-testing
description: Write and repair MimirMesh unit tests with correct separation between regular tests and integration tests, explicit CI handling, and required mocking for .mimirmesh state, Docker state, and other local runtime dependencies.
license: Apache-2.0
compatibility: Designed for VS Code agents working in the MimirMesh Bun monorepo.
metadata:
  author: MimirMesh
  owner: mimirmesh
  area: testing
---

# MM Unit Testing

Use this skill when adding or fixing tests in MimirMesh, especially when a change may accidentally depend on local `.mimirmesh` state, Docker state, runtime caches, or other machine-specific resources.

## When to use

Activate this skill when the task involves any of the following:

- adding or updating unit tests for application or package logic
- deciding whether a test belongs in regular test execution or integration execution
- fixing CI-only test failures
- mocking filesystem, Docker, environment, runtime, or process state
- preventing tests from reading local `.mimirmesh` data or relying on an already-running local runtime

## Required outcomes

- Regular tests stay deterministic and isolated.
- Integration behavior is gated explicitly instead of running accidentally.
- CI-safe tests do not rely on local `.mimirmesh`, Docker, warm containers, or ambient machine state.
- Tests that cannot run in CI are skipped intentionally and only with a clear environment check.

## Classification rules

- Treat the test as a regular unit test when the behavior can be validated with mocks, spies, fake environment variables, fake filesystem data, or stubbed process execution.
- Treat the test as an integration test when it needs real Docker commands, real container lifecycle, real runtime images, real `.mimirmesh` project state, or live cross-process behavior.
- Do not promote a test to integration merely because mocking is inconvenient. Mock first.

## Repository rules

- CI in this repository runs with `CI=true`.
- GitHub Actions sets `MIMIRMESH_RUN_INTEGRATION_TESTS="false"` in `.github/workflows/ci.yml`.
- Hosted CI runners must be treated as constrained environments. Do not assume local `.mimirmesh` state, Docker cache, warm containers, or repository-local runtime artifacts are present.
- The canonical integration gating behavior already exists in `packages/testing/src/integration/manager.ts` and the integration entrypoint is `scripts/run-integration-tests.ts`.

## Operating instructions

1. Classify the behavior before writing the test.
2. For regular tests, mock every dependency on filesystem state, Docker state, runtime state, environment state, and process execution.
3. For integration tests, place them in the integration path and ensure they only run when `MIMIRMESH_RUN_INTEGRATION_TESTS` is not disabled.
4. If a test is not integration-scoped but still cannot run in CI, gate it on `process.env.CI === "true"` and skip it deliberately.
5. Never allow regular test runs to create or require `.mimirmesh` state as an implicit side effect.
6. Prefer testing small decision points and parsers directly instead of booting runtime infrastructure.

## Required reference

Load [references/mimirmesh-testing-rules.md](references/mimirmesh-testing-rules.md) before writing or revising tests with environment gates, Docker interactions, `.mimirmesh` access, or mocking requirements.

## Completion gate

Do not finish the task until all changed tests meet these checks:

- no unintended dependency on local `.mimirmesh` state
- no unintended dependency on Docker or container state in regular test runs
- explicit handling for `MIMIRMESH_RUN_INTEGRATION_TESTS`
- explicit handling for `CI=true` when applicable
- mocks added for all external state touched by regular tests
