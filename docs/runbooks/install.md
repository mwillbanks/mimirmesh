# Install Runbook

1. Install dependencies: `bun install`
2. Build artifacts: `bun run build`
3. Install the CLI: `curl -fsSL https://github.com/mwillbanks/mimirmesh/releases/latest/download/install.sh | bash`
4. In a target repo, run: `mimirmesh install`
5. Choose an install preset, review install areas, and confirm any install-managed updates before continuing
6. Confirm reports in `.mimirmesh/reports`
7. Confirm runtime status with `mimirmesh runtime status`
8. Confirm project-local upgrade status with `mimirmesh runtime upgrade status`
9. Configure IDE MCP via `mimirmesh install ide` if you skipped IDE integration during the umbrella install flow
10. Attach or update repository-local bundled skills with `mimirmesh skills install` or `mimirmesh skills update` if you skipped skills during the umbrella install flow
11. If you prefer copied skill installs, set `skills.install.symbolic: false` in `~/.mimirmesh/config.yml` before installing or updating skills
12. After a CLI update, run `mimirmesh runtime upgrade migrate` in each project that already has `.mimirmesh/`
13. If upgrade status is degraded, run `mimirmesh runtime doctor` and then `mimirmesh runtime upgrade repair`
