# CLI Command Surface

The CLI supports init/setup/refresh/doctor, config operations, runtime lifecycle, runtime upgrade/repair flows, MCP tools, notes, documents, reports, IDE install, update checks, and Spec Kit flows.

The CLI is a primary product interface. Operator-facing commands are expected
to present a polished interactive terminal experience with structured output,
visible progress for long-running work, and prompt-driven flows where they
improve safety or usability. The full-screen TUI and direct subcommands are
expected to share the same state model and visual language. Human-readable
output is the default; machine-readable output is supported only when
explicitly requested.

All runtime and MCP behavior claims in feature documentation are expected to be
derived from live runtime execution, including prerequisite configuration,
bootstrap/indexing status, and degraded-mode diagnostics.

Spec Kit behavior is upstream-backed, not synthetic:

- `mimirmesh speckit init` installs or reuses the upstream `specify` CLI
- `mimirmesh speckit init` creates `.specify/` and agent prompts, then translates generated `specs/` references to `docs/specifications/`
- `mimirmesh speckit status` reports readiness from actual `.specify/` state
- `mimirmesh speckit doctor` flags partial states such as prompt files without `.specify/`
- `mimirmesh init` runs the same Spec Kit initialization flow automatically when `metadata.specKitExpected` is true and the repo is not Spec Kit-ready

Use `mimirmesh --help` for top-level usage and `mimirmesh <command> --help` for command-level detail.

Runtime upgrade commands:

- `mimirmesh upgrade`
- `mimirmesh runtime refresh`
- `mimirmesh runtime doctor`
- `mimirmesh runtime upgrade`
- `mimirmesh runtime upgrade status`
- `mimirmesh runtime upgrade migrate`
- `mimirmesh runtime upgrade repair`

`mimirmesh runtime status` now includes runtime version, schema version, health, and migration status evidence sourced from `.mimirmesh/runtime/`.
