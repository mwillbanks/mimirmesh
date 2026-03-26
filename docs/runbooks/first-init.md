# First Installation Runbook

1. Install dependencies: `bun install`
2. Build artifacts: `bun run build`
3. Install CLI: `curl -fsSL https://github.com/mwillbanks/mimirmesh/releases/latest/download/install.sh | bash` (or local dev fallback: `MIMIRMESH_INSTALL_DIR="$HOME/.local/bin" bun run scripts/install.ts`)
4. In a target repo, run: `mimirmesh install`
5. Confirm reports in `.mimirmesh/reports`
6. Confirm runtime status with `mimirmesh runtime status`
7. Confirm project-local upgrade status with `mimirmesh runtime upgrade status`
8. Confirm the initial MCP core surface with `mimirmesh mcp list-tools`
9. Load a deferred engine group with `mimirmesh mcp load-tools srclight` (or another enabled engine) and re-run `mimirmesh mcp list-tools`
10. Inspect fuller schema detail for one visible tool with `mimirmesh mcp tool-schema search_code --view full`
11. After a CLI update, run `mimirmesh runtime upgrade migrate` in each project that already has `.mimirmesh/`
12. If upgrade status is degraded, run `mimirmesh runtime doctor` and then `mimirmesh runtime upgrade repair`
13. Configure IDE MCP via `mimirmesh install ide` if you skipped IDE integration during the umbrella install flow
14. Attach repository-local bundled skills via `mimirmesh skills install` if you skipped skills during the umbrella install flow
15. If you prefer copied skill installs, set `skills.install.symbolic: false` in `~/.mimirmesh/config.yml` before installing or updating skills
16. If MCP config was generated before upgrading, rerun `mimirmesh install ide` to refresh target-specific schema and server command wiring
17. After upgrading MímirMesh, run `mimirmesh skills update` in repositories that use copied or broken-link skill installs
18. If the IDE still reports invalid tool names, run `mimirmesh update` (or local dev fallback: rebuild with `bun run build` and reinstall with `bun run scripts/install.ts`) so `mimirmesh-server` is updated
