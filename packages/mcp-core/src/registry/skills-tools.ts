import { z } from "zod";

const includeEnum = z.enum([
	"description",
	"contentHash",
	"capabilities",
	"assetCounts",
	"compatibility",
	"summary",
	"matchReason",
]);

const readIncludeEnum = z.enum([
	"description",
	"metadata",
	"instructions",
	"sectionIndex",
	"referencesIndex",
	"scriptsIndex",
	"templatesIndex",
	"examplesIndex",
	"auxiliaryIndex",
	"references",
	"scripts",
	"templates",
	"examples",
	"auxiliary",
	"fullText",
]);

export const skillsToolInputSchemas = {
	"skills.find": {
		query: z.string().trim().min(1).optional().describe("Optional search query."),
		names: z.array(z.string().trim().min(1)).optional().describe("Optional explicit skill names."),
		include: z.array(includeEnum).optional().describe("Optional opt-in descriptor fields."),
		limit: z.number().int().positive().optional().describe("Maximum number of results to return."),
		offset: z.number().int().min(0).optional().describe("Optional result offset."),
	},
	"skills.read": {
		name: z.string().trim().min(1).describe("Skill name to read."),
		mode: z.enum(["memory", "instructions", "assets", "full"]).optional().describe("Read mode."),
		include: z.array(readIncludeEnum).optional().describe("Optional parts to include."),
		select: z
			.object({
				sections: z.array(z.string()).optional(),
				references: z.array(z.string()).optional(),
				scripts: z.array(z.string()).optional(),
				templates: z.array(z.string()).optional(),
				examples: z.array(z.string()).optional(),
				auxiliary: z.array(z.string()).optional(),
			})
			.optional()
			.describe("Optional named subsets to return."),
	},
	"skills.resolve": {
		prompt: z.string().trim().min(1).describe("Task prompt used to resolve relevant skills."),
		taskMetadata: z.record(z.string(), z.unknown()).optional().describe("Optional task metadata."),
		mcpEngineContext: z
			.record(z.string(), z.unknown())
			.optional()
			.describe("Optional MCP engine context that can refine ranking."),
		include: z
			.array(z.enum(["matchReason", "score", "configInfluence", "readHint"]))
			.optional()
			.describe("Optional fields to include per result."),
		limit: z.number().int().positive().optional().describe("Optional maximum number of results."),
	},
	"skills.refresh": {
		names: z
			.array(z.string().trim().min(1))
			.optional()
			.describe("Optional subset of skills to refresh."),
		scope: z.enum(["repo", "all"]).optional().describe("Refresh scope."),
		invalidateNotFound: z.boolean().optional().describe("Invalidate negative cache entries."),
		reindexEmbeddings: z.boolean().optional().describe("Reindex embeddings when enabled."),
	},
	"skills.create": {
		prompt: z.string().trim().min(1).describe("Prompt describing the skill to create."),
		targetPath: z.string().trim().min(1).optional().describe("Optional target directory."),
		template: z.string().trim().min(1).optional().describe("Optional template override."),
		mode: z.enum(["analyze", "generate", "write"]).optional().describe("Create mode."),
		includeRecommendations: z.boolean().optional(),
		includeGapAnalysis: z.boolean().optional(),
		includeCompletenessAnalysis: z.boolean().optional(),
		includeConsistencyAnalysis: z.boolean().optional(),
		validateBeforeWrite: z.boolean().optional(),
	},
	"skills.update": {
		name: z.string().trim().min(1).describe("Skill name to update."),
		prompt: z.string().trim().min(1).describe("Prompt describing the requested update."),
		mode: z.enum(["analyze", "patchPlan", "write"]).optional().describe("Update mode."),
		includeRecommendations: z.boolean().optional(),
		includeGapAnalysis: z.boolean().optional(),
		includeCompletenessAnalysis: z.boolean().optional(),
		includeConsistencyAnalysis: z.boolean().optional(),
		validateBeforeWrite: z.boolean().optional(),
		validateAfterWrite: z.boolean().optional(),
	},
} as const;

export const skillsToolDescriptions: Record<keyof typeof skillsToolInputSchemas, string> = {
	"skills.find": "List or search skills.",
	"skills.read": "Read selected skill content.",
	"skills.resolve": "Resolve relevant skills.",
	"skills.refresh": "Refresh skill index state.",
	"skills.create": "Create a skill package.",
	"skills.update": "Update a skill package.",
};
