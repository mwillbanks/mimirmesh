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
15. If bundled skills are included during `mimirmesh install`, choose an embeddings setup strategy when prompted. Supported modes are `disabled`, Docker-managed `llama_cpp`, existing LM Studio, existing OpenAI-compatible runtime, and OpenAI. Non-interactive installs can pass `--embeddings`, `--embeddings-model`, `--embeddings-base-url`, and `--embeddings-api-key`.
16. When Docker-managed `llama_cpp` is selected, MímirMesh renders a project-scoped Compose service that materializes `docker/images/llama-cpp/Dockerfile` into `.mimirmesh/runtime/images/llama-cpp/Dockerfile` and builds from that runtime path around an official `ghcr.io/ggml-org/llama.cpp` base image instead of relying on host-native llama.cpp execution.
17. Use `mimirmesh skills find`, `mimirmesh skills read <skill-name>`, `mimirmesh skills resolve <prompt>`, and `mimirmesh skills refresh` to inspect the deterministic skill registry after installation
18. If you want to author a new skill package, use `mimirmesh skills create`; if you want to update an existing non-bundled skill package, use `mimirmesh skills update <skill-name>`
19. If you prefer copied skill installs, set `skills.install.symbolic: false` in `~/.mimirmesh/config.yml` before installing or updating skills
20. If MCP config was generated before upgrading, rerun `mimirmesh install ide` to refresh target-specific schema and server command wiring
21. After upgrading MímirMesh, run `mimirmesh skills update` in repositories that use copied or broken-link skill installs
22. If the IDE still reports invalid tool names, run `mimirmesh update` (or local dev fallback: rebuild with `bun run build` and reinstall with `bun run scripts/install.ts`) so `mimirmesh-server` is updated
