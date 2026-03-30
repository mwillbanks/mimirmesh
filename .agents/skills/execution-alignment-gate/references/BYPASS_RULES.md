# Bypass rules

This skill must not activate merely because a reply is short.

## Bypass when the message is clearly anchored to active context

Bypass for:

* terse approvals or confirmations tied to the current plan or option set
* narrow corrective follow-ups whose target is obvious from active context
* continuation of an already approved plan
* safe best-effort defaults that can be stated explicitly without likely harming outcome quality
* responses that clearly select from options the agent already provided

Examples of continuation signals include replies such as:

* fix it
* do it
* go ahead
* approved
* yes
* that works
* use option 2
* apply the change

These are examples, not a hardcoded finite list. Determine intent from current context.

## Safe-default bypass

Bypass this skill and proceed when:

* the ambiguity is minor
* the risk is low
* the choice is reversible or cheap
* the assumption can be stated briefly
* clarification would likely cost more tokens than the assumption would save

## No-crutch rule

Do not activate this skill when the real issue is:

* the specification already defines the outcome
* the approved plan already defines the path
* repository rules already define the implementation pattern
* current task scope already resolves the ambiguity
* a prior user correction already answered the question

In those cases, execute correctly. Do not seek unnecessary clarification.
