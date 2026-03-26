# mimirmesh Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-13

## Active Technologies
- TypeScript 5.9 on Bun workspace tooling for CLI, runtime, config, and tests + Bun workspace packages, `zod`, `ink`, `pastel`, `yaml`, Docker Compose runtime management, existing `@mimirmesh/config`, `@mimirmesh/runtime`, `@mimirmesh/logging`, and `@mimirmesh/testing` packages (002-safe-local-upgrade)
- Project-local `.mimirmesh/config.yml`, `.mimirmesh/runtime/*.json`, `.mimirmesh/runtime/engines/*.json`, `.mimirmesh/reports/*`, `.mimirmesh/logs/*`, `.mimirmesh/indexes/*`, `.mimirmesh/memory/*`, `.mimirmesh/cache/*`, and repo-local engine artifacts such as `.srclight/*` where applicable (002-safe-local-upgrade)
- TypeScript 5.9 on Bun with React 19 for Ink-based terminal UI + `pastel`, `ink`, `@inkjs/ui`, `zod`, existing `@mimirmesh/ui`, `@mimirmesh/runtime`, `@mimirmesh/config`, `@mimirmesh/installer`, and `@mimirmesh/workspace` packages (003-interactive-cli-experience)
- Project-local `.mimirmesh/*` runtime/config/reports/notes state, CLI command arguments, and machine-readable terminal output when explicitly requested (003-interactive-cli-experience)
- TypeScript (Bun workspace) plus Python 3.12 in engine containers + `@modelcontextprotocol/sdk`, Docker Compose, Srclight (`srclight[all]`), Zod schemas in `packages/config` (004-srclight-full-capability)
- Project-local runtime artifacts in `.mimirmesh/runtime/*`; repo-local Srclight state in `.srclight/*` (004-srclight-full-capability)
- TypeScript 5.9 on Bun workspace + Bun, Zod (`@mimirmesh/config`), MCP SDK (`@modelcontextprotocol/sdk`), Ink/Pastel for CLI surfaces (005-remove-codebase-memory)
- Project YAML config (`.mimirmesh/config.yml`) and runtime state files under `.mimirmesh/runtime/` (005-remove-codebase-memory)
- TypeScript in a Bun workspace monorepo + `@modelcontextprotocol/sdk`, Bun test runner, Zod, Docker Compose-backed runtime packages (007-engine-native-passthrough)
- Project-local config and runtime state files in `.mimirmesh/runtime/*`; no new storage system (007-engine-native-passthrough)
- TypeScript in a Bun workspace monorepo, with Python-based upstream engines running in containers + `@modelcontextprotocol/sdk`, Bun test, Docker Compose runtime orchestration, existing MímirMesh runtime/router/adapter packages (007-engine-native-passthrough)
- Project-local runtime artifacts under `.mimirmesh/runtime/*` plus discovery/routing state files derived from live runtime endpoints (007-engine-native-passthrough)
- TypeScript 6.0.2 on Bun 1.3.x + Pastel 4, Ink 6, `@inkjs/ui` 2, React 19, Zod 4, workspace packages `@mimirmesh/ui`, `@mimirmesh/installer`, `@mimirmesh/skills`, `@mimirmesh/runtime`, `@mimirmesh/workspace`, `@mimirmesh/reports`, `@mimirmesh/config` (008-installer-wizard-v2)
- Repository-local files under `.mimirmesh/`, documentation files under `docs/`, IDE MCP config files, and repository-local skill installs under `.agents/skills/` (008-installer-wizard-v2)
- TypeScript 6.0.2 on Bun 1.3.x + `@modelcontextprotocol/sdk` 1.27.1, Zod 4.3.x, Pastel 4, Ink 6, `@inkjs/ui` 2, workspace packages `@mimirmesh/mcp-core`, `@mimirmesh/runtime`, `@mimirmesh/config`, `@mimirmesh/mcp-adapters`, `@mimirmesh/ui`, `@mimirmesh/logging` (009-lazy-schema-compression)
- Repository-local config and runtime state under `.mimirmesh/`, persisted runtime routing/engine state files, and per-process in-memory session tool surfaces for MCP server sessions (009-lazy-schema-compression)
- TypeScript 6.0.2 on Bun 1.3.x + `@modelcontextprotocol/sdk` 1.27.1, Zod 4.3.x, YAML 2.8.x, Pastel 4, Ink 6, `@inkjs/ui` 2, existing workspace packages `@mimirmesh/skills`, `@mimirmesh/mcp-core`, `@mimirmesh/runtime`, `@mimirmesh/config`, `@mimirmesh/installer`, `@mimirmesh/ui`, and Bun built-in SQL access to the runtime PostgreSQL service (010-deterministic-skill-registry)
- Runtime-managed PostgreSQL with pgvector extension available for indexed skill metadata, cache state, and optional embeddings; repository-local files remain the source of truth for skill packages, `.mimirmesh/config.yml`, `.agents/skills/`, and `AGENTS.md` (010-deterministic-skill-registry)
- TypeScript 6.0.2 on Bun 1.3.x + `@modelcontextprotocol/sdk` 1.27.1, `openai`, `pgvector-node`, Zod 4.3.x, YAML 2.8.x, Pastel 4, Ink 6, `@inkjs/ui` 2, existing workspace packages `@mimirmesh/skills`, `@mimirmesh/mcp-core`, `@mimirmesh/runtime`, `@mimirmesh/config`, `@mimirmesh/installer`, `@mimirmesh/ui`, Bun built-in SQL access to the runtime PostgreSQL service, and Bun built-in compression or UUID APIs (`Bun.randomUUIDv7`, `Bun.zstdCompress`, `Bun.zstdDecompress`, `Bun.gzipSync`, `Bun.gunzipSync`) (010-deterministic-skill-registry)
- Runtime-managed PostgreSQL with pgvector-backed vector columns for indexed skill metadata, repository-scoped cache state, compressed JSON or markdown blobs, optional embeddings, and migration history; repository-local files remain the source of truth for skill packages, `.mimirmesh/config.yml`, `.agents/skills/`, and `AGENTS.md` (010-deterministic-skill-registry)

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
- 010-deterministic-skill-registry: Added TypeScript 6.0.2 on Bun 1.3.x + `@modelcontextprotocol/sdk` 1.27.1, `openai`, `pgvector-node`, Zod 4.3.x, YAML 2.8.x, Pastel 4, Ink 6, `@inkjs/ui` 2, existing workspace packages `@mimirmesh/skills`, `@mimirmesh/mcp-core`, `@mimirmesh/runtime`, `@mimirmesh/config`, `@mimirmesh/installer`, `@mimirmesh/ui`, Bun built-in SQL access to the runtime PostgreSQL service, and Bun built-in compression or UUID APIs (`Bun.randomUUIDv7`, `Bun.zstdCompress`, `Bun.zstdDecompress`, `Bun.gzipSync`, `Bun.gunzipSync`)
- 010-deterministic-skill-registry: Added TypeScript 6.0.2 on Bun 1.3.x + `@modelcontextprotocol/sdk` 1.27.1, Zod 4.3.x, YAML 2.8.x, Pastel 4, Ink 6, `@inkjs/ui` 2, existing workspace packages `@mimirmesh/skills`, `@mimirmesh/mcp-core`, `@mimirmesh/runtime`, `@mimirmesh/config`, `@mimirmesh/installer`, `@mimirmesh/ui`, and Bun built-in SQL access to the runtime PostgreSQL service
- 009-lazy-schema-compression: Added TypeScript 6.0.2 on Bun 1.3.x + `@modelcontextprotocol/sdk` 1.27.1, Zod 4.3.x, Pastel 4, Ink 6, `@inkjs/ui` 2, workspace packages `@mimirmesh/mcp-core`, `@mimirmesh/runtime`, `@mimirmesh/config`, `@mimirmesh/mcp-adapters`, `@mimirmesh/ui`, `@mimirmesh/logging`


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
