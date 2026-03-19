---
name: mimirmesh-code-investigation
description: Investigate bugs, regressions, failures, and suspicious behavior in a MímirMesh repository. Use when you need routed evidence collection, scoped dependency tracing, and disciplined escalation to history or systemic analysis.
metadata:
  bundle: core
  owner: mimirmesh
  role: investigation
---

# Mimirmesh Code Investigation

Use this skill for debugging and RCA. Start broad enough to localize the issue, then narrow quickly.

## Default flow

1. Start with `investigate_issue` using the symptom, failure text, regression description, or reproduction context.
2. Use `path` if you already know the likely package or subsystem.
3. After localization, use `find_symbol` to inspect the concrete symbol or file the routed evidence identified.
4. Use `trace_dependency` to measure blast radius, callers, callees, or dependents only after the suspect area is known.
5. Use `evaluate_codebase` only if the evidence suggests the issue reflects a broader architectural or maintainability problem.

## Localized vs systemic defect test

- Treat the issue as localized when the evidence points to one file, one symbol family, or a narrow change window.
- Treat the issue as systemic when multiple subsystems show the same failure pattern, when architecture boundaries are involved, or when the routed evidence surfaces repeated hotspots and coupling problems.
- Stay localized until the evidence forces a broader conclusion.

## History passthrough guardrails

- Use `mimirmesh.srclight.blame_symbol` only after you know the exact symbol whose ownership or last-change evidence matters.
- Use `mimirmesh.srclight.changes_to`, `mimirmesh.srclight.recent_changes`, or `mimirmesh.srclight.whats_changed` only when the routed investigation shows that timeline evidence is necessary.
- Do not start with history tools when the current code location has not been localized yet.

## Escalation

- Escalate to `mimirmesh-architecture-delivery` when the root cause is an architectural assumption, contract mismatch, or decision drift.
- Escalate to `mimirmesh-integration-analysis` when the failure crosses deployment, service-boundary, CI/CD, or external-system concerns.
- Escalate to `find_tests` after localization when existing coverage will help prove or reproduce the defect.

## Guardrails

- Do not start with repo-wide architecture analysis.
- Do not label an issue systemic without concrete evidence from routed results.
- Do not generate ADRs or documentation as a substitute for proving root cause.

## Output expectation

- Separate evidence from inference.
- State whether the defect currently looks localized or systemic.
- State the next narrowest confirmation step, including whether history evidence is still required.
