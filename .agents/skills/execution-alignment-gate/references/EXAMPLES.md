# Examples

## Activate: materially branching implementation choice

User asks for a refactor but does not specify whether behavior must remain bit-for-bit identical or whether interface cleanup is allowed.

Use the skill because the answer changes implementation path, validation, and risk.

## Bypass: anchored terse continuation

The agent presents a plan with options. The user replies: `use option 2`.

Bypass this skill and proceed. The reply is clearly anchored to active context.

## Bypass: safe default

The user asks for a markdown document and does not specify filename. The repo uses `README.md` as the obvious default.

Bypass this skill, state the filename assumption briefly, and continue.

## Manager mode

A sub-agent was assigned implementation but received no validation commands and no acceptance criteria for a risky schema change.

Do not ask the user. Return the compact manager packet and wait for manager direction.

## Unattended mode

The environment supports synchronous waiting. The agent asks one user clarification question. No answer arrives within 30 seconds.

Switch to unattended fallback, lock material assumptions, avoid destructive choices, and proceed only if safe.

## Contradiction handling

A user previously approved a plan to update only documentation. Later they say `also change the API behavior`.

Prefer the latest user instruction, but ask one blocker-only contradiction check if the new change materially alters risk or scope.

## Explain

The user selects `Explain`.

Provide more detail about the current plan, deliverables, assumptions, and validation without reopening the full question set.

## Clarify

The user selects `Clarify` and supplies a new constraint.

Apply the requested change and reopen only the unresolved decision points affected by that change.
