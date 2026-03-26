# Runtime Operations

Runtime state is project-scoped under `.mimirmesh/runtime`.

Active runtime engine services now center on Srclight, `document-mcp`, and `mcp-adr-analysis-server`.
`codebase-memory-mcp` has been retired, so runtime renders and health state should not include `mm-codebase-memory`.

Upgrade state and safety evidence also live under `.mimirmesh/runtime/`:

- `version.json`
- `upgrade-metadata.json`
- `upgrade-checkpoint.json`
- `upgrade-backups.json`
- `mcp-server.json`
- `mcp-sessions/*.json`

Commands:

- `mimirmesh runtime start`
- `mimirmesh runtime stop`
- `mimirmesh runtime restart`
- `mimirmesh runtime status`
- `mimirmesh runtime refresh`
- `mimirmesh runtime doctor`
- `mimirmesh runtime upgrade status`
- `mimirmesh runtime upgrade migrate`
- `mimirmesh runtime upgrade repair`

The bare `mimirmesh` dashboard shell exposes runtime lifecycle and upgrade
surfaces directly from the TUI. Direct commands remain fully supported and use
the same workflow rendering language when run outside the shell.

If Docker is not installed or daemon is unavailable, runtime commands fail safely with degraded status and clear diagnostics.

Human-facing runtime commands now show:

- active step progress
- warning and observed-state sections
- explicit `success`, `degraded`, or `failed` outcomes
- blocked capabilities and next actions for partial-success cases

For automation:

- use `--non-interactive` on mutating runtime commands
- use `--json` when callers need the serialized workflow envelope

Status and inspection commands remain non-interactive by default.

MCP tool-surface operations:

- `mimirmesh mcp list-tools` reports session id, policy version, compression level, loaded groups, deferred groups, and recent lazy-load diagnostics
- `mimirmesh mcp load-tools <engine>` performs live discovery for a deferred engine group and updates only the current session
- `mimirmesh mcp tool-schema <tool>` returns compressed or full schema detail for visible tools
- `mimirmesh runtime status` includes the current MCP loaded/deferred group state in its workflow evidence and machine-readable payload

Runtime upgrade behavior:

- upgrades are checkpointed and resumable
- backups are created before each mutating step
- only the active failing step is restored from backup
- preserved assets are validated individually after reconcile
- invalid assets are quarantined without deleting the rest of `.mimirmesh`
- out-of-window state is reported as blocked and left untouched

Operational note:

- `runtime refresh` and `runtime upgrade migrate` reconcile metadata and already-started services but do not auto-start a stopped runtime. Use `mimirmesh runtime start` when a start is explicitly desired.
- `runtime upgrade repair` repairs preserved runtime state only. It does not rebuild or restart Docker containers. If the reported required action is `restart-runtime`, run `mimirmesh runtime restart --non-interactive` after repair so the live runtime actually picks up the rebuilt images and compose definition.
