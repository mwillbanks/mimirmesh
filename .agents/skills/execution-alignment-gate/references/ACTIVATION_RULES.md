# Activation rules

Activate this skill only when ambiguity is material enough that proceeding without alignment is likely to cause:

* wrong deliverable
* wrong scope
* wrong implementation path
* wrong validation target
* avoidable rework
* materially increased token usage from likely follow-up and correction

## Silent assessment before questions

Before asking anything, the agent must:

1. infer the most likely intended outcome
2. identify only the missing decisions that materially affect execution
3. eliminate questions already answerable from context, repository state, tools, prior approvals, or accepted plans
4. reduce the decision set to the minimum needed to proceed efficiently

## Do activate when

* multiple materially different execution paths remain open
* missing information would change architecture, deliverables, risk, validation, or cost
* the request depends on assumptions the agent cannot responsibly infer
* the expected clarification cost is lower than likely rework and follow-up cost
* the current prompt does not support reliable validation of the intended result

## Do not activate when

* ambiguity is minor and does not materially affect delivery
* the answer is already available in context
* a safe default can be chosen and stated briefly
* the user is clearly replying to an active plan, option set, or correction thread
* the real problem is agent noncompliance with the spec, approved plan, repo rules, or execution mode

## Posture

Default posture is conservative.

### Conservative
Trigger only for material ambiguity with meaningful outcome risk or token waste risk.

### Moderate
Allowed only by explicit invocation or higher-priority instruction. Trigger for meaningful ambiguity that is likely to affect delivery quality even if rework risk is moderate.

### Aggressive
Allowed only by explicit invocation or higher-priority instruction. Trigger more readily when the operator explicitly wants earlier alignment checks.

Do not self-escalate posture without instruction.
