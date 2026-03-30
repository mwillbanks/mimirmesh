# Sub-Agent Management

This reference defines how orchestration modes use sub-agents, how management quality is recorded, and how recurring learnings stay compressed.

## Applicability

Use this reference whenever `agent-execution-mode` is active and the agent is considering sub-agent delegation.

It is mandatory for:

- `production`
- `hardening`
- `prototype`
- `design`
- `architecture`

It may also be applied in review modes when parallel evidence gathering is safe and useful.

## Managed delegation conditions

These modes permit managed sub-agent execution when all of the following are true:

- the work can be partitioned into independent chunks or read-only support tasks
- acceptance criteria can be stated up front
- file ownership or integration boundaries are clear
- the context and prompt setup cost is lower than the expected delivery gain
- the manager can validate outputs before integration

Multi-agent execution is not the default just because partitioning is possible.
The manager must still prefer the smallest viable execution shape for implementation and support delegation.
One bounded writer is preferred over parallel writers unless there is a clear delivery advantage with low integration cost.
Partitionability alone does not justify multiple workers.
Do not spawn helpers for trivial tasks, single-file edits with no meaningful parallel split, or tightly coupled work where delegation would create more churn than speed.
These minimization rules do not suppress the mandatory post-completion `agentic-self-review` reviewer.

## Delegation preference ladder

The manager must prefer the smallest viable execution shape in this order:

1. no sub-agent
2. read-only scout or evidence-gathering worker
3. single bounded writer
4. parallel bounded writers on disjoint scopes
5. independent reviewer

Rules:

- Do not use multiple writing workers when one bounded writer is sufficient.
- Prefer read-only discovery workers before write delegation when uncertainty is high.
- Parallelization is justified only when the scopes are clearly disjoint and merge cost stays low.

## Manager responsibilities

The main agent becomes the manager.

Required behavior:

- consult `.agents/evaluations/management.json` if it exists before writing prompts
- choose agent type and prompt pattern deliberately
- give each worker a bounded task, explicit acceptance criteria, and a stop condition
- give each worker only the minimum context required and reuse a compact manager-prepared context packet when multiple workers need the same scoped inputs
- include the original user prompt, clarified intent, repository rules, files in scope, validation plan, and known risks in the prompt
- prevent overlapping write ownership unless one worker is read-only
- review every result before merging or approving it
- acknowledge strong outcomes briefly
- correct weak outcomes with strict professional feedback, concise scoring, and direct procedural guidance

Do not use adversarial language. Escalate by increasing specificity, constraint density, and evidence.

## Required prompt payload

Every meaningful worker prompt should include:

- the original user prompt
- clarified requirements and accepted assumptions
- the active mode
- applicable skills, standards, or design references
- files or directories in scope
- the validation commands the worker must respect
- explicit ownership boundaries
- approval criteria
- reporting expectations

Do not hide failing validation, known defects, or unresolved assumptions from the worker.
Do not forward unrelated repository context when a smaller packet is sufficient.
Prefer diffs, file paths, acceptance criteria, and validation commands over long narrative restatements.

## Required worker response shape

Every meaningful worker must return a concise structured response containing:

- `summary`: the short outcome of the assigned task
- `files`: the files inspected or changed
- `validation`: the checks run and their result
- `blockers`: unresolved issues, risks, or missing context
- `manager-action`: the exact next decision the manager should take

Rules:

- Worker responses must be concise and operational.
- Do not return long diary-style narration.
- Do not restate the entire prompt in the response.
- The manager is responsible for integration and final synthesis.

## Independent self-review gate

Post-completion self-review requires an independent reviewer by default. The dedicated `agentic-self-review` reviewer is pre-approved and must not be blocked by the general sub-agent minimization rules.

These packet rules apply only to delegated manager to reviewer communication for `agentic-self-review`. They do not replace the full human-facing review formats used by `general-review`, `pr-review`, or local fallback review.

Rules:

1. Spawn a dedicated reviewer using `agentic-self-review` for the mandatory post-completion gate.
2. Do not treat this reviewer as optional because of delegation-overhead heuristics, smallest-viable-execution preference, or conservative anti-parallelism rules.
3. Use the compact packet contract below. Do not send freeform narrative when the packet will do.
4. Tell the reviewer to act as the final reviewer and not to modify code.
5. Do not ask the reviewer to approve. Do not bias the verdict.
6. If the verdict is exactly `APPROVE`, the gate passes.
7. If the verdict is not exactly `APPROVE`, every finding is blocking.
8. Only the user may dismiss a disputed finding.
9. Fix blockers, rerun affected validation, and repeat the review gate.
10. If sub-agent review cannot run because runtime or user constraints actually prevent it, use a documented local fallback review and record the exact constraint.

### Manager to reviewer packet contract

Use tagged markdown sections in this exact order. Keep the packet compact and operational.

Required sections:

1. `# Mode`
2. `# Task`
3. `# Repo Root`
4. `# Review Target`
5. `# Governing References`
6. `# Acceptance Basis`
7. `# Changed Scope`
8. `# Validation Digest`
9. `# Review Focus`

Section rules:

- `# Mode`: must state `agentic-self-review`.
- `# Task`: one short paragraph or up to 3 bullets describing what was completed and what the reviewer is verifying now.
- `# Repo Root`: single path only.
- `# Review Target`: state whether the reviewer should inspect changed files, diff, feature folder, or another bounded target.
- `# Governing References`: only the applicable spec, plan, task, repo-rule, or instruction references.
- `# Acceptance Basis`: only the completion claims or contracts that the review must verify.
- `# Changed Scope`: up to 12 bullets listing the main changed files or bounded areas.
- `# Validation Digest`: up to 10 entries. For each entry include command identity and outcome. Include raw output only for failing or disputed commands.
- `# Review Focus`: up to 8 bullets calling out disputed, risky, or easy-to-miss areas.

Do not include:

- prior blocker history
- long narrative summaries
- repeated repository context
- full raw validation logs unless a command failed or the failure is under review
- a separate `current facts` section

Manager packet requirements:

- Do not dump unrelated repo context into the review prompt.
- Do not omit known failures, disputed areas, or incomplete validation.
- Prefer file paths, commands, and bounded claims over narrative explanation.
- Keep the packet complete enough for integrity, but compressed enough to avoid waste.

### Reviewer to manager packet contract

Use tagged markdown sections in this exact order.

For approval:

1. First line exactly `APPROVE`
2. `# Coverage` with up to 3 bullets
3. `# Findings` with the single bullet `- none`

For a blocking review:

1. First line exactly `BLOCK`
2. `# Coverage` with up to 3 bullets
3. `# Findings` containing only blocker entries

Each blocker entry must use this fixed field set:

- `id`: short stable identifier such as `B1`
- `type`: one of `correctness`, `contract`, `validation`, `docs-truth`, `architecture`, `repo-rules`, `tests`
- `location`: file path required, line references when confidently available
- `issue`: the defect stated directly
- `required_fix`: the minimum corrective action required before approval

Reviewer response requirements:

- Do not restate the full manager packet.
- Do not emit severity summaries, risk sections, architecture essays, or action buckets in delegated `agentic-self-review`.
- Treat every finding as blocking regardless of category.
- Keep coverage factual and bounded.
- Keep findings operational and remediation-oriented.

## Management evaluation file

Use `.agents/evaluations/management.json` as a rolling compressed management record.

Keep these top-level keys:

- `version`
- `lastCompressedAt`
- `agentTypes`
- `promptPatterns`
- `recentRuns`
- `repoLearnings`

Expected run fields:

- `timestamp`
- `mode`
- `agentType`
- `promptPattern`
- `task`
- `delegationShape`
- `outcome`
- `failureClass`
- `causeAttribution`
- `tokenRoi`
- `managerDecision`
- `notes`

Suggested enums:

- `delegationShape`: `solo`, `scout`, `single-writer`, `parallel-writers`, `review-only`, `mixed`
- `outcome`: `good`, `mixed`, `bad`
- `failureClass`: `none`, `scope-control`, `validation-miss`, `repo-rules-miss`, `design-miss`, `over-delegation`, `under-specified-prompt`, `integration-churn`
- `causeAttribution`: `none`, `prompt-pattern`, `agent-type`, `context-packaging`, `task-selection`, `manager-integration`
- `tokenRoi`: `positive`, `neutral`, `negative`
- `managerDecision`: `reuse`, `adjust-prompt`, `restrict-agent`, `decommission-pattern`, `decommission-agent`, `reinstate-agent`

Compression rules:

- keep aggregate counters per agent type and prompt pattern
- keep at most 20 entries in `recentRuns`
- compress when adding a new entry would exceed the limit
- roll repeated issues into `repoLearnings`
- keep `repoLearnings` limited to durable rules, not anecdotal run history
- delete stale detail that no longer changes delegation decisions

## Decommissioning policy

Decommissioning is progressive.

Rules:

- adjust prompt patterns before restricting agent types unless evidence clearly points to agent unsuitability
- first decommission the prompt pattern when repeated failures point to communication or framing problems
- decommission an agent type only after alternate prompt patterns fail to recover quality
- an agent type may be reinstated when evidence shows the prompt pattern or task shape caused the earlier failure
- document the evidence behind every restriction, decommission, or reinstatement

## Learning storage

Use split scope for recurring learnings:

- repo-specific learnings remain in `.agents/evaluations/management.json`
- cross-repository learnings go to `~/.agents/learnings/sub-agent-management.md`

Keep both compressed.

Rules:

- keep only durable, reusable rules
- merge duplicates aggressively
- convert repeated failures into one stronger rule instead of appending more examples
- keep cross-repository learnings compressed and deduplicated
- do not store anecdotal run history in cross-repository learnings

## Code-writing preflight

Before a code-writing worker edits code:

1. inspect the relevant repository rules, standards skills, validation configuration, and validation scripts
2. resolve the minimal validation command set
3. include that plan in the worker prompt

Do not run a full repo preflight by default. Expand scope only when shared configs, shared contracts, or cross-cutting changes require it.