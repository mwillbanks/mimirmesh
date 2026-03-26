export const skillSchemaVersion = "1";
export const descriptorSchemaVersion = "1";
export const memoryDerivationVersion = "1";

export type SkillSourceProvider = "repository" | "bundled";
export type SkillSectionKind =
	| "instructions"
	| "example"
	| "reference_hint"
	| "compatibility"
	| "other";
export type SkillAssetType = "reference" | "script" | "template" | "example" | "auxiliary";
export type SkillReadMode = "memory" | "instructions" | "assets" | "full";
export type SkillCompressionAlgorithm = "zstd" | "gzip" | "none";

export type SkillCompressionRecord = {
	algorithm: SkillCompressionAlgorithm;
	scope: "transport" | "at-rest" | "export";
	sizeBytes: number;
};

export type SkillSource = {
	rootPath: string;
	skillPath: string;
	provider: SkillSourceProvider;
	revision?: string | null;
};

export type SkillSection = {
	id: string;
	skillId: string;
	ordinal: number;
	kind: SkillSectionKind;
	headingPath: string[];
	text: string;
	tokenEstimate: number;
	sectionHash: string;
};

export type SkillAsset = {
	id: string;
	skillId: string;
	path: string;
	assetType: SkillAssetType;
	mediaType: string | null;
	textContent: string | null;
	blobRef?: string | null;
	compression?: SkillCompressionRecord | null;
	contentHash: string;
	tokenEstimate: number;
};

export type SkillRecord = {
	id: string;
	repoId: string;
	name: string;
	description: string;
	license?: string;
	compatibility?: string | null;
	metadata: Record<string, unknown>;
	source: SkillSource;
	rawMarkdown: string;
	frontmatterSource: string;
	bodyMarkdown: string;
	contentHash: string;
	schemaVersion: string;
	parseWarnings: string[];
	rawCompression?: SkillCompressionRecord | null;
	normalizedCompression?: SkillCompressionRecord | null;
	discoveredAt: string;
	indexedAt: string;
	updatedAt: string;
	sections: SkillSection[];
	assets: SkillAsset[];
};

export type SkillDescriptorInclude =
	| "description"
	| "contentHash"
	| "capabilities"
	| "assetCounts"
	| "compatibility"
	| "summary"
	| "matchReason";

export type SkillDescriptor = {
	name: string;
	shortDescription: string;
	cacheKey: string;
	description?: string;
	contentHash?: string;
	compatibility?: string | null;
	summary?: string;
	matchReason?: string;
	assetCounts?: {
		references: number;
		scripts: number;
		templates: number;
		examples: number;
		auxiliaryFiles: number;
	};
	capabilities?: {
		hasReferences: boolean;
		hasScripts: boolean;
		hasTemplates: boolean;
		hasExamples: boolean;
	};
};

export type CompressedSkillMemory = {
	name: string;
	description: string;
	usageTriggers: string[];
	doFirst: string[];
	avoid: string[];
	requiredInputs: string[];
	outputs: string[];
	decisionRules: string[];
	referencesIndex?: Array<{ path: string; mediaType: string | null; contentHash: string }>;
	scriptsIndex?: Array<{ path: string; mediaType: string | null; contentHash: string }>;
	templatesIndex?: Array<{ path: string; mediaType: string | null; contentHash: string }>;
	examplesIndex?: Array<{ path: string; mediaType: string | null; contentHash: string }>;
	compatibility?: string | null;
	contentHash: string;
	derivationVersion: string;
};

export type SkillReadSelection = {
	sections?: string[];
	references?: string[];
	scripts?: string[];
	templates?: string[];
	examples?: string[];
	auxiliary?: string[];
};

export type SkillReadInclude =
	| "description"
	| "metadata"
	| "instructions"
	| "sectionIndex"
	| "referencesIndex"
	| "scriptsIndex"
	| "templatesIndex"
	| "examplesIndex"
	| "auxiliaryIndex"
	| "references"
	| "scripts"
	| "templates"
	| "examples"
	| "auxiliary"
	| "fullText";

export type SkillReadRequest = {
	name: string;
	mode?: SkillReadMode;
	include?: SkillReadInclude[];
	select?: SkillReadSelection;
};

export type SkillReadResponse = {
	name: string;
	mode: SkillReadMode;
	contentHash: string;
	readSignature: string;
	compression: {
		representation: "structured-memory" | "none";
		algorithm: SkillCompressionAlgorithm;
		scope: "transport" | "at-rest" | "export";
	};
	includedParts: string[];
	selected?: SkillReadSelection;
	memory?: CompressedSkillMemory;
	metadata?: Record<string, unknown>;
	instructions?: {
		sections: Array<{ headingPath: string[]; text: string }>;
	};
	indexes?: Partial<{
		references: Array<{ path: string; mediaType: string | null; contentHash: string }>;
		scripts: Array<{ path: string; mediaType: string | null; contentHash: string }>;
		templates: Array<{ path: string; mediaType: string | null; contentHash: string }>;
		examples: Array<{ path: string; mediaType: string | null; contentHash: string }>;
		auxiliary: Array<{ path: string; mediaType: string | null; contentHash: string }>;
	}>;
	assets?: Partial<{
		references: Array<{ path: string; mediaType: string | null; textContent?: string }>;
		scripts: Array<{ path: string; mediaType: string | null; textContent?: string }>;
		templates: Array<{ path: string; mediaType: string | null; textContent?: string }>;
		examples: Array<{ path: string; mediaType: string | null; textContent?: string }>;
		auxiliary: Array<{ path: string; mediaType: string | null; textContent?: string }>;
	}>;
};

export type SkillsFindRequest = {
	query?: string;
	names?: string[];
	include?: SkillDescriptorInclude[];
	limit?: number;
	offset?: number;
};

export type SkillsFindResponse = {
	results: SkillDescriptor[];
	total: number;
};

export type SkillResolveInclude = "matchReason" | "score" | "configInfluence" | "readHint";

export type SkillsResolveRequest = {
	prompt: string;
	taskMetadata?: Record<string, unknown>;
	mcpEngineContext?: Record<string, unknown>;
	include?: SkillResolveInclude[];
	limit?: number;
};

export type SkillsResolveResponse = {
	results: Array<
		SkillDescriptor & {
			matchReason?: string;
			score?: number;
			configInfluence?: string[];
			readHint?: {
				mode: SkillReadMode;
				include?: string[];
				select?: Record<string, string[]>;
			};
		}
	>;
	precedenceApplied: string[];
	usedMcpEngineContext: boolean;
	total: number;
};

export type SkillsRefreshRequest = {
	names?: string[];
	scope?: "repo" | "all";
	invalidateNotFound?: boolean;
	reindexEmbeddings?: boolean;
};

export type SkillsRefreshResponse = {
	scope: "repo" | "all";
	refreshedSkills: string[];
	invalidatedPositiveCacheEntries: number;
	invalidatedNegativeCacheEntries: number;
	embeddingsReindexed: number;
	runtimeReadiness: {
		ready: boolean;
		healthClassification: "healthy" | "degraded" | "unavailable";
		stateArtifactPaths: string[];
		message: string;
	};
	diagnostics?: string[];
};

export type SkillValidationResult = {
	status: "passed" | "failed" | "skipped";
	findings: string[];
};

export type SkillWriteResult = {
	status: "written" | "skipped";
	files: string[];
};

export type SkillsCreateRequest = {
	prompt: string;
	targetPath?: string;
	template?: string;
	mode?: "analyze" | "generate" | "write";
	includeRecommendations?: boolean;
	includeGapAnalysis?: boolean;
	includeCompletenessAnalysis?: boolean;
	includeConsistencyAnalysis?: boolean;
	validateBeforeWrite?: boolean;
};

export type SkillsCreateResponse = {
	mode: "analyze" | "generate" | "write";
	targetPath?: string;
	generatedSkillName?: string;
	recommendations: string[];
	gapAnalysis: string[];
	completenessAnalysis: string[];
	consistencyFindings: string[];
	validation: SkillValidationResult;
	writeResult?: SkillWriteResult;
	generatedFiles?: Record<string, string>;
};

export type SkillsUpdateRequest = {
	name: string;
	prompt: string;
	mode?: "analyze" | "patchPlan" | "write";
	includeRecommendations?: boolean;
	includeGapAnalysis?: boolean;
	includeCompletenessAnalysis?: boolean;
	includeConsistencyAnalysis?: boolean;
	validateBeforeWrite?: boolean;
	validateAfterWrite?: boolean;
};

export type SkillsUpdateResponse = {
	name: string;
	mode: "analyze" | "patchPlan" | "write";
	recommendations: string[];
	gapAnalysis: string[];
	completenessAnalysis: string[];
	consistencyFindings: string[];
	validation: SkillValidationResult;
	patchPlan?: {
		summary: string;
		affectedFiles: string[];
	};
	writeResult?: SkillWriteResult;
};

export type SkillRegistryCacheEntry = {
	repoId: string;
	lookupKey: string;
	skillName: string;
	contentHash: string;
	readSignature: string;
	payload: SkillReadResponse;
	createdAt: string;
};

export type SkillRegistryNegativeCacheEntry = {
	repoId: string;
	lookupKey: string;
	createdAt: string;
	expiresAt: string;
};

export type SkillEmbeddingEntry = {
	skillId: string;
	targetType: "skill" | "section" | "summary";
	model: string;
	dims: number;
	embeddingHash: string;
	providerType: "llama_cpp" | "lm_studio" | "openai" | "openai_compatible_remote";
	createdAt: string;
	vector?: number[];
};

export type SkillRegistryState = {
	repoId: string;
	schemaVersion: string;
	skills: SkillRecord[];
	positiveCache: SkillRegistryCacheEntry[];
	negativeCache: SkillRegistryNegativeCacheEntry[];
	embeddings: SkillEmbeddingEntry[];
	lastIndexedAt: string | null;
};

export type AgentsManagedSectionOutcome = "created" | "inserted" | "updated" | "no-op";
