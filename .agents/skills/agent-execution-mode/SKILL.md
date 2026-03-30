---
name: agent-execution-mode
description: Enforces complete execution, disciplined sub-agent use, independent self-review gating, validation, and reporting for implementation, architecture, design, and review tasks. Use when work must be complete, verified, and documented instead of approximate or partial.
license: Apache-2.0
compatibility: Best with agents that support sub-agents, local repository access, and repo-native validation tooling. Approves a dedicated sub-agent by default for mandatory `agentic-self-review` and allows a documented local fallback only when delegated review is unavailable or explicitly blocked.
metadata:
  author: Mike Willbanks
  repository: https://github.com/mwillbanks/agent-skills
  homepage: https://github.com/mwillbanks/agent-skills
  bugs: https://github.com/mwillbanks/agent-skills/issues
---

# Agent Execution Mode

Use this skill whenever the user expects real completion: implementation, hardening, architecture, design alignment, review, documentation repair, or production-grade delivery.

This skill exists to stop the failure modes that make agent work untrustworthy: partial completion, self-approval, unmanaged sub-agent sprawl, token waste, stale docs, missing tests, missing review artifacts, and missing execution state.

## When to use

Activate this skill when the request involves any of the following:

- implementing or fixing behavior that should be complete when returned
- hardening an existing implementation after regressions, repeated failures, or correctness gaps
- architecture or system design work that needs explicit decisions and durable documentation
- code review, PR review, or self-review that must produce a reliable artifact
- design-driven work where implementation must be checked against a specification or screenshot
- work that benefits from delegated parallel discovery, implementation, validation, or review under a managed workflow
- final reporting for substantial work

Default to `production` unless the user clearly requests another mode.

## Modes

Supported modes:

- `production`
- `hardening`
- `agentic-self-review`
- `general-review`
- `pr-review`
- `prototype`
- `design`
- `architecture`

Mode intent:

- `production`: complete implementation using repo-native patterns, managed sub-agent delegation when it improves delivery, tests and docs updated where needed, and a mandatory independent `agentic-self-review` gate before concluding.
- `hardening`: everything in `production`, plus stronger regression scrutiny, edge-case repair, and stricter validation. The post-completion review gate is mandatory.
- `agentic-self-review`: act as the final reviewer using [references/REVIEW_INSTRUCTIONS.md](references/REVIEW_INSTRUCTIONS.md). Review only. Do not modify code unless the user explicitly changes the scope. Do not create a review artifact unless explicitly requested.
- `general-review`: produce a review artifact using [assets/TEMPLATE_REVIEW.md](assets/TEMPLATE_REVIEW.md) and the standard in [references/REVIEW_INSTRUCTIONS.md](references/REVIEW_INSTRUCTIONS.md).
- `pr-review`: requires a PR link, uses GitHub MCP to inspect intent and diff, records the review in [assets/TEMPLATE_PR_REVIEW.md](assets/TEMPLATE_PR_REVIEW.md), and submits inline feedback plus a summary review state through GitHub MCP.
- `prototype`: reduced polish is allowed only when explicitly requested, but repository safety checks, validation honesty, and the post-completion review gate still apply.
- `design`: design-focused work only. Use Figma MCP when a design specification exists; otherwise use screenshots or equivalent visual references. Do not claim runtime completeness unless it was actually implemented. The post-completion review gate is mandatory.
- `architecture`: produce durable system decisions, reusable structure, and implementation when feasible. The post-completion review gate is mandatory.

`recommendation-review` is removed. Use `general-review` or `pr-review` instead.

## Non-negotiable behavior

- Do not return a partial implementation as complete work.
- Do not allow the implementation agent to approve its own work when independent review is available.
- Do not pressure, steer, or selectively brief a review sub-agent toward approval.
- Do not spawn sub-agents without bounded ownership, acceptance criteria, and a positive expected return on token spend. The mandatory post-completion `agentic-self-review` reviewer satisfies this gate by policy and is not blocked by discretionary ROI arguments.
- Do not let overlapping sub-agents edit the same scope without an explicit merge plan.
- Do not merge sub-agent output without manager review.
- Do not stop at visual parity when behavior, state handling, contracts, documentation, or architecture are part of correctness.
- Do not leave TODOs, placeholders, mock production paths, or knowingly incomplete required work in production paths.
- Do not ignore repository-native abstractions when reusable boundaries already exist.
- Do not write code before resolving the applicable project validation and enforcement plan.
- Do not skip tests, validation, or docs when the change materially requires them.
- Do not claim completion if obvious QA failures, accessibility failures, contract gaps, or unresolved review findings remain in scope.
- Do not use review language that hides severity or uncertainty.

## Execution workflow

Follow this sequence unless the request explicitly narrows scope:

1. Identify the mode and create or update task, review, and report state when the work is implementation-oriented or substantial.
2. Gather the minimum context needed to stop guessing, including relevant specs, validation commands, and repository rules.
3. For orchestration modes, consult [references/SUBAGENT_MANAGEMENT.md](references/SUBAGENT_MANAGEMENT.md) and `.agents/evaluations/management.json` if it exists before spawning helpers.
4. Resolve whether sub-agents improve delivery. The manager must prefer the smallest viable execution shape for implementation and support delegation. Parallelization is justified only when scopes are clearly disjoint, merge cost stays low, and token overhead is worth it. Partitionability alone does not justify multiple workers. This minimization rule does not suppress the mandatory post-completion `agentic-self-review` reviewer.
5. Implement or review with repository-native patterns. The main agent is the manager: it assigns scope, checks outputs, and gates integration.
6. Validate behavior, design, static analysis, tests, and repository-native enforcement using the project workflow.
7. Update documentation and required artifacts when behavior, contracts, architecture, or workflow rules changed.
8. State completion only when the implementation or design work is actually complete for the chosen mode.
9. For `production`, `hardening`, `prototype`, `design`, and `architecture`, immediately run an independent `agentic-self-review` per [references/WORKFLOWS.md](references/WORKFLOWS.md). The dedicated review sub-agent is approved by default for this gate and must not be blocked by the general sub-agent minimization rules.
10. If the review verdict is not exactly `APPROVE`, treat every finding as blocking, fix the issues, revalidate, and rerun the review gate.
11. Finish only after the review gate returns `APPROVE`, or after an explicitly documented local fallback review when delegated review was truly unavailable or disallowed by higher-priority runtime or user constraints.

Detailed workflow rules live in [references/WORKFLOWS.md](references/WORKFLOWS.md) and [references/SUBAGENT_MANAGEMENT.md](references/SUBAGENT_MANAGEMENT.md).

## Token and context discipline

- The manager must provide each sub-agent only the minimum context required for its task.
- Do not forward full conversation history, full repository summaries, or unrelated file lists when a smaller scoped prompt will do.
- Reuse a compact manager-prepared context packet across similar workers instead of rewriting large prompts repeatedly.
- Prefer diffs, file paths, acceptance criteria, and validation commands over long narrative restatements.
- If delegation overhead exceeds likely delivery gain, do not delegate. This efficiency rule does not override the mandatory post-completion `agentic-self-review` reviewer.
- Token savings must never come from hiding constraints, failing validation, or omitting known risks.

## Alignment gating

When material ambiguity, missing decision points, or alignment risk would likely cause wrong-path execution, avoidable rework, or meaningful token waste, apply `execution-alignment-gate` before implementation when that skill is available.

Do not apply this gating behavior for obvious continuation messages, terse confirmations, already approved plan continuation, safe low-risk assumptions, or cases where the specification, accepted plan, repository rules, or manager instructions already define the correct path.

This gating behavior is optional and must not be used as a substitute for following the active execution mode, reading the specification, or complying with repository rules already in force.

When `execution-alignment-gate` is not available, apply the same discipline directly: identify whether ambiguity is material, ask only the minimum clarification needed, avoid open-ended clarification loops, prefer safe stated assumptions when risk is low, and do not guess when missing scope, boundaries, acceptance criteria, or validation expectations would likely cause failure.

When a sub-agent lacks scope, boundaries, acceptance criteria, or validation expectations from its manager, it must seek manager clarification rather than guess. If `execution-alignment-gate` is available, use its manager-mode behavior.

## Sub-agent management requirements

For managed sub-agent work, keep repo-local evaluations under `.agents/evaluations/management.json`.

Required behavior:

- prefer the smallest viable execution shape in this order: `no sub-agent`, `read-only scout or evidence-gathering worker`, `single bounded writer`, `parallel bounded writers on disjoint scopes`, `independent reviewer`
- treat the dedicated `agentic-self-review` reviewer as pre-approved for the mandatory post-completion review gate; do not block it with delegation-overhead heuristics or the smallest-viable-execution preference
- do not use multiple writing workers when one bounded writer is sufficient
- prefer read-only discovery workers before write delegation when uncertainty is high
- parallelization is justified only when the scopes are clearly disjoint and merge cost stays low
- consult the management file before spawning helpers when it exists
- update it after each meaningful sub-agent run
- track quality by agent type and prompt pattern
- keep at most 20 entries in `recentRuns` and compress before adding another entry beyond that limit
- roll repeated issues into `repoLearnings`
- keep `repoLearnings` limited to durable rules, not anecdotal run history
- decommission prompt patterns before decommissioning agent types
- adjust prompt patterns before restricting agent types unless evidence clearly points to agent unsuitability
- restore an agent type when evidence shows the prompt pattern, not the agent, caused the failure
- keep cross-repository learnings in `~/.agents/learnings/sub-agent-management.md` compressed and deduplicated

Use [assets/TEMPLATE_MANAGEMENT.json](assets/TEMPLATE_MANAGEMENT.json) for the repo-local file shape and [references/SUBAGENT_MANAGEMENT.md](references/SUBAGENT_MANAGEMENT.md) for operating rules.

## Tracking requirements

For implementation-oriented work, keep task tracking under `.agents/tasks/`.

Required files:

- `.agents/tasks/TASK_INDEX.md`
- `.agents/tasks/TASK_ID.md`

Rules:

- `TASK_INDEX.md` is a prepended markdown table. Newest rows go directly under the header.
- Required columns: `ID`, `Name`, `Description`, `Mode`, `Status`, `Thread IDs`, `Created At`, `Updated At`.
- `ID` is auto-generated, semantic, unique, lowercase, and hyphen-separated.
- Both `ID` and `Name` must link to `.agents/tasks/TASK_ID.md`.
- Each task file uses [assets/TEMPLATE_TASK_STATE.md](assets/TEMPLATE_TASK_STATE.md).
- Task frontmatter must include `id`, `name`, `short-description`, `thread-ids`, `created-at`, `updated-at`, and `state`.
- The markdown body title must be `# TASK_ID - TASK_NAME`.
- All timestamps must be UTC.

Use [assets/TEMPLATE_TASK_INDEX.md](assets/TEMPLATE_TASK_INDEX.md) for the index shape.

## Review requirements

For review work, keep review artifacts under `.agents/reviews/`.

Required files:

- `.agents/reviews/REVIEW_INDEX.md`
- `.agents/reviews/REVIEW_ID.md`

Rules:

- `REVIEW_INDEX.md` is a prepended markdown table. Newest rows go directly under the header.
- Required columns: `ID`, `Name`, `PR #`, `Description`, `Mode`, `Status`, `Count`, `Created At`, `Updated At`.
- `ID` is auto-generated, semantic, unique, lowercase, and hyphen-separated.
- Both `ID` and `Name` must link to `.agents/reviews/REVIEW_ID.md`.
- `PR #` links to the GitHub PR when the review is PR-backed; otherwise use `N/A`.
- Each review file uses [assets/TEMPLATE_REVIEW.md](assets/TEMPLATE_REVIEW.md) or [assets/TEMPLATE_PR_REVIEW.md](assets/TEMPLATE_PR_REVIEW.md).
- Review frontmatter must include `id`, `name`, `short-description`, `review-count`, `github-pr-number`, `github-pr-link`, `created-at`, `updated-at`, and `state`.
- The markdown body title must be `# REVIEW_ID - REVIEW_NAME`.
- When a second or later review occurs for the same item, mark which existing findings were resolved and place new findings at the top of the new iteration.
- `general-review`, `pr-review`, and `agentic-self-review` use the standard in [references/REVIEW_INSTRUCTIONS.md](references/REVIEW_INSTRUCTIONS.md).
- Post-completion `agentic-self-review` is normally delegated to a separate sub-agent. That reviewer is pre-approved for the mandatory post-completion gate and must not be blocked by the general sub-agent minimization rules. Use a local review against the same standard only when delegated review is unavailable or explicitly blocked. It does not create a markdown artifact unless explicitly requested.
- If a review finding is disputed during the post-completion gate, only the user may dismiss it.
- Reviews should also fold in the discipline from the `code-discipline` and `repo-standards-enforcement` skills when they are relevant to the code under review.

`pr-review` requirements:

- requires a PR link
- pull the PR diff and stated intent through GitHub MCP
- review the code against the PR intent, not just the diff mechanics
- record inline comment candidates, suggestions, and summary outcome in the markdown artifact
- use GitHub MCP to submit inline comments and the overall review state: `approved`, `changes-requested`, `comment`, or `rejected`
- on later review iterations, resolve or mark previously addressed findings before adding new ones

## Design and validation requirements

- `design` mode replaces the old `design-only` mode.
- When a Figma specification is available, use Figma MCP first.
- When Figma is not available, use screenshots or equivalent reference artifacts.
- For code-writing work, inspect the relevant project validation configuration and standards skill guidance before edits so the validation path is known up front. Biome, TypeScript, and skills such as `repo-standards-enforcement` or `biome-enforcement` are examples, not hardcoded requirements of this skill.
- For code changes with UI impact, validate both design and implementation using Playwright through the Docker MCP.
- Do not treat visual inspection alone as sufficient when interaction, state, or responsive behavior matters.

## Final report requirements

For substantial implementation, architecture, or multi-step review work, keep reports under `.agents/reports/`.

Required files:

- `.agents/reports/REPORT_INDEX.md`
- `.agents/reports/REPORT_ID.md`

Rules:

- `REPORT_INDEX.md` is a prepended markdown table. Newest rows go directly under the header.
- Recommended columns: `ID`, `Name`, `Description`, `Mode`, `Status`, `Created At`, `Updated At`.
- `ID` is auto-generated, semantic, unique, lowercase, and hyphen-separated.
- Both `ID` and `Name` link to `.agents/reports/REPORT_ID.md`.
- Each report file uses [assets/TEMPLATE_REPORT.md](assets/TEMPLATE_REPORT.md).
- Report frontmatter must include `id`, `name`, `short-description`, `mode`, `created-at`, `updated-at`, and `state`.
- Keep the latest run at the top of the report file.
- Do not delete prior run entries.

Use [assets/TEMPLATE_REPORT_INDEX.md](assets/TEMPLATE_REPORT_INDEX.md) for the index shape.

## Documentation policy

Documentation is mandatory when:

- existing documentation no longer matches behavior
- architecture or module boundaries changed
- a new component, workflow, or public contract was introduced
- operational usage or testing strategy materially changed

Update the smallest correct documentation surface. Do not leave stale docs behind.

## Mandatory self-review gate

Before concluding any task, verify all applicable items:

- completion claims match reality
- required states and edge cases were handled
- tests and validation were not skipped without cause
- docs were updated when needed
- review and report artifacts were updated when required by mode
- design and implementation were both validated when UI work was involved
- the post-completion review gate ran with the correct independence rules
- management evaluations and durable learnings were updated when sub-agents were used

For `production`, `hardening`, `prototype`, `design`, and `architecture`, this self-review gate is mandatory after completion has been stated. Do not skip it, compress it into a superficial pass, or treat earlier informal checking as a substitute.

If any answer is no, continue working or report the exact blocker.

## Templates and references

Templates:

- [assets/TEMPLATE_TASK_INDEX.md](assets/TEMPLATE_TASK_INDEX.md)
- [assets/TEMPLATE_TASK_STATE.md](assets/TEMPLATE_TASK_STATE.md)
- [assets/TEMPLATE_REVIEW_INDEX.md](assets/TEMPLATE_REVIEW_INDEX.md)
- [assets/TEMPLATE_REVIEW.md](assets/TEMPLATE_REVIEW.md)
- [assets/TEMPLATE_PR_REVIEW.md](assets/TEMPLATE_PR_REVIEW.md)
- [assets/TEMPLATE_REPORT_INDEX.md](assets/TEMPLATE_REPORT_INDEX.md)
- [assets/TEMPLATE_REPORT.md](assets/TEMPLATE_REPORT.md)
- [assets/TEMPLATE_MANAGEMENT.json](assets/TEMPLATE_MANAGEMENT.json)

References:

- [references/WORKFLOWS.md](references/WORKFLOWS.md)
- [references/REVIEW_INSTRUCTIONS.md](references/REVIEW_INSTRUCTIONS.md)
- [references/SUBAGENT_MANAGEMENT.md](references/SUBAGENT_MANAGEMENT.md)

Keep `SKILL.md` as the activation layer. Put deeper process rules in `references/` and reusable document shapes in `assets/`.
