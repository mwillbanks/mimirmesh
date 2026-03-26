import OpenAI from "openai";

import type { SkillRecord } from "./types";

export type SkillEmbeddingProvider = {
	type: "llama_cpp" | "lm_studio" | "openai" | "openai_compatible_remote";
	model: string;
	baseUrl?: string;
	apiKey?: string;
	timeoutMs?: number;
	maxRetries?: number;
};

export type TextEmbeddingResult = {
	vector: number[];
	model: string;
	dims: number;
	providerType: SkillEmbeddingProvider["type"];
};

export type TextEmbeddingBatchResult = {
	vectors: number[][];
	model: string;
	dims: number;
	providerType: SkillEmbeddingProvider["type"];
	diagnostics: string[];
};

const localProviderTypes = new Set<SkillEmbeddingProvider["type"]>([
	"llama_cpp",
	"lm_studio",
	"openai_compatible_remote",
]);

const createClient = (provider: SkillEmbeddingProvider): OpenAI =>
	new OpenAI({
		apiKey: provider.apiKey?.trim() || "mimirmesh-local",
		baseURL: localProviderTypes.has(provider.type) ? provider.baseUrl : undefined,
		timeout: provider.timeoutMs ?? 30_000,
		maxRetries: provider.maxRetries ?? 2,
	});

const asErrorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

const nonEmptyLines = (value: string): string[] =>
	value
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

export const buildSkillEmbeddingText = (record: SkillRecord): string => {
	const headings = record.sections
		.map((section) => section.headingPath.join(" / "))
		.filter(Boolean)
		.slice(0, 12);
	const assetHints = record.assets.slice(0, 20).map((asset) => `${asset.assetType}:${asset.path}`);
	const instructions = nonEmptyLines(record.bodyMarkdown).slice(0, 24);

	return [
		`Skill: ${record.name}`,
		`Description: ${record.description}`,
		record.compatibility ? `Compatibility: ${record.compatibility}` : "",
		headings.length > 0 ? `Headings: ${headings.join(" | ")}` : "",
		assetHints.length > 0 ? `Assets: ${assetHints.join(" | ")}` : "",
		instructions.length > 0 ? `Instructions: ${instructions.join(" ")}` : "",
	]
		.filter(Boolean)
		.join("\n");
};

export const createTextEmbeddings = async (options: {
	inputs: string[];
	providers: SkillEmbeddingProvider[];
	enabled: boolean;
	fallbackOnFailure?: boolean;
}): Promise<TextEmbeddingBatchResult | null> => {
	if (!options.enabled || options.inputs.length === 0 || options.providers.length === 0) {
		return null;
	}

	const diagnostics: string[] = [];
	for (const provider of options.providers) {
		try {
			const response = await createClient(provider).embeddings.create({
				model: provider.model,
				input: options.inputs,
				encoding_format: "float",
			});
			const vectors = response.data.map((entry) => entry.embedding);
			const dims = vectors[0]?.length ?? 0;
			if (vectors.length !== options.inputs.length || dims === 0) {
				throw new Error("Embedding provider returned an incomplete embedding batch.");
			}

			return {
				vectors,
				model: provider.model,
				dims,
				providerType: provider.type,
				diagnostics,
			};
		} catch (error) {
			diagnostics.push(
				`Embedding provider ${provider.type} failed for model ${provider.model}: ${asErrorMessage(error)}`,
			);
			if (!options.fallbackOnFailure) {
				break;
			}
		}
	}

	return null;
};

export const createTextEmbedding = async (options: {
	input: string;
	providers: SkillEmbeddingProvider[];
	enabled: boolean;
	fallbackOnFailure?: boolean;
}): Promise<(TextEmbeddingResult & { diagnostics: string[] }) | null> => {
	const batch = await createTextEmbeddings({
		inputs: [options.input],
		providers: options.providers,
		enabled: options.enabled,
		fallbackOnFailure: options.fallbackOnFailure,
	});
	if (!batch) {
		return null;
	}

	return {
		vector: batch.vectors[0] ?? [],
		model: batch.model,
		dims: batch.dims,
		providerType: batch.providerType,
		diagnostics: batch.diagnostics,
	};
};
