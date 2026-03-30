# Target modes

This skill supports exactly three target modes.

## user

Use `user` mode when the missing information is about:

* desired outcome
* constraints
* preferences
* deliverable format
* acceptance expectations
* tradeoff selection the user must own

Behavior:

* ask bounded, high-leverage questions
* keep tone calm, concise, and non-defensive
* prefer choices plus freeform when choices meaningfully reduce ambiguity
* apply approval flow only when clarification materially shaped the work

## manager

Use `manager` mode when a sub-agent lacks:

* scope boundaries
* acceptance criteria
* validation requirements
* conflict resolution
* explicit task ownership
* instruction needed to avoid guessing

Behavior:

* do not ask open-ended questions upward
* return a compact manager packet using [assets/TEMPLATE_MANAGER_PACKET.md](../assets/TEMPLATE_MANAGER_PACKET.md)
* keep the packet operational, not conversational
* request only the smallest decision needed to unblock safe execution

## unattended

Use `unattended` mode when user clarification would be appropriate but no user response is available within the allowed wait window.

Behavior:

* treat non-response as clarification declined
* lock only material assumptions
* proceed only if safe
* avoid destructive or irreversible choices unless already authorized
* state that unattended fallback semantics were used
* do not create repeated wait cycles

## Routing rule

Select the narrowest correct target mode first.

* If the missing decision belongs to the user, use `user`.
* If the missing decision belongs to the managing agent, use `manager`.
* If the decision belongs to the user but the user is unavailable, use `unattended`.

Do not ask the user questions that should be answered by the manager.
Do not ask the manager questions that should be answered from the spec, plan, repo rules, or current task scope.
