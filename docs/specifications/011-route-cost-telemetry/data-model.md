# Data Model: Route-Level Cost Hints with Runtime Telemetry and Adaptive Rollups

## 1. Route Execution Event

Represents one attempted route execution for a unified tool.

### Fields

| Field | Type | Notes |
|------|------|------|
| `eventId` | UUIDv7 string | Primary key, ordered by creation time |
| `repoId` | string | Repository-scoped identity derived from project root |
| `occurredAt` | timestamp | Attempt timestamp |
| `sessionId` | string nullable | MCP session id or CLI session id when available |
| `requestCorrelationId` | string nullable | Request-level correlation id when available |
| `unifiedTool` | enum | Built-in unified tool name |
| `profileKey` | string | Stable hash of the sanitized request summary |
| `sanitizedArgumentSummary` | JSON object | Privacy-bounded request-shape summary |
| `requestFingerprint` | string nullable | Non-reversible signature derived from the sanitized summary and tool identity |
| `engine` | enum | Engine id |
| `engineTool` | string | Concrete engine tool invoked |
| `executionStrategy` | enum | `prefer-first`, `fanout`, or `fallback-only` |
| `staticPriority` | integer | Existing route priority at execution time |
| `attemptIndex` | integer | Position in the ordered attempt sequence |
| `outcome` | enum | `success`, `degraded`, `failed`, `skipped` |
| `failureClassification` | string nullable | Normalized failure class when known |
| `latencyMs` | integer | Route latency |
| `estimatedInputTokens` | integer | Deterministic estimate |
| `estimatedOutputTokens` | integer | Deterministic estimate |
| `inputBytes` | integer | Serialized input size |
| `outputBytes` | integer | Serialized output size |
| `resultItemCount` | integer | Result item count after normalization/filtering |
| `hintSourceModeAtExecution` | enum | Snapshot source mode used at selection time |
| `hintConfidenceAtExecution` | decimal | Confidence used at selection time |
| `effectiveCostScoreAtExecution` | decimal | Selected score used for ordering |
| `orderingReasonCodes` | string array | Reason codes attached to the ordering decision |
| `createdAt` | timestamp | Storage timestamp |

### Validation Rules

- No raw request arguments or raw result content are persisted.
- `sanitizedArgumentSummary` must be JSON-serializable and match the route-summary schema version in code.
- `attemptIndex` is 1-based within a request/tool execution.
- `requestFingerprint`, if present, must be derived only from sanitized fields.

## 2. Sanitized Argument Summary

Represents the privacy-bounded request shape used for grouping and inspection.

### Fields

| Field | Type | Notes |
|------|------|------|
| `shapeVersion` | integer | Version for future-compatible summary evolution |
| `queryClass` | enum | `empty`, `identifier`, `free-text`, `path-only`, `mixed` |
| `hasPath` | boolean | Whether a repository path was present |
| `limitBand` | enum | `default`, `small`, `medium`, `large` |
| `promptLengthBand` | enum | `short`, `medium`, `long` |
| `identifierLike` | boolean | Whether the input resembles a symbol identifier |
| `additionalFlags` | object | Tool-specific booleans allowed only from the approved summarizer |

### Relationship

- One `SanitizedArgumentSummary` produces one `profileKey`.
- Many events and snapshots can share the same `profileKey`.

## 3. Route Rollup Buckets

Three bounded aggregation tables exist with identical logical columns and different retention windows:

- `route_rollup_15m` retained for 48 hours
- `route_rollup_6h` retained for 14 days
- `route_rollup_1d` retained for 90 days

### Key

Composite primary key:

`(repoId, unifiedTool, profileKey, engine, engineTool, bucketStart)`

### Fields

| Field | Type | Notes |
|------|------|------|
| `repoId` | string | Repository identity |
| `unifiedTool` | enum | Unified tool |
| `profileKey` | string | Sanitized request profile grouping |
| `engine` | enum | Engine id |
| `engineTool` | string | Concrete engine tool |
| `executionStrategy` | enum | Strategy in effect for this route |
| `bucketStart` | timestamp | Inclusive bucket boundary |
| `attemptCount` | integer | Count of attempts |
| `successCount` | integer | Count of successful attempts |
| `degradedCount` | integer | Count of degraded attempts |
| `failedCount` | integer | Count of failed attempts |
| `avgLatencyMs` | decimal | Mean latency |
| `p95LatencyMs` | decimal | Tail latency estimate |
| `avgEstimatedInputTokens` | decimal | Mean estimated input tokens |
| `avgEstimatedOutputTokens` | decimal | Mean estimated output tokens |
| `avgInputBytes` | decimal | Mean input bytes |
| `avgOutputBytes` | decimal | Mean output bytes |
| `avgResultItemCount` | decimal | Mean result items |
| `lastObservedAt` | timestamp | Latest event in bucket |
| `orderingReasonCounts` | JSON object | Reason-code frequencies for inspection |

### Pruning Rules

- `route_rollup_15m` rows older than 48 hours are pruned after superseding `6h` rollups exist.
- `route_rollup_6h` rows older than 14 days are pruned after superseding `1d` rollups exist.
- `route_rollup_1d` rows older than 90 days are pruned.

## 4. Adaptive Route Hint Snapshot

Represents the current route estimate used by the router and inspection surfaces.

### Key

Composite primary key:

`(repoId, unifiedTool, profileKey, engine, engineTool)`

Inspection uses these keys deterministically: profile-scoped inspection requires an explicit `profileKey`, while omitted-profile inspection returns a summary across recorded profile keys instead of deriving a new one from absent invocation input.

### Fields

| Field | Type | Notes |
|------|------|------|
| `repoId` | string | Repository identity |
| `unifiedTool` | enum | Unified tool |
| `profileKey` | string | Sanitized request profile |
| `engine` | enum | Engine id |
| `engineTool` | string | Concrete engine tool |
| `executionStrategy` | enum | Current route strategy |
| `subsetEligible` | boolean | Whether active adaptive ordering may affect this route |
| `sourceMode` | enum | `static`, `insufficient-data`, `mixed`, `adaptive`, `stale` |
| `sourceLabel` | enum | `seed-only`, `sparse`, `mixed`, `adaptive`, `stale` |
| `sampleCount` | integer | Total contributing attempts |
| `confidence` | decimal | 0-1 confidence score |
| `freshnessState` | enum | `current`, `aging`, `stale`, `unknown` |
| `freshnessAgeSeconds` | integer nullable | Seconds since `lastObservedAt` when known |
| `estimatedInputTokens` | decimal | Current input-token estimate |
| `estimatedOutputTokens` | decimal | Current output-token estimate |
| `estimatedLatencyMs` | decimal | Current latency estimate |
| `estimatedSuccessRate` | decimal | Current success-rate estimate |
| `degradedRate` | decimal | Current degraded-rate estimate |
| `cacheAffinity` | enum | `low`, `medium`, `high` |
| `freshnessSensitivity` | enum | `low`, `medium`, `high` |
| `effectiveCostScore` | decimal | Lower is preferred |
| `staticPriority` | integer | Existing priority preserved as tiebreak metadata |
| `orderingReasonCodes` | string array | Current reasons for preference or demotion |
| `lastObservedAt` | timestamp nullable | Last event time used by snapshot |
| `lastRefreshedAt` | timestamp | Snapshot refresh time |
| `seedHash` | string | Hash of the seed hint used for derivation |

### State Transitions

- `static` -> `insufficient-data` once at least one event exists
- `insufficient-data` -> `mixed` once sample count >= 15 and snapshot is not stale
- `mixed` -> `adaptive` once confidence, recency, success, and volatility thresholds all pass
- any non-static state -> `stale` once `now - lastObservedAt > 72 hours`
- any state -> `static` after scoped clear removes all usable history for that key

### Display Mapping

- `static` -> `seed-only`
- `insufficient-data` -> `sparse`
- `mixed` -> `mixed`
- `adaptive` -> `adaptive`
- `stale` -> `stale`

## 5. Route Seed Hint

Defines the built-in prior for a route before telemetry is trusted.

### Fields

| Field | Type | Notes |
|------|------|------|
| `unifiedTool` | enum | Built-in unified tool |
| `engine` | enum | Engine id |
| `engineTool` | string | Concrete route |
| `executionStrategy` | enum | Tool-level strategy for this slice |
| `adaptiveEligible` | boolean | Whether active ordering may change execution |
| `estimatedInputTokens` | integer | Seed prior |
| `estimatedOutputTokens` | integer | Seed prior |
| `estimatedLatencyMs` | integer | Seed prior |
| `expectedSuccessRate` | decimal | Seed prior |
| `cacheAffinity` | enum | Seed prior |
| `freshnessSensitivity` | enum | Seed prior |

### Validation Rules

- Seed hints are defined alongside route metadata in adapter routing definitions.
- Seed hints exist for every route in the adaptive allowlist.
- Non-allowlisted routes may omit seed values beyond priority/strategy until later slices.

## 6. Telemetry Maintenance State

Tracks scheduler and compaction health per repository.

### Fields

| Field | Type | Notes |
|------|------|------|
| `repoId` | string | Primary key |
| `lastStartedAt` | timestamp nullable | Most recent maintenance start |
| `lastCompletedAt` | timestamp nullable | Most recent maintenance completion |
| `lastSuccessfulAt` | timestamp nullable | Most recent successful completion |
| `lastCompactedThrough` | timestamp nullable | Latest closed 15-minute bucket compacted |
| `status` | enum | `idle`, `running`, `degraded`, `failed` |
| `lagSeconds` | integer | Approximate maintenance lag |
| `lastError` | string nullable | Most recent failure summary |
| `lockOwner` | string nullable | Process/session identifier when running |

### State Transitions

- `idle` -> `running` when a scheduled or on-demand compaction acquires the advisory lock
- `running` -> `idle` on success
- `running` -> `degraded` on recoverable compaction failure
- `degraded` -> `idle` after a later successful run

## 7. Adaptive Subset Override

Repository-level config that adjusts the built-in adaptive allowlist.

### Fields

| Field | Type | Notes |
|------|------|------|
| `include` | array of unified tool names | Adds supported eligible built-in tools |
| `exclude` | array of unified tool names | Removes built-in default entries |

### Validation Rules

- Only supported eligible built-in tools are effective.
- Invalid entries are surfaced as warnings and ignored at runtime.
- Effective subset = `(default allowlist + include) - exclude`.