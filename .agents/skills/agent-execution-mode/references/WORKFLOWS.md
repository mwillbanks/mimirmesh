# Workflow Rules

This file defines the durable workflow and document rules for `agent-execution-mode`.

## ID and timestamp rules

- Generate IDs from the task or review intent, not from a random string.
- IDs must be lowercase, unique, hyphen-separated, and stable for the life of the artifact.
- Good examples: `fix-auth-timeout`, `review-checkout-pr-482`, `report-cart-hardening`.
- Use UTC timestamps in ISO 8601 format: `2026-03-24T18:30:00Z`.
- `created-at` is immutable after creation.
- `updated-at` changes every time the artifact is materially updated.

## Task workflow

Use task tracking for implementation-oriented work, architecture work with active execution, and any large task that benefits from durable state.

Required files:

- `.agents/tasks/TASK_INDEX.md`
- `.agents/tasks/TASK_ID.md`

Required index columns:

| ID | Name | Description | Mode | Status | Thread IDs | Created At | Updated At |
| --- | --- | --- | --- | --- | --- | --- | --- |

Rules:

- Prepend new rows directly under the table header.
- Link both `ID` and `Name` to the task document.
- `Thread IDs` stores one or more agent thread identifiers as a comma-separated list in the index and as a YAML list in the task file.
- Keep task state concise. It is a state document, not a diary.

Suggested task states:

- `draft`
- `in-progress`
- `blocked`
- `review`
- `complete`

## Review workflow

Use review tracking for `general-review` and `pr-review`. `agentic-self-review` uses the same review standard but does not create a markdown artifact unless explicitly required.

Required files:

- `.agents/reviews/REVIEW_INDEX.md`
- `.agents/reviews/REVIEW_ID.md`

Required index columns:

| ID | Name | PR # | Description | Mode | Status | Count | Created At | Updated At |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Rules:

- Prepend new rows directly under the table header.
- Link both `ID` and `Name` to the review document.
- `Count` is the number of review iterations performed for the same artifact.
- On review iteration 2 or later, add a `Resolved Since Previous Review` section before new findings.
- New findings for the current iteration go at the top of the current iteration block.
- Re-reviewing without resolving or reclassifying previous findings is sloppy and invalidates the artifact.

Suggested review states:

- `draft`
- `in-progress`
- `changes-requested`
- `approved`
- `commented`
- `rejected`

### PR review workflow

`pr-review` is not just a local diff read. It is a GitHub-backed review workflow.

Required steps:

1. Capture the PR link in frontmatter and the index.
2. Pull the PR diff and stated intent through GitHub MCP.
3. Review against the stated intent, changed behavior, architecture impact, and regression risk.
4. Record candidate inline comments and suggestions in the review artifact.
5. Use GitHub MCP to publish inline comments and the overall review state.
6. On later iterations, mark which earlier findings were resolved before logging new findings.

Review states to use for GitHub summary comments:

- `approved`
- `changes-requested`
- `comment`
- `rejected`

## Report workflow

Use reports for substantial implementation, architecture, or multi-step review work.

Required files:

- `.agents/reports/REPORT_INDEX.md`
- `.agents/reports/REPORT_ID.md`

Recommended index columns:

| ID | Name | Description | Mode | Status | Created At | Updated At |
| --- | --- | --- | --- | --- | --- | --- |

Rules:

- Prepend new rows directly under the table header.
- Link both `ID` and `Name` to the report document.
- Keep the latest run at the top of the report body.
- Do not delete prior runs. Reports are an execution history.

Suggested report states:

- `draft`
- `in-progress`
- `complete`
- `blocked`

## Design validation workflow

Use this whenever code changes have meaningful UI impact.

Required steps:

1. Use Figma MCP when a specification exists.
2. Fall back to screenshots or equivalent artifacts when Figma is unavailable.
3. Validate the implemented result with Playwright through the Docker MCP.
4. Check layout, content, interaction, visible state transitions, and responsive behavior when they are in scope.

Visual parity alone is not enough when behavior or state changes are part of the request.

## Post-completion self-review workflow

The following modes must run `agentic-self-review` after completion has been stated:

- `production`
- `hardening`
- `prototype`
- `design`
- `architecture`

Rules:

1. Do the work.
2. State completion only when the task is actually complete for the chosen mode.
3. Immediately run `agentic-self-review`.
4. Apply obvious safe fixes.
5. Re-run affected validation if the self-review changes behavior or code.
6. Conclude only after the self-review pass is complete.

This is a mandatory second gate, not an optional polish step.

## Review standards integration

All review modes must apply:

- [REVIEW_INSTRUCTIONS.md](REVIEW_INSTRUCTIONS.md)
- the `code-discipline` skill when duplication, bad abstractions, or unnecessary wrappers are present
- the `repo-standards-enforcement` skill when toolchain, package management, typing, testing, or repository policy are relevant
