# Research: Srclight Full Capability Enablement

## Decision 1: Global GPU policy model is `gpuMode: auto|on|off` (default `auto`)

- Decision: Add a global MimirMesh runtime setting `gpuMode` with values `auto`, `on`, and `off`, defaulting to `auto`.
- Rationale: A global policy allows all GPU-capable engines to share one control plane. `auto` prevents startup failures on non-GPU hosts while enabling GPU where available.
- Alternatives considered:
  - Engine-local `gpuEnabled` booleans: rejected because policy fragmentation across adapters creates inconsistent behavior.
  - `gpuEnabled: true` default: rejected because ARM64 and non-NVIDIA hosts fail by default.

## Decision 2: Resolve GPU policy once in runtime orchestration

- Decision: Implement a single runtime-level GPU resolver that determines per-engine effective GPU decisions before adapter translation and compose rendering.
- Rationale: Centralized resolution avoids duplicate detection logic and drift between compose generation, adapter env, and runtime diagnostics.
- Alternatives considered:
  - Adapter-level resolution: rejected due to duplicated hardware checks and inconsistent diagnostics.
  - Renderer-only resolution: rejected because adapters and bootstrap paths also need resolved policy signals.

## Decision 3: Use dual runtime images for Srclight (CPU and CUDA) selected by resolved policy

- Decision: Maintain a CUDA-capable Srclight image and a CPU-compatible Srclight image, selected by resolved `gpuMode` outcome.
- Rationale: CUDA image support is linux/amd64-focused; explicit CPU image path is required for ARM64 and non-GPU environments.
- Alternatives considered:
  - Single CUDA image for all hosts: rejected due to predictable failures on unsupported hosts.
  - Single CPU image with optional GPU mount: rejected because cupy acceleration requires CUDA runtime libraries in image.

## Decision 4: Keep routing discovery-backed and extend unified coverage to all 29 tools

- Decision: Add unified routing rules and input shaping for missing Srclight tools while preserving live-discovery matching.
- Rationale: This closes capability gaps without introducing static tool catalogs or synthetic behavior.
- Alternatives considered:
  - Expose missing tools as passthrough only: rejected because unified layer remains incomplete for agent workflows.
  - Hard-code full tool list: rejected by constitution live-discovery principle.

## Decision 5: Platform inspection dispatch is input-driven

- Decision: `inspect_platform_code` routes to `get_platform_variants` when symbol input is present and to `platform_conditionals` when input is absent.
- Rationale: Matches Srclight tool contracts and preserves predictable behavior for both scoped and global platform analysis.
- Alternatives considered:
  - Always call one tool only: rejected because it drops either scoped or global behavior.
  - Call both tools every time: rejected due to unnecessary runtime cost and noisy merged output.

## Decision 6: Embedding activation uses effective model precedence

- Decision: Effective embedding model resolution is `embedModel ?? defaultEmbedModel`; embedding is active when effective model and `ollamaBaseUrl` are both non-null.
- Rationale: Reduces setup friction while keeping explicit override semantics.
- Alternatives considered:
  - Suggestion-only default model: rejected based on clarification decision.
  - Require explicit model always: rejected as unnecessary operator friction.

## Decision 7: No legacy fallback mapping from `gpuEnabled`

- Decision: Do not implement compatibility mapping from legacy `srclight.settings.gpuEnabled`.
- Rationale: Clarified scope states the setting was not shipped and no fallback is required.
- Alternatives considered:
  - Migration mapping (`true -> on`, `false -> off`): rejected as unnecessary complexity for unshipped behavior.

## Decision 8: Ollama default and host bridge behavior

- Decision: Default Ollama base URL is `http://host.docker.internal:11434`; Srclight compose service includes `extra_hosts: host.docker.internal:host-gateway`.
- Rationale: Aligns with existing document-mcp pattern and removes operator guesswork.
- Alternatives considered:
  - Keep URL null by default: rejected because it forces manual configuration for common local Ollama setups.

## Decision 9: Diagnostics model for GPU failures

- Decision: In `gpuMode: on`, fail fast with explicit GPU requirement diagnostics when NVIDIA runtime is unavailable. In `auto`, select CPU and continue healthy.
- Rationale: Distinguishes policy-enforced failures from capability fallback behavior.
- Alternatives considered:
  - Silent fallback in `on`: rejected because it violates explicit policy intent.
