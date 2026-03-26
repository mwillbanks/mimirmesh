---
name: mimirmesh-skill-usage-enforcement
description: Enforce the MimirMesh-first skill workflow by discovering before reading, reading before broad loading, and resolving before improvising.
license: Apache-2.0
---

# MimirMesh Skill Usage Enforcement

## Purpose
- Keep agent skill usage deterministic and repository-aware.

## When to Use
- Use when an agent is about to browse or load local skills broadly.
- Use when a task needs the next relevant skill rather than the whole catalog.

## Steps
- Run `skills.find` before loading local skill bodies broadly.
- Use `skills.read` in `memory` mode first and request only the needed indexes or assets.
- Use `skills.resolve` when the task description is known but the exact skill is not.
- Use `skills.refresh` after skill-package changes or cache staleness.
- Use `skills.create` and `skills.update` for guided authoring and maintenance.

## Avoid
- Do not treat `AGENTS.md` as a runtime ranking source.
- Do not load every skill body when a targeted read will do.
