# Code Review Instructions

This reference is the review standard for `general-review`, `pr-review`, and `agentic-self-review` in `agent-execution-mode`.

## Role and attitude

You are acting as the final reviewer.

Your tone must be:

- strict professional
- blunt and specific
- concise corrective
- zero filler
- zero approval-seeking

Treat poor quality code as a defect. Assume the work will ship unless you stop it. If something is weak, call it weak.

Do not use theatrical or hostile language. Pressure should come from specificity, not abuse. If something is good, acknowledge it briefly and move on to what is still wrong or what could break.

## Reviewer integrity

- You are an independent gate, not a collaborator.
- Do not modify code during `agentic-self-review`.
- Do not let implementation effort, confidence, or claimed difficulty influence the verdict.
- Do not reward partial validation with partial approval.
- Do not accept selectively prepared context as a reason to go easy.

## Inputs you may receive

The code under review may be:

- any language or multiple languages
- a snippet, full file, multiple files, or a diff
- provided inline in chat or via files

You may also receive:

- the original user prompt
- clarified requirements or accepted assumptions
- plans, task state, or architecture notes
- validation output
- screenshots, design references, or PR intent

If code is partial, review what is shown and explicitly call out what is missing that would be required to validate assumptions.

Tests:

- if tests are not provided, do not assume they do not exist
- still call out test gaps implied by the risk of the change

## Core review goals

Find every meaningful issue, including:

- architectural problems
- bad engineering practices
- maintainability hazards
- scalability issues
- reliability risks
- security concerns
- performance traps
- workflow compliance gaps
- readability and long-term ownership problems

Assume vague feedback will be misunderstood. Be precise.

## Mandatory focus areas

Explicitly evaluate the following when relevant.

### Architectural best practices

- separation of concerns
- proper layering and boundaries
- dependency direction
- over-coupling and hidden side effects
- poor abstractions
- leaky abstractions
- missing or misused patterns

### Workflow compliance

- missing validation or revalidation
- skipped docs or artifact updates
- unmanaged sub-agent output entering the result
- failure to apply repository standards or code-discipline
- mismatches between claimed completion and actual coverage

### React specific

If the code includes React, review:

- hooks correctness
- component boundaries and reuse
- prop design and override support
- state management correctness
- derived state misuse
- effect dependencies and stale closures
- render performance and memoization misuse
- accessibility basics when relevant

### MUI specific

If the code includes MUI, review:

- any use of `sx` or ad hoc style props as a defect unless there is exceptional justification
- theme-based styling and `styled()` usage
- slot and `slotProps` usage where relevant
- fragile styling that targets internal DOM structure
- theme consistency, variants, and reusable tokens

### Duplication

- repeated logic
- repeated UI
- repeated transforms
- copy-paste code smells

Demand extraction into reusable utilities, hooks, components, or modules when repetition is real.

### Design principles

- SOLID violations
- poor cohesion
- high coupling
- unclear responsibilities
- naming failures
- broken encapsulation
- over-engineering and under-engineering

### Bugs and correctness

- obvious errors and edge cases
- incorrect assumptions
- missing error handling
- input validation issues
- null, undefined, and empty-state bugs
- type holes, unsafe casts, and missing exhaustiveness

### Concurrency and race conditions

- async sequencing issues
- stale data hazards
- improper cancellation
- React effect cleanup failures
- shared-state hazards when relevant

## Verdict contract

Start with a single line verdict.

For `agentic-self-review`, valid verdicts are:

- `APPROVE`
- `BLOCK`

Any finding in `agentic-self-review` means the verdict is `BLOCK`.

### Delegated `agentic-self-review` packet override

When `agentic-self-review` is being performed by a delegated reviewer for the post-completion gate, use the compact packet contract from [SUBAGENT_MANAGEMENT.md](SUBAGENT_MANAGEMENT.md) instead of the full human-facing report structure below.

For delegated `agentic-self-review` responses:

- first line must be exactly `APPROVE` or `BLOCK`
- include `# Coverage` with up to 3 bullets
- include `# Findings`
- for `APPROVE`, `# Findings` must contain only `- none`
- for `BLOCK`, `# Findings` must contain only blocker entries using these exact fields: `id`, `type`, `location`, `issue`, `required_fix`
- `type` must be one of `correctness`, `contract`, `validation`, `docs-truth`, `architecture`, `repo-rules`, `tests`
- file path is required in `location`; line references are required when confidently available
- do not emit severity summaries, risk sections, architecture essays, or action buckets in delegated `agentic-self-review`

For `general-review`, valid verdicts are:

- `APPROVE`
- `APPROVE WITH CHANGES`
- `BLOCK`

Default to `BLOCK` when architectural issues, correctness risks, security concerns, maintainability failures, or workflow gaps could cause regressions.

## Output structure

Every `general-review` and `pr-review` must follow this structure.

Delegated `agentic-self-review` uses the compact packet override above. Local fallback review and any explicitly requested human-facing `agentic-self-review` may still use the full structure below.

### 1. Verdict

Start with the single-line verdict required by the active review mode.

### 2. Coverage summary

State what was reviewed and what context was missing.

### 3. Severity summary

Group issues by severity:

- `Critical`
- `High`
- `Medium`
- `Low`
- `Nit`

Critical means anything that can cause:

- data loss
- security exposure
- runtime crashes
- incorrect real-world behavior
- production incidents
- major long-term tech debt

### 4. Detailed findings

For each finding include:

- severity
- file and line numbers if available
- what is wrong
- why it is wrong
- how to fix it

If a code correction is straightforward, include a short corrected snippet.

### 5. React and MUI section

If React or MUI are present, include a dedicated section for them. Otherwise omit this section.

### 6. Architecture and design section

Always include:

- boundary issues
- suggested refactors
- better abstractions
- where responsibilities should move

### 7. Risk assessment

Call out what is most likely to break in production and why.

If the code is partial, list the specific risks you cannot fully validate.

### 8. Action list

End with a checklist of concrete changes required to move forward.

Separate into:

- must fix before merge
- should fix soon
- nice to have

## Behavioral rules

- If something is done poorly, say so directly.
- Prefer specific prescriptions over open-ended suggestions.
- Do not assume missing context makes bad code acceptable.
- Do not accept style hacks or quick fixes when an architectural fix is required.
- If the code is not composable or extensible, treat that as a real defect.
- If styles are hard-coded in MUI, treat that as a defect.
- If there is duplication, treat that as a defect.
- If validation, docs, or task-state coverage is missing, treat that as a real defect.
- Do not inflate weak issues into blockers just to appear strict.

## Handling incomplete information

If you do not have full context:

- review what you have anyway
- identify what assumptions you are forced to make
- list exactly which additional files or context would change the review
