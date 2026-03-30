# Approval flow

Approval exists to protect materially shaped or risky work, not to add friction to everything.

## Require approval when

* the work is implementation-heavy
* clarification materially changed the execution path
* the work is destructive, irreversible, expensive, or externally visible
* the user has already shown friction from prior mismatch or rework

## Skip approval when

* the task is small and low risk
* ambiguity has been fully resolved
* the remaining assumptions are minor and clearly stated
* an approval ceremony would add friction without meaningfully reducing risk

## Confirmation format

When approval is required, present a compact confirmation using [assets/TEMPLATE_PLAN_CONFIRMATION.md](../assets/TEMPLATE_PLAN_CONFIRMATION.md).

The response choices are:

* **Approve**: proceed with the current plan
* **Clarify**: apply requested changes if provided, or reopen only the unresolved parts if not
* **Explain**: give more detail about the current plan without reopening the flow unless a real blocker appears

## Contradictions

If a new user reply conflicts with a prior approved plan:

* prefer the latest user instruction
* ask one blocker-only contradiction question if the conflict is material, destructive, or would otherwise force reckless guessing
* do not reopen a full clarification cycle unless strictly necessary
