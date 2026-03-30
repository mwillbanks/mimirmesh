# Question patterns

## Core rules

* Ask the fewest questions needed.
* Prefer 1 to 3.
* Maximum 5 in a clarification round.
* Each question must materially affect execution.
* Order questions by execution impact.
* Use up to 4 options plus freeform only when options help reduce ambiguity faster than open text.
* Keep questions concise.
* Do not restate large context blobs.

## Good question shape

Each question should identify:

* the decision point
* why it matters to execution
* concise options when useful
* an `Other` path when the option set may not cover the user's intent

## Option rules

Options must be:

* distinct
* outcome-relevant
* compact
* non-overlapping where possible

Do not invent fake certainty. If the agent does not understand the likely decision space well enough to form useful options, ask a short freeform question instead.

## After the bounded round

After answers arrive:

* synthesize a concrete execution plan
* state only material remaining assumptions
* do not reopen a broad clarification loop

One blocker-only follow-up is allowed only when the alternative would be reckless guessing.

## Clarify vs Explain

If the user chooses **Clarify**:

* apply their requested changes if they provided them
* otherwise reopen only the unresolved decision points
* do not restart the entire clarification flow

If the user chooses **Explain**:

* provide more detail about the current plan
* do not reopen the question set unless the explanation exposes a real blocker

## Anti-patterns

Do not:

* fish for preferences that do not matter
* ask the user to restate the task
* repeat questions already answered by context
* ask questions that only satisfy curiosity
* turn one missing decision into a large option tree
