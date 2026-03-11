# CLI Machine-Readable Contract: Interactive CLI Experience

## 1. Explicit Opt-In Only

Machine-readable output is available only when a supported direct command explicitly requests it.

Human-readable output remains the default for normal CLI use.

## 2. Semantic Parity

Machine-readable responses must preserve the same semantics as the human-readable workflow:

- workflow identifier
- ordered steps or equivalent step summaries
- terminal outcome class: `success`, `degraded`, or `failed`
- warnings and degraded evidence
- recommended next action

Machine-readable output must not expose incidental internal-only structures as the contract.

## 3. Non-Interactive Policy

Inspection and status workflows must remain non-interactive by default and must be safely automatable without extra flags.

Mutating workflows must require explicit non-interactive invocation to suppress prompts. When invoked that way, they must still preserve:

- validation behavior
- terminal outcome classification
- degraded-state reporting
- next-action guidance in machine-readable form

## 4. Command Families Covered

The machine-readable contract applies to eligible direct commands under:

- setup and init
- runtime lifecycle and upgrade
- MCP inspection and tool invocation
- repair and doctor flows
- install-ide and similar guided setup operations when non-interactive mode is requested
