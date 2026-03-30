import type {
	EngineId,
	McpCompressionLevel,
	MimirmeshConfig,
	ProjectRuntimeVersionRecord,
	RuntimeState,
	UpgradeStatusReport,
} from "@mimirmesh/config";
import type { SkillRegistryState } from "../state/skills";

export type RuntimeBridgeTransport = "stdio" | "sse" | "streamable-http";
export type RouteExecutionStrategy = "prefer-first" | "fanout" | "fallback-only";
export type RouteHintSourceMode = "static" | "insufficient-data" | "mixed" | "adaptive" | "stale";
export type RouteHintSourceLabel = "seed-only" | "sparse" | "mixed" | "adaptive" | "stale";
export type RouteHintFreshnessState = "current" | "aging" | "stale" | "unknown";
export type RouteHintCacheAffinity = "low" | "medium" | "high";
export type RouteHintFreshnessSensitivity = "low" | "medium" | "high";
export type RouteTelemetryHealthState = "ready" | "behind" | "degraded" | "unavailable";
export type RouteTelemetryMaintenanceStatus = "idle" | "running" | "degraded" | "failed";
export type RouteExecutionOutcome = "success" | "degraded" | "failed" | "skipped";
export type RouteArgumentQueryClass = "empty" | "identifier" | "free-text" | "path-only" | "mixed";
export type RouteArgumentLimitBand = "default" | "small" | "medium" | "large";
export type RouteArgumentPromptLengthBand = "short" | "medium" | "long";

export type SanitizedArgumentSummary = {
	shapeVersion: number;
	queryClass: RouteArgumentQueryClass;
	hasPath: boolean;
	limitBand: RouteArgumentLimitBand;
	promptLengthBand: RouteArgumentPromptLengthBand;
	identifierLike: boolean;
	additionalFlags: Record<string, boolean>;
};

export type RouteSeedHint = {
	unifiedTool: string;
	engine: EngineId;
	engineTool: string;
	executionStrategy: RouteExecutionStrategy;
	adaptiveEligible: boolean;
	estimatedInputTokens: number;
	estimatedOutputTokens: number;
	estimatedLatencyMs: number;
	expectedSuccessRate: number;
	cacheAffinity: RouteHintCacheAffinity;
	freshnessSensitivity: RouteHintFreshnessSensitivity;
};

export type RouteExecutionEvent = {
	eventId: string;
	repoId: string;
	occurredAt: string;
	sessionId: string | null;
	requestCorrelationId: string | null;
	unifiedTool: string;
	profileKey: string;
	sanitizedArgumentSummary: SanitizedArgumentSummary;
	requestFingerprint: string | null;
	engine: EngineId;
	engineTool: string;
	executionStrategy: RouteExecutionStrategy;
	staticPriority: number;
	attemptIndex: number;
	outcome: RouteExecutionOutcome;
	failureClassification: string | null;
	latencyMs: number;
	estimatedInputTokens: number;
	estimatedOutputTokens: number;
	inputBytes: number;
	outputBytes: number;
	resultItemCount: number;
	hintSourceModeAtExecution: RouteHintSourceMode;
	hintConfidenceAtExecution: number;
	effectiveCostScoreAtExecution: number;
	orderingReasonCodes: string[];
	createdAt: string;
};

export type RouteRollupBucket = {
	repoId: string;
	unifiedTool: string;
	profileKey: string;
	engine: EngineId;
	engineTool: string;
	executionStrategy: RouteExecutionStrategy;
	bucketStart: string;
	attemptCount: number;
	successCount: number;
	degradedCount: number;
	failedCount: number;
	avgLatencyMs: number;
	p95LatencyMs: number;
	avgEstimatedInputTokens: number;
	avgEstimatedOutputTokens: number;
	avgInputBytes: number;
	avgOutputBytes: number;
	avgResultItemCount: number;
	lastObservedAt: string;
	orderingReasonCounts: Record<string, number>;
};

export type RouteHintSnapshot = {
	repoId: string;
	unifiedTool: string;
	profileKey: string;
	engine: EngineId;
	engineTool: string;
	executionStrategy: RouteExecutionStrategy;
	subsetEligible: boolean;
	sourceMode: RouteHintSourceMode;
	sourceLabel: RouteHintSourceLabel;
	sampleCount: number;
	confidence: number;
	freshnessState: RouteHintFreshnessState;
	freshnessAgeSeconds: number | null;
	estimatedInputTokens: number;
	estimatedOutputTokens: number;
	estimatedLatencyMs: number;
	estimatedSuccessRate: number;
	degradedRate: number;
	cacheAffinity: RouteHintCacheAffinity;
	freshnessSensitivity: RouteHintFreshnessSensitivity;
	effectiveCostScore: number;
	staticPriority: number;
	orderingReasonCodes: string[];
	lastObservedAt: string | null;
	lastRefreshedAt: string;
	seedHash: string;
};

export type RouteTelemetryMaintenanceProgress = {
	closedBucketCount: number;
	remainingBucketCount: number;
	lastProcessedBucketEnd: string | null;
};

export type RouteTelemetryMaintenanceState = {
	repoId: string;
	lastStartedAt: string | null;
	lastCompletedAt: string | null;
	lastSuccessfulAt: string | null;
	lastCompactedThrough: string | null;
	status: RouteTelemetryMaintenanceStatus;
	lagSeconds: number;
	lastError: string | null;
	lockOwner: string | null;
};

export type RuntimeServiceStatus = {
	name: string;
	state: "running" | "stopped" | "starting" | "unhealthy" | "unknown";
	health: "healthy" | "unhealthy" | "unknown";
	containerId?: string;
	message?: string;
	hostPort?: number;
};

export type RuntimeBridgeInfo = {
	engine: EngineId;
	url: string;
	transport: RuntimeBridgeTransport;
	healthy: boolean;
	reason?: string;
	checkedAt: string;
};

export type RuntimeHealth = {
	timestamp: string;
	state: RuntimeState;
	dockerInstalled: boolean;
	dockerDaemonRunning: boolean;
	composeAvailable: boolean;
	degraded: boolean;
	reasons: string[];
	services: RuntimeServiceStatus[];
	bridges: RuntimeBridgeInfo[];
	runtimeVersion?: ProjectRuntimeVersionRecord | null;
	upgradeState?: UpgradeStatusReport["state"] | null;
	migrationStatus?: string | null;
	skillRegistry?: SkillRegistryState | null;
	routeTelemetry?: {
		state: RouteTelemetryHealthState;
		lastSuccessfulCompactionAt: string | null;
		lagSeconds: number;
		warnings: string[];
	} | null;
};

export type RuntimeConnection = {
	projectName: string;
	composeFile: string;
	updatedAt: string;
	startedAt: string | null;
	mounts: Record<string, string>;
	services: string[];
	bridgePorts: Partial<Record<EngineId, number>>;
};

export type McpSessionToolSurfaceState = {
	sessionId: string;
	policyVersion: string;
	compressionLevel: McpCompressionLevel;
	loadedEngineGroups: EngineId[];
	lastNotificationAt: string | null;
	lastLoadedAt: string | null;
	lastUpdatedAt: string;
	lazyLoadDiagnostics: Array<{
		sessionId: string;
		engineId: EngineId;
		trigger: "explicit-load" | "tool-invocation" | "refresh";
		startedAt: string;
		completedAt: string;
		outcome: "success" | "degraded" | "failed";
		discoveredToolCount: number;
		diagnostics: string[];
		notificationSent: boolean;
	}>;
};

export type EngineDiscoveredTool = {
	name: string;
	description?: string;
	inputSchema?: Record<string, unknown>;
};

export type EngineRuntimeState = {
	engine: EngineId;
	enabled: boolean;
	required: boolean;
	namespace: string;
	serviceName: string;
	imageTag: string;
	configHash: string;
	discoveredTools: EngineDiscoveredTool[];
	health: {
		state: "healthy" | "unhealthy" | "unknown";
		message: string;
		checkedAt: string;
	};
	bridge: {
		url: string;
		transport: RuntimeBridgeTransport;
		healthy: boolean;
		checkedAt: string;
		lastError?: string;
	};
	lastStartupAt: string | null;
	lastBootstrapAt: string | null;
	lastBootstrapResult: "pending" | "success" | "failed" | "skipped";
	degradedReason?: string;
	capabilityWarnings?: string[];
	runtimeEvidence?: {
		bootstrapMode: "tool" | "command" | "none";
		repoLocalStateDir?: string;
		repoLocalIndexPresent?: boolean;
		repoLocalEmbeddingFiles?: string[];
		gpuMode?: "auto" | "on" | "off";
		effectiveUseGpu?: boolean;
		runtimeVariant?: "cpu" | "cuda";
		hostNvidiaAvailable?: boolean;
		gpuResolutionReason?: string;
		gitBinaryAvailable?: boolean;
		gitRepoVisible?: boolean;
		gitWorkTreeAccessible?: boolean;
		gitCapabilityMessage?: string;
	};
};

export type BootstrapEngineState = {
	engine: EngineId;
	required: boolean;
	mode: "tool" | "command" | "none";
	completed: boolean;
	bootstrapInputHash: string;
	projectRootHash: string;
	lastStartedAt: string | null;
	lastCompletedAt: string | null;
	failureReason: string | null;
	retryCount: number;
	command?: string;
	args?: string[];
};

export type BootstrapStateFile = {
	updatedAt: string;
	engines: BootstrapEngineState[];
};

export type PassthroughRoute = {
	publicTool: string;
	engine: EngineId;
	engineTool: string;
	description?: string;
	inputSchema?: Record<string, unknown>;
	publication?: {
		canonicalEngineId: string;
		publishedTool: string;
		retiredAliases: string[];
	};
};

export type UnifiedRoute = {
	unifiedTool: string;
	engine: EngineId;
	engineTool: string;
	priority: number;
	executionStrategy?: RouteExecutionStrategy;
	seedHint?: RouteSeedHint | null;
	inputSchema?: Record<string, unknown>;
};

export type RoutingTable = {
	generatedAt: string;
	passthrough: PassthroughRoute[];
	unified: UnifiedRoute[];
};

export type RuntimeActionResult = {
	ok: boolean;
	action: "start" | "stop" | "restart" | "status" | "refresh";
	message: string;
	health: RuntimeHealth;
	connection: RuntimeConnection;
	runtimeVersion?: ProjectRuntimeVersionRecord | null;
	upgradeStatus?: UpgradeStatusReport | null;
};

export type RuntimeCommandContext = {
	projectRoot: string;
	config: MimirmeshConfig;
};

export type {
	BackupArtifact,
	BackupManifest,
	EngineUpgradeDecision,
	EngineUpgradeRuntimeAction,
	MigrationContext,
	PreservedAssetCompatibility,
	PreservedAssetRecord,
	PreservedAssetType,
	PreservedAssetValidationMode,
	PreservedAssetValidationResult,
	RuntimeMigration,
	RuntimeMigrationKind,
	RuntimeMigrationPlan,
	RuntimeMigrationPlanStep,
	RuntimeMigrationRollbackStrategy,
	RuntimeUpgradeActionResult,
	RuntimeUpgradeDriftCategory,
	RuntimeUpgradeExecution,
	RuntimeUpgradeMetadata,
	RuntimeUpgradeRequiredAction,
	RuntimeUpgradeResult,
	RuntimeUpgradeState,
	UpgradeCheckpoint,
	UpgradeOutcome,
	UpgradeStatusReport,
} from "../upgrade/types";
