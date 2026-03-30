# Contract: MCP Route Hint Inspection

## Purpose

Define the repository-native MCP inspection surface for route hints and recent telemetry summaries.

## Tool

- `inspect_route_hints`

This is a MimirMesh-owned management tool. It does not proxy to an engine.

## Request

```ts
type InspectRouteHintsRequest = {
  unifiedTool?:
    | "explain_project"
    | "explain_subsystem"
    | "find_symbol"
    | "find_tests"
    | "inspect_type_hierarchy"
    | "inspect_platform_code"
    | "list_workspace_projects"
    | "refresh_index"
    | "search_code"
    | "search_docs"
    | "trace_dependency"
    | "trace_integration"
    | "investigate_issue"
    | "evaluate_codebase"
    | "generate_adr"
    | "document_feature"
    | "document_architecture"
    | "document_runbook";
  engine?: "srclight" | "document-mcp" | "mcp-adr-analysis-server";
  engineTool?: string;
  profile?: string;
  includeRollups?: boolean;
  limitBuckets?: number;
};
```

### Request Rules

- Omitting `unifiedTool` returns the effective adaptive subset and high-level telemetry health summary.
- Providing `engineTool` requires `engine`.
- Omitting `profile` for a selected `unifiedTool` returns a summary inspection across recorded profile keys for that tool and does not derive a profile from absent invocation input.
- Providing `profile` selects one explicit `profileKey` for deterministic profile-scoped inspection.
- `limitBuckets` defaults to 8 and caps recent bucket summaries per rollup tier.

## Response

```ts
type InspectRouteHintsResponse = {
  telemetryHealth: {
    state: "ready" | "degraded" | "behind" | "unavailable";
    lastSuccessfulCompactionAt: string | null;
    lagSeconds: number;
    warnings: string[];
  };
  maintenanceStatus: {
    status: "idle" | "running" | "degraded" | "failed";
    lastStartedAt: string | null;
    lastCompletedAt: string | null;
    lastSuccessfulAt: string | null;
    lastCompactedThrough: string | null;
    compactionProgress: {
      closedBucketCount: number;
      remainingBucketCount: number;
      lastProcessedBucketEnd: string | null;
    };
    rawRetentionDays: number;
    rollupRetention: {
      last15mHours: number;
      last6hDays: number;
      last1dDays: number;
    };
    overdueBySeconds: number;
    affectedSourceLabels: Array<"seed-only" | "sparse" | "mixed" | "adaptive" | "stale">;
  };
  adaptiveSubset: {
    defaultAllowlist: string[];
    effectiveAllowlist: string[];
    overrideWarnings: string[];
  };
  inspection?:
    | {
        unifiedTool: string;
        profileScope: "summary";
        profiles: Array<{
          profileKey: string;
          subsetEligible: boolean;
          executionStrategy: "prefer-first" | "fanout" | "fallback-only";
          sourceMode: "static" | "insufficient-data" | "mixed" | "adaptive" | "stale";
          sourceLabel: "seed-only" | "sparse" | "mixed" | "adaptive" | "stale";
          freshnessState: "current" | "aging" | "stale" | "unknown";
          freshnessAgeSeconds: number | null;
          confidence: number;
          sampleCount: number;
          currentOrdering: Array<{
            engine: string;
            engineTool: string;
            effectiveCostScore: number;
            confidence: number;
            sampleCount: number;
            orderingReasonCodes: string[];
            estimatedInputTokens: number;
            estimatedOutputTokens: number;
            estimatedLatencyMs: number;
            estimatedSuccessRate: number;
            lastObservedAt: string | null;
          }>;
        }>;
      }
    | {
    unifiedTool: string;
    profileScope: "profile";
    profileKey: string;
    subsetEligible: boolean;
    executionStrategy: "prefer-first" | "fanout" | "fallback-only";
    sourceMode: "static" | "insufficient-data" | "mixed" | "adaptive" | "stale";
    sourceLabel: "seed-only" | "sparse" | "mixed" | "adaptive" | "stale";
    freshnessState: "current" | "aging" | "stale" | "unknown";
    freshnessAgeSeconds: number | null;
    currentOrdering: Array<{
      engine: string;
      engineTool: string;
      effectiveCostScore: number;
      confidence: number;
      sampleCount: number;
      orderingReasonCodes: string[];
      estimatedInputTokens: number;
      estimatedOutputTokens: number;
      estimatedLatencyMs: number;
      estimatedSuccessRate: number;
      lastObservedAt: string | null;
    }>;
    recentRollups?: {
      last15m: unknown[];
      last6h: unknown[];
      last1d: unknown[];
    };
  };
};
```

## Failure Behavior

- If runtime PostgreSQL is unavailable, return a degraded result with explicit corrective guidance.
- If the tool or route is not in the effective adaptive subset, return its `static` source mode, `seed-only` source label, and `subsetEligible: false` rather than an error.
- If telemetry exists but maintenance is behind, return inspection data with telemetry health warnings.
- Summary inspection responses MUST list the recorded `profileKey` values instead of inventing an `auto` profile.

## Notes

- Estimates are routing heuristics, not billing truth.
- No raw request arguments or result content may appear in response payloads.
- `sourceMode` is the canonical machine-readable hint taxonomy. `sourceLabel` is the operator-facing display alias for the same state.