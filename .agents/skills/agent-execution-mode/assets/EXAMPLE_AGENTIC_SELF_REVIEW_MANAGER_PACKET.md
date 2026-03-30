# Mode
agentic-self-review

# Task
- Re-review completed feature work after remediation.
- Verify that completion claims, validation claims, and changed behavior are actually supported.

# Repo Root
/absolute/path/to/repository

# Review Target
- Inspect the changed files and supporting feature artifacts for the bounded feature scope below.

# Governing References
- /absolute/path/to/repository/AGENTS.md
- /absolute/path/to/repository/docs/specifications/011-example/spec.md
- /absolute/path/to/repository/docs/specifications/011-example/plan.md
- /absolute/path/to/repository/docs/specifications/011-example/tasks.md
- /absolute/path/to/repository/.agents/skills/agent-execution-mode/references/REVIEW_INSTRUCTIONS.md

# Acceptance Basis
- Approved feature behavior must match the accepted spec and plan.
- Completion claims in docs and validation artifacts must be truthful.
- Any remaining finding is blocking.

# Changed Scope
- packages/runtime/src/services/example-service.ts
- packages/runtime/tests/example-service.test.ts
- apps/cli/src/commands/example.tsx
- apps/cli/tests/commands/example.test.tsx
- docs/specifications/011-example/quickstart.md
- docs/specifications/011-example/validation.md

# Validation Digest
- PASS `bun test packages/runtime/tests/example-service.test.ts packages/runtime/tests/example-service.integration.test.ts`
- PASS `bun test apps/cli/tests/commands/example.test.tsx`
- PASS `bun run typecheck`
- PASS `bun run biome:check`

# Review Focus
- Confirm fallback behavior does not stop on structurally empty payloads.
- Confirm CLI contract matches the committed operator surface.
- Confirm validation and quickstart claims are supported by the recorded evidence.
- Confirm changed docs did not overclaim runtime state or operator readiness.
