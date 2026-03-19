# Biome Reference Guide

This document provides operational guidance for AI agents working with **Biome** in this repository.

The associated skill (`biome-enforcement`) defines **when and why** Biome must be consulted.  
This document explains **how** Biome should be used, how the agent should interpret its output, and how to keep final enforcement semantics intact.

Biome is still used as a **final formatting and linting enforcement step** before task completion, but this reference also covers config-awareness and diagnostic handling that may happen before the final run.

---

## Core Principle

Biome is **not part of the continuous implementation loop**.

The required final invocation is run:

- after implementation
- after repository-native validation has already run
- before final validation completion

It serves as a **final formatting and lint enforcement pass**.

Agents may still consult this reference earlier when:

- diagnosing Biome failures
- changing Biome config or ignore files
- deciding whether generated output should be excluded
- planning how to remediate Biome diagnostics efficiently

---

## Required Command

Agents must run the following command during final validation:

```bash
biome check --write --unsafe --changed --no-errors-on-unmatched --files-ignore-unknown=true --reporter=json
```

Do not modify this command unless the user explicitly instructs otherwise.

---

## Command Breakdown

## `--write`

Automatically applies safe and known formatting fixes.

This should always be enabled to reduce manual remediation work.

---

## `--unsafe`

Allows Biome to apply fixes that may slightly restructure code.

These fixes are normally safe but should still be validated by running build and tests afterward.

---

## `--changed`

Limits checks to files modified during the task.

This significantly improves performance and reduces noise.

Agents should not run full-repository checks unless explicitly required.

---

## `--no-errors-on-unmatched`

Prevents failures when the file set does not match Biome configuration expectations.

This prevents unnecessary failures when agents create new file types.

---

## `--files-ignore-unknown=true`

Prevents errors when files outside Biome's known language scope appear in the changed set.

Examples include:

* images
* generated JSON
* snapshots
* artifacts

---

## `--reporter=json`

Always required.

The JSON reporter is used because:

* it produces compact output
* it reduces token consumption
* it allows agents to parse structured results
* it avoids noisy console formatting

Agents should **never rely on human-oriented reporter formats**.

---

## Interpreting JSON Output

Biome JSON output should be treated as structured diagnostic data.

Agents must:

1. Parse the output
2. Extract errors and warnings
3. Convert them into a remediation task list
4. Resolve the issues
5. run Biome again

Continue until no errors remain.

---

## Standard Remediation Loop

Agents must use this loop when Biome reports issues.

### Step 1

Run Biome:

```bash
biome check --write --unsafe --changed --no-errors-on-unmatched --files-ignore-unknown=true --reporter=json
```

### Step 2

Parse JSON output.

Identify:

- formatting errors
- lint violations
- parser or configuration failures
- files affected
- remaining diagnostics

### Step 3

Create a remediation task list.

### Step 4

Fix issues at the right layer:

- fix source when the problem is real code
- fix config when Biome is misconfigured
- update ignore rules when the path is generated output that should not be Biome-managed
- avoid suppressing real source issues with ignore rules

### Step 5

Run Biome again.

Repeat until Biome reports **zero errors**.

---

## Final Validation Flow

The correct validation sequence is:

1. Implementation complete
2. Run repository-native pre-Biome validation such as build, typecheck, and tests
3. Run Biome remediation loop
4. If Biome changed files, re-run the same build and test validation
5. Declare task complete

---

## Configuration and Scope Awareness

If the task changes any of the following, the agent should treat the task as Biome-sensitive even before the final pass:

- `biome.json`
- workspace-level tool configuration that affects changed-file resolution
- package scripts that invoke Biome
- ignore files or ignore sections used by Biome
- repository structure changes that create new generated-output paths

The required final command still stays the same. Extra diagnosis or config review does not replace it.

If the user explicitly asks for a full-repository Biome run or a config migration:

- an additional broader Biome command may be used for diagnosis if necessary
- the required changed-files JSON command must still remain part of the final completion flow unless the user explicitly replaces that requirement

If the required `--changed` command fails because Biome cannot determine a comparison base:

- prefer fixing `vcs.defaultBranch` in `biome.json` when the repository has a stable default branch
- use `--since` only when the user or repository workflow explicitly requires that override
- do not silently swap out the required final command and pretend the failure did not happen

If the required `--changed` command succeeds but reports zero matched files unexpectedly:

- inspect the JSON summary before treating the run as meaningful validation
- confirm whether Biome actually examined the intended file set
- use an additional targeted diagnostic run when needed, but keep the required changed-files command in the final flow

---

## Generated Files and Ignore Management

Biome will sometimes detect files that should **not be linted or formatted**.

Agents must recognize these situations and update ignore configuration when appropriate.

Common generated content includes:

- Playwright test results
- coverage output
- snapshot images
- test videos
- screenshots
- traces
- logs
- generated reports
- build artifacts
- tool-generated output directories

Example paths that often require ignore rules:

```
playwright-report/
test-results/
coverage/
dist/
build/
reports/
.snapshots/
```

Agents should determine whether a path:

- represents generated content
- is produced by a test framework
- is machine-generated
- should not be modified by Biome

If so, it should be added to the appropriate ignore configuration.

---

## When NOT to Add Ignore Paths

Agents must **not add ignore rules** for:

- legitimate application source files
- directories that contain maintained code
- formatting errors in real source files
- files that should conform to repository style rules

Ignore rules are only appropriate for:

- machine-generated output
- tool artifacts
- temporary execution results

---

## Diagnostic Triage Guidance

When Biome reports issues, group them into one of these classes before acting:

- source formatting or lint issues: fix the affected code and rerun
- parser failures: fix the broken syntax or unsupported construct in the source
- configuration failures: correct the Biome config or invocation context
- generated-file noise: update ignore handling if the files should not be Biome-managed

Do not treat every Biome problem as a source edit problem. Do not treat every source problem as an ignore-rule problem.

---

## Common Agent Mistakes

Agents frequently misuse Biome in the following ways.

## Running Biome During Editing

Incorrect:

running Biome repeatedly while modifying files.

This increases noise and slows down agent workflows.

Correct:

run Biome **once implementation is finished**.

---

## Formatting Files Individually

Incorrect:

formatting files one at a time.

Correct:

run Biome across the **changed file set**.

---

## Ignoring JSON Reporter

Incorrect:

using default or human-oriented output and then paraphrasing diagnostics.

Correct:

always use `--reporter=json` so remediation is based on structured data.

---

## Replacing the Final Command With a Different Workflow

Incorrect:

running a custom Biome command and treating that as sufficient final enforcement.

Correct:

keep the required changed-files JSON command in the final flow, even if extra diagnosis was needed earlier.

---

## Hiding Real Issues Behind Ignore Rules

Incorrect:

adding ignore paths for maintained code just to make Biome pass.

Correct:

reserve ignore changes for generated or machine-produced output only.

Incorrect:

using default console reporters.

Correct:

always use:

```
--reporter=json
```

---

## Skipping Validation After Biome Fixes

Biome may modify code.

Agents must always re-run:

```
bun run build
bun run test
```

after the Biome remediation loop.

---

# Performance Expectations

Biome runs should be:

* fast
* limited to changed files
* executed only during final validation

Agents should avoid unnecessary Biome executions.

---

# Agent Operational Contract

When working in this repository, agents must assume:

* Biome is mandatory for final validation
* JSON reporter is required
* the remediation loop must be followed
* generated artifacts may require ignore updates
* build and tests must pass after Biome fixes
* tasks are not complete until Biome validation succeeds

---

# Summary

Biome exists to enforce repository formatting and linting standards.

It should be treated as:

* a **final enforcement step**
* an **automatic cleanup mechanism**
* a **structured diagnostic system**

Agents must run the Biome remediation loop and confirm that the repository remains buildable and testable after formatting corrections.
