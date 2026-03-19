---
name: agent-execution-mode
description: Use this skill to enforce disciplined execution, completeness, and correctness in implementation, review, and architecture tasks. This skill prevents lazy, partial, visually approximate, or obviously incomplete work by enforcing mode-specific behavior, implementation tracking, documentation hygiene, and final reporting.
license: Apache-2.0
metadata:
  author: Mike Willbanks
  repository: https://github.com/mwillbanks/agent-skills
  homepage: https://github.com/mwillbanks/agent-skills
  bugs: https://github.com/mwillbanks/agent-skills/issues
---

# Agent Execution Mode

Use this skill whenever the user asks for implementation, bug fixing, architecture work, hardening, design alignment, documentation updates, technical review, or production-grade delivery and expects the work to be completed thoroughly rather than approximated.

This skill exists to prevent lazy, partial, superficial, visually approximate, or obviously incomplete work. It enforces execution discipline, mode-specific behavior, implementation tracking, documentation hygiene, and final reporting.

Default assumption:

- The user wants a production-grade result.
- The user expects one-pass completion unless explicitly asking for prototype or design-only work.
- The user does not want scaffolding, placeholders, TODOs, fake completion, or deferred required work.

---

## When to use

Invoke this skill when the request involves any of the following:

- implementing a feature
- fixing a bug
- completing or correcting a previous implementation
- hardening an existing implementation
- refactoring that affects behavior, architecture, maintainability, or DX
- aligning code to a specification, design system, product behavior, or technical document
- performing code review, self-review, or recommendation review
- architecture design for reusable systems, pipelines, event systems, workers, APIs, or full stack systems
- updating related documentation as part of implementation correctness

Use this skill by default for engineering tasks unless the user explicitly requests a prototype, sketch, rough draft, or design-only deliverable.

---

## Modes

This skill supports the following execution modes.

If the user does not specify a mode, default to `production`.

### 1. `production`

Use for normal implementation tasks where the result is expected to be complete, repo-native, maintainable, tested, and plausibly shippable.

Requirements:

- full implementation end to end
- repository-native patterns must be followed
- tests must be updated or added where appropriate
- documentation must be updated when required
- no known required work may be deferred
- no placeholders, stubs, TODOs, fake handlers, or obviously incomplete behavior in production paths

### 2. `hardening`

Use when the task is about production hardening, repeated failed attempts, correctness repair, regression prevention, or final stabilization.

Requirements:

- everything in `production`
- adjacent fixes are required when clearly coupled to correctness, unless they would cause scope explosion
- stronger regression scrutiny
- stronger UX, state, payload, error, and accessibility validation
- stronger verification before claiming completion

### 3. `agentic-self-review`

Use when the prompt implies that the agent should review its own work and directly fix obvious issues safely.

Examples:

- “review your work”
- “double check this implementation”
- “self-review and correct issues”

Requirements:

- perform ruthless review of the implementation
- apply direct fixes where obviously safe
- do not create a review markdown file
- do not treat a superficial pass as review
- verify that prior work actually satisfies implementation goals

### 4. `recommendation-review`

Default review mode when the user asks for a review with recommendations.

Requirements:

- perform ruthless review
- produce concrete recommendations and patch guidance
- write review findings to `.reviews/REVIEW_NAME.md`
- review files are not intended to be committed
- focus on actionable, specific, technically grounded findings
- do not silently claim work is acceptable when meaningful issues remain

### 5. `general-review`

Use when the user asks for a general review and expects review output stored as a markdown review artifact.

Requirements:

- perform ruthless review
- write review findings to `.reviews/REVIEW_NAME.md`
- apply direct fixes only when explicitly appropriate or clearly safe within review scope
- findings must be concrete, evidence-based, and prioritized

### 6. `prototype`

Use only when the user explicitly asks for a prototype, quick concept, spike, sketch, or rough implementation.

Still non-negotiable:

- no fake production claims
- no broken type safety
- no silently skipped known blockers
- minimal documentation note indicating prototype status

Allowed differences from production:

- reduced polish
- reduced test depth when explicitly appropriate
- narrower edge-case coverage
- limited state handling only when clearly documented

### 7. `design-only`

Use only when the user explicitly wants visual or structural design work without claiming runtime completion.

Requirements:

- explicitly forbid claiming runtime completeness
- do not claim production readiness
- do not imply behavior is fully implemented unless it actually is
- document any intentionally unimplemented runtime behavior

### 8. `architecture`

Use for reusable systems, cross-cutting decisions, platform architecture, event systems, API architecture, data pipelines, and component/system design.

Requirements:

- produce architecture-level decisions and reusable structure
- include scaffolding, specifications, and ADR/spec updates as appropriate
- also implement concrete code when feasible
- prioritize maintainability, extensibility, and long-term correctness over quick hacks
- document important decisions and tradeoffs

---

## Core execution policy

These rules apply across modes unless the mode explicitly narrows scope.

### Non-negotiable behavior

- Do not provide a partial implementation when the task is asking for completion.
- Do not stop at visual parity when behavior, states, payloads, architecture, or documentation are part of correctness.
- Do not leave TODOs, placeholders, stubs, fake handlers, mock production logic, or knowingly incomplete required work in production paths.
- Do not preserve broken structure just because it already exists.
- Do not use one-off shortcuts where reusable repository patterns clearly apply.
- Do not ignore nested components, composed boundaries, slots, states, variants, or shared abstractions when they are relevant.
- Do not assume the user wants follow-up prompts to finish required work.
- Do not skip test updates because the implementation “looks obvious.”
- Do not skip documentation updates when existing documentation would no longer match the implementation or when behavior, architecture, public contracts, operational workflows, testing strategy, or module/component structure materially changed.
- Do not claim completion if obvious QA failures, missing states, broken payload handling, broken type safety, or correctness gaps remain in scope.

### Required posture

- prefer completeness over speed
- prefer correctness over minimal diff size
- prefer repo-native architecture over shortcuts
- prefer maintainability over one-off patches
- prefer QA passability over visual approximation
- prefer reusable component and module boundaries over screen-local hacks
- treat provided designs and specifications as behavioral and architectural inputs, not screenshots
- if adjacent issues must be fixed for the requested task to actually be correct, include those fixes in the same pass unless that would create unreasonable scope explosion

---

## Tracking requirements

For implementation-oriented work, maintain a task tracker at:

- `.agents/task-state.md`

Tracking should be created and updated when it materially helps track execution state, decisions, or implementation gaps, but it should not be updated so frequently that it creates excessive token churn.

The tracker should be concise and useful.

Recommended structure:

```markdown
# Task State

## Task
- <task name>

## Mode
- <production | hardening | agentic-self-review | recommendation-review | general-review | prototype | design-only | architecture>

## Objective
- <what is being implemented or reviewed>

## Current Phase
- <discovery | implementation | validation | docs | review | complete>

## Active Work Items
- [ ] item
- [x] item

## Decisions Made
- decision

## Assumptions
- assumption

## Risks / Gaps
- risk or gap

## Validation
- command or validation result

## Documentation Impact
- docs updated or no update required with reason
```

Rules:

- keep it concise
- use it to preserve state across a larger implementation
- record meaningful decisions that may need to be revisited later
- record meaningful gaps or blockers
- do not use it as a verbose diary

---

## Documentation policy

Documentation is mandatory when:

- existing documentation would no longer match the implementation
- behavior changed
- architecture changed
- a new component or module was added
- a public API or contract changed
- an operational workflow changed
- a testing strategy materially changed

Documentation targets must be checked in this order:

1. nearby README
2. package README
3. `docs/`
4. architecture decision record
5. `AGENTS.md`
6. inline code comments for tricky logic
7. API docs / OpenAPI
8. storybook or component usage docs

Documentation rules:

- do not over-document trivial changes
- do not leave stale docs in place when behavior changed
- prefer precise developer-facing explanations over fluff
- document important decisions and non-obvious behavior
- document prototype status explicitly when in `prototype` mode

---

## Definition of done

A task is only complete when all applicable items below are satisfied for the selected mode:

- requested scope is implemented or reviewed correctly
- repository-native patterns are followed
- relevant reusable boundaries were handled correctly
- relevant states and flows are addressed
- payloads, contracts, and data handling are correct
- accessibility was addressed where applicable
- tests were updated or added where appropriate
- required validation was performed
- required documentation was updated
- no obvious regressions remain in adjacent affected flows
- no placeholders, TODOs, or knowingly incomplete required paths remain
- the result is plausibly shippable for `production` and `hardening`, or accurately labeled for non-production modes

---

## Mandatory self-review gate

Before concluding any task, perform a strict self-review.

Confirm all applicable items:

- this is not a partial implementation
- this is not a visual-only patch disguised as completion
- this is not copied design output masquerading as repo-native implementation
- reusable boundaries were not collapsed into one-off markup or one-off modules
- required states and edge cases were not skipped
- required payload and contract issues were not left behind
- tests were not skipped
- documentation was not left stale
- accessibility was not ignored
- obvious QA failures were not left behind
- completion claims match the actual implementation state

If the answer is no for any applicable item, continue working or report the exact blocker.

---

## Review artifact rules

### Review output location

For `recommendation-review` and `general-review`, create review artifacts at:

- `.reviews/REVIEW_NAME.md`

These files are not intended to be committed.

### Review artifact structure

```markdown
# Review: <name>

## Scope
- <what was reviewed>

## Summary
- <high level summary>

## Findings
### High
- finding
- impact
- recommendation

### Medium
- finding
- impact
- recommendation

### Low
- finding
- impact
- recommendation

## Safe Direct Fixes Applied
- item

## Suggested Next Actions
- item
```

Rules:

- findings must be concrete and actionable
- findings must identify why the issue matters
- recommendations must be specific enough to implement
- do not pad reviews with low-value noise
- be ruthless, technical, and precise

---

## Final report requirements

For implementation or architecture work, maintain a report file at:

- `.agents/reports/`

Requirements:

- markdown format
- one file per topic or chat instance
- latest run on top
- do not delete old entries
- append a new dated run entry at the top of the file

Recommended report structure:

```markdown
# Report: <topic>

## Run: <timestamp>

### Mode Used
- <mode>

### Scope Completed
- item

### Decisions Made
- item

### Docs Updated
- item
- or `None required` with reason

### Validation Run
- command and result

### Risks / Blockers
- item
- or `None`

### Optional Follow-ups
- item
- only include if truly optional
```

Rules:

- do not claim completion without validation summary
- do not omit documentation status
- do not include fake blockers
- follow-up items must be truly optional, not disguised required work

---

## Output behavior

When responding to the user after using this skill:

- state the mode used
- summarize the completed scope
- summarize key decisions
- summarize documentation changes
- summarize validation performed
- summarize risks or blockers honestly
- only list follow-up items if they are actually optional

Do not hide incompleteness behind vague language. Do not imply production readiness when the selected mode does not warrant it.

---

## Refusal of lazy behavior

This skill exists specifically to prevent the following failure patterns:

- partial implementation returned as completion
- visually approximate work returned as production-ready
- TODOs or placeholders left in required paths
- skipped states, payload handling, validation, tests, or docs
- one-off hacks used instead of maintainable architecture
- obvious adjacent breakage ignored
- fake certainty or fake completion claims

If the task cannot be fully completed, explicitly identify the blocker and complete everything else that can be completed correctly in the same pass. Do not leave the user with an incomplete or misleading result; be transparent about what was achieved and what remains blocked.
