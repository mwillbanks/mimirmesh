# Token economics

This skill is an efficiency control, not a certainty ritual.

## Core principle

Clarification is justified only when its cost is lower than the expected cost of:

* wrong-path execution
* likely rework
* repeated follow-up
* avoidable token waste from correcting the wrong result

## Rules

* Aim for minimum sufficient alignment, not maximum certainty.
* Prefer concise, high-leverage questions.
* Do not repeat large context blocks in questions.
* Do not ask questions that save little but cost a lot.
* Prefer safe defaults when risk is low and assumptions can be stated briefly.
* Do not spend more tokens tracking the clarification process than the clarification saves.

## Retention and compaction

If an implementation tracks conceptual counters or learnings, keep them compact and bounded:

* keep rolling aggregate counts only
* keep only compressed durable rules
* deduplicate recurring patterns
* drop stale or anecdotal detail
* retain no verbose per-run narrative artifacts in the shipped skill

Only durable learnings that improve future activation, bypass, routing, or question quality should survive compression.
