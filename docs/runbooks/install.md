# Install Runbook

1. Install dependencies: `bun install`
2. Build artifacts: `bun run build`
3. Install the CLI: `curl -fsSL https://github.com/mwillbanks/mimirmesh/releases/latest/download/install.sh | bash`
4. On Windows PowerShell, install with: `irm https://github.com/mwillbanks/mimirmesh/releases/latest/download/install.ps1 | iex`
5. In a target repo, run: `mimirmesh install`
6. Choose an install preset, review install areas, and confirm any install-managed updates before continuing
7. Confirm reports in `.mimirmesh/reports`
8. Confirm runtime status with `mimirmesh runtime status`
9. Confirm project-local upgrade status with `mimirmesh runtime upgrade status`
10. Configure IDE MCP via `mimirmesh install ide` if you skipped IDE integration during the umbrella install flow
11. Attach or update repository-local bundled skills with `mimirmesh skills install` or `mimirmesh skills update` if you skipped skills during the umbrella install flow
12. If you prefer copied skill installs, set `skills.install.symbolic: false` in `~/.mimirmesh/config.yml` before installing or updating skills
13. After a CLI update, run `mimirmesh runtime upgrade migrate` in each project that already has `.mimirmesh/`
14. If upgrade status is degraded, run `mimirmesh runtime doctor` and then `mimirmesh runtime upgrade repair`
