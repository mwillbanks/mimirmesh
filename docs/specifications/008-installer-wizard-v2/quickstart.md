# Quickstart: Installer Wizard v2

## Objective

Validate the unified umbrella install workflow end to end after implementation.

## Prerequisites

- Bun workspace dependencies installed
- A fixture or temporary repository root available for CLI workflow tests
- Interactive terminal available for guided-flow validation

## 1. Run targeted CLI and workflow tests

```bash
cd /Volumes/Projects/mimirmesh
bun test apps/cli/tests tests/workflow tests/integration
```

Expected result:

- install workflow tests pass
- workflow regressions covering onboarding pass
- non-interactive guard tests verify explicit preset/per-area requirements

## 2. Validate the guided install flow interactively

```bash
cd /Volumes/Projects/mimirmesh/apps/cli
bun run src/cli.ts install
```

Manual checks:

- a preset is required as the first install policy choice
- optional areas can be reviewed and adjusted before execution
- if install-managed files would change, the CLI shows a summary before overwrite confirmation
- long-running steps expose visible progress and end with success/degraded/failed terminal outcome semantics

## 3. Validate non-interactive safety

```bash
cd /Volumes/Projects/mimirmesh/apps/cli
bun run src/cli.ts install --non-interactive
```

Expected result:

- command fails safely
- output explains that an explicit preset or explicit install-area selections are required

## 4. Validate explicit non-interactive execution

```bash
cd /Volumes/Projects/mimirmesh/apps/cli
bun run src/cli.ts install --non-interactive --preset minimal
```

Expected result:

- no prompts are shown
- the workflow completes deterministically using the explicit preset
- machine-readable mode remains semantically equivalent when `--json` is added
- if install-managed files already exist, rerun interactively so the CLI can show and confirm the pending updates

## 5. Validate command-surface cleanup

```bash
cd /Volumes/Projects/mimirmesh/apps/cli
bun run src/cli.ts --help
```

Expected result:

- `install` is the onboarding command
- `init` and `setup` no longer appear as supported onboarding commands

## 6. Run final repository validation

```bash
cd /Volumes/Projects/mimirmesh
bun run typecheck
bun run test
bunx @biomejs/biome check --write --unsafe --changed --no-errors-on-unmatched --files-ignore-unknown=true --reporter=json
```

Expected result:

- no type errors
- full test suite passes
- Biome reports zero diagnostics in changed files
