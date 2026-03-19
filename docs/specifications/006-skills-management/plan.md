# Plan 006: Bundled Skills Management

## Scope

- Add bundled-skill install/update/remove operations.
- Add global install-mode config for skill installation.
- Ship interactive multi-select prompts for the new command family.
- Update docs and ADRs.

## Design

### Skill asset source

- Reuse the bundled skills under `packages/skills/` during source-checkout execution.
- Reuse `dist/mimirmesh-assets/skills/` when running from built artifacts.
- Allow a `MIMIRMESH_SKILLS_ASSETS_DIR` override for deterministic testing and packaging fallback.

### Install target

- Repository-local target: `.agents/skills/`
- Install modes:
  - `symlink`
  - `copy`

### Global config

- New global config file path: `~/.mimirmesh/config.yml`
- New setting: `skills.install.symbolic`

### CLI UX

- Use guided multi-select prompts for interactive selection.
- Use workflow outcomes and next actions consistent with the existing CLI model.
- Keep non-interactive behavior explicit and safe.
