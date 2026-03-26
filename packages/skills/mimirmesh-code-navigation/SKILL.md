---
name: mimirmesh-code-navigation
description: Navigate a MímirMesh codebase with low-token routed tools. Use when you need to locate symbols, implementations, exact code patterns, dependency impact, tests, or a quick repository overview.
metadata:
  bundle: core
  owner: mimirmesh
  role: navigation
---

# Mimirmesh Code Navigation

Use this skill for fast, precise code discovery. Bias toward scoped retrieval and stop when the answer is localized.

## Primary tool choices

- Use `find_symbol` when the user already knows the symbol, type, method, interface, command, or identifier name.
- Use `search_code` when the user has an exact string, code pattern, error text, import shape, or implementation motif but not a stable symbol name.
- Use `trace_dependency` when the user asks for callers, callees, dependents, impact radius, or "what uses this?"
- Use `find_tests` when the user needs existing test coverage for a symbol or behavior.
- Use `explain_project` when the question is broad repo orientation rather than a localized lookup.

## Query shaping

- Prefer a concrete symbol name over a natural-language paraphrase.
- Pass `path` whenever the likely package or subsystem is known.
- Use `limit` to keep the first result set small and precise.
- Use `search_code.kind` only when the user clearly wants a symbol class such as `function`, `class`, `method`, or `interface`.

## Stop vs escalate

- Stop once you have the file, symbol, or test locations needed to answer the question.
- Escalate to `trace_dependency` only when simple lookup does not answer ownership or impact.
- Escalate to `mimirmesh-code-investigation` when the question is really about a bug, regression, or failure mode.
- Escalate to `mimirmesh-architecture-delivery` when the question becomes about design intent, subsystem boundaries, or ADR-worthy changes.
- Escalate to `mimirmesh-integration-analysis` when the lookup crosses deployment or external-system boundaries.

## Guardrails

- Do not start with `evaluate_codebase` for code navigation.
- Do not use passthrough search tools first unless the routed surface cannot express the needed lookup.
- Published passthrough tools may be deferred per session; prefer unified routed tools first and only rely on deferred engine tools when the routed surface cannot answer the question.
- Do not keep broadening the search after you have already localized the answer.

## Output expectation

- Return the located symbols, files, or tests.
- Call out the narrowest next lookup if another precise question remains.
- Separate direct retrieval from inference.
