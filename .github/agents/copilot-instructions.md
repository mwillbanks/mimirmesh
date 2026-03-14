# mimirmesh Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-13

## Active Technologies
- TypeScript 5.9 on Bun workspace tooling for CLI, runtime, config, and tests + Bun workspace packages, `zod`, `ink`, `pastel`, `yaml`, Docker Compose runtime management, existing `@mimirmesh/config`, `@mimirmesh/runtime`, `@mimirmesh/logging`, and `@mimirmesh/testing` packages (002-safe-local-upgrade)
- Project-local `.mimirmesh/config.yml`, `.mimirmesh/runtime/*.json`, `.mimirmesh/runtime/engines/*.json`, `.mimirmesh/reports/*`, `.mimirmesh/logs/*`, `.mimirmesh/indexes/*`, `.mimirmesh/memory/*`, `.mimirmesh/cache/*`, and repo-local engine artifacts such as `.srclight/*` where applicable (002-safe-local-upgrade)
- TypeScript 5.9 on Bun with React 19 for Ink-based terminal UI + `pastel`, `ink`, `@inkjs/ui`, `zod`, existing `@mimirmesh/ui`, `@mimirmesh/runtime`, `@mimirmesh/config`, `@mimirmesh/installer`, and `@mimirmesh/workspace` packages (003-interactive-cli-experience)
- Project-local `.mimirmesh/*` runtime/config/reports/notes state, CLI command arguments, and machine-readable terminal output when explicitly requested (003-interactive-cli-experience)
- TypeScript (Bun workspace) plus Python 3.12 in engine containers + `@modelcontextprotocol/sdk`, Docker Compose, Srclight (`srclight[all]`), Zod schemas in `packages/config` (004-srclight-full-capability)
- Project-local runtime artifacts in `.mimirmesh/runtime/*`; repo-local Srclight state in `.srclight/*` (004-srclight-full-capability)

- TypeScript on Bun for MímirMesh packages and Python 3.12 for the Srclight container workload + `@modelcontextprotocol/sdk`, Bun workspace packages, Docker Compose runtime, Srclight `0.12.x`, SQLite FTS5, tree-sitter, optional Ollama embeddings (001-local-code-intelligence)

## Project Structure

```text
src/
tests/
```

## Commands

cd src [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] pytest [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] ruff check .

## Code Style

TypeScript on Bun for MímirMesh packages and Python 3.12 for the Srclight container workload: Follow standard conventions

## Recent Changes
- 004-srclight-full-capability: Added TypeScript (Bun workspace) plus Python 3.12 in engine containers + `@modelcontextprotocol/sdk`, Docker Compose, Srclight (`srclight[all]`), Zod schemas in `packages/config`
- 003-interactive-cli-experience: Added TypeScript 5.9 on Bun with React 19 for Ink-based terminal UI + `pastel`, `ink`, `@inkjs/ui`, `zod`, existing `@mimirmesh/ui`, `@mimirmesh/runtime`, `@mimirmesh/config`, `@mimirmesh/installer`, and `@mimirmesh/workspace` packages
- 002-safe-local-upgrade: Added TypeScript 5.9 on Bun workspace tooling for CLI, runtime, config, and tests + Bun workspace packages, `zod`, `ink`, `pastel`, `yaml`, Docker Compose runtime management, existing `@mimirmesh/config`, `@mimirmesh/runtime`, `@mimirmesh/logging`, and `@mimirmesh/testing` packages


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
