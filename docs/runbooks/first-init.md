# First Initialization Runbook

1. Install dependencies: `bun install`
2. Build artifacts: `bun run build`
3. Install CLI: `MIMIRMESH_INSTALL_DIR="$HOME/.local/bin" bun run scripts/install.ts`
4. In a target repo, run: `mimirmesh init`
5. Confirm reports in `.mimirmesh/reports`
6. Confirm runtime status with `mimirmesh runtime status`
7. Confirm project-local upgrade status with `mimirmesh runtime upgrade status`
8. After a CLI update, run `mimirmesh runtime upgrade migrate` in each project that already has `.mimirmesh/`
9. If upgrade status is degraded, run `mimirmesh runtime doctor` and then `mimirmesh runtime upgrade repair`
10. Configure IDE MCP via `mimirmesh install ide`
11. Attach repository-local bundled skills via `mimirmesh skills install`
12. If you prefer copied skill installs, set `skills.install.symbolic: false` in `~/.mimirmesh/config.yml` before installing or updating skills
13. If MCP config was generated before upgrading, rerun `mimirmesh install ide` to refresh target-specific schema and server command wiring
14. After upgrading MímirMesh, run `mimirmesh skills update` in repositories that use copied or broken-link skill installs
15. If the IDE still reports invalid tool names, rebuild (`bun run build`) and reinstall artifacts (`bun run scripts/install.ts`) so `mimirmesh-server` is updated
