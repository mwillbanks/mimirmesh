# Runtime Operations

Runtime state is project-scoped under `.mimirmesh/runtime`.

Upgrade state and safety evidence also live under `.mimirmesh/runtime/`:

- `version.json`
- `upgrade-metadata.json`
- `upgrade-checkpoint.json`
- `upgrade-backups.json`

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

If Docker is not installed or daemon is unavailable, runtime commands fail safely with degraded status and clear diagnostics.

Runtime upgrade behavior:

- upgrades are checkpointed and resumable
- backups are created before each mutating step
- only the active failing step is restored from backup
- preserved assets are validated individually after reconcile
- invalid assets are quarantined without deleting the rest of `.mimirmesh`
- out-of-window state is reported as blocked and left untouched

Operational note:

- `runtime refresh` and `runtime upgrade migrate` reconcile metadata and already-started services but do not auto-start a stopped runtime. Use `mimirmesh runtime start` when a start is explicitly desired.
