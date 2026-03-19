# Spec 006: Bundled Skills Management

## Summary

Add a repository-local CLI surface for installing, updating, and removing the bundled MímirMesh skills from `.agents/skills/`, with interactive selection by default and a global install-mode preference that controls symbolic-link vs copy installation.

## Requirements

### R1. Bundled skill install command

The CLI MUST provide `mimirmesh skills install [skill-name]`.

- When `skill-name` is omitted in an interactive terminal, the command MUST present all bundled skills in a multi-select prompt.
- Interactive install MUST default all bundled skills to selected.
- When `skill-name` is omitted in non-interactive mode, the command MUST install all bundled skills.
- Installed skills MUST land in `.agents/skills/<skill-name>`.

### R2. Bundled skill update command

The CLI MUST provide `mimirmesh skills update [skill-name]`.

- When `skill-name` is omitted in an interactive terminal, the command MUST present only installed bundled skills that are currently out of date.
- Interactive update MUST default all shown outdated skills to selected.
- When `skill-name` is omitted in non-interactive mode, the command MUST update all outdated installed bundled skills.

### R3. Bundled skill remove command

The CLI MUST provide `mimirmesh skills remove [skill-name]`.

- When `skill-name` is omitted in an interactive terminal, the command MUST present only bundled skills currently installed in the repository.
- Interactive remove MUST default no skills to selected.
- When `skill-name` is omitted in non-interactive mode, the CLI MUST refuse to guess and require an explicit `skill-name`.

### R4. Install mode preference

The skill install mode MUST be controlled by a global config setting at `skills.install.symbolic`.

- Default value: `true`
- If the global config file is absent, MímirMesh MUST behave as though `skills.install.symbolic: true` were configured without silently creating the file.
- When `true`, install/update MUST prefer symbolic links.
- When `false`, install/update MUST copy skill directories into `.agents/skills/`.

### R5. Outdated detection

The CLI MUST detect whether an installed bundled skill is out of date.

- Symlinked skills are current when the link resolves to the active bundled skill source.
- Copied skills are current when their file content matches the bundled skill source.
- Broken symlinks MUST be treated as out of date.

### R6. Documentation and workflow

The feature MUST update README, CLI surface docs, first-run/runbook guidance, and ADR/spec artifacts so the repository has one coherent documented workflow.
