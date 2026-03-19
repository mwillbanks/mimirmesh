# Research 006

## Why `.agents/skills/`

The repository-local `.agents/skills/` target keeps installed skills scoped to the repository instead of mutating shared agent state.

## Why symbolic links by default

Symbolic links make bundled skills track the currently installed MímirMesh version automatically after application upgrades.

## Why copy mode still matters

Copied skills avoid broken links and work better in environments where symlink creation is restricted, at the cost of duplication and explicit updates.
