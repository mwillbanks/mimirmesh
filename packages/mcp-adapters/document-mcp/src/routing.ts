import type { EngineDiscoveredTool, UnifiedRoute } from "@mimirmesh/runtime";
import type {
	AdapterRoutingRule,
	UnifiedExecutionContext,
	UnifiedExecutionStep,
} from "../../src/types";
import { resolveRoutesFromPatterns } from "../../src/utils";

export const documentRoutingRules: AdapterRoutingRule[] = [
	{
		unifiedTool: "search_docs",
		candidateToolPatterns: [/^search_documents$/i, /^find_text$/i],
		priority: 100,
	},
	{
		unifiedTool: "document_architecture",
		candidateToolPatterns: [/^search_documents$/i],
		priority: 40,
		executionStrategy: "fanout",
	},
	{
		unifiedTool: "document_feature",
		candidateToolPatterns: [/^document_feature$/i, /^generate_feature_documentation$/i],
		priority: 90,
	},
	{
		unifiedTool: "document_architecture",
		candidateToolPatterns: [/^document_architecture$/i, /^generate_architecture_documentation$/i],
		priority: 80,
		executionStrategy: "fanout",
	},
	{
		unifiedTool: "document_runbook",
		candidateToolPatterns: [/^document_runbook$/i, /^generate_operational_runbook$/i],
		priority: 80,
	},
];

const documentToolsWithInputEnvelope = new Set([
	"search_documents",
	"get_catalog",
	"get_document_info",
	"reindex_document",
]);

export const resolveDocumentRoutes = (tools: EngineDiscoveredTool[]): UnifiedRoute[] =>
	resolveRoutesFromPatterns("document-mcp", tools, documentRoutingRules);

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

const extractStructuredResult = <T>(payload: unknown): T | null => {
	const record = asRecord(payload);
	const structured = asRecord(record?.structuredContent);
	const result = structured?.result;
	return (result as T) ?? null;
};

export const prepareDocumentToolInput = (
	toolName: string,
	input: Record<string, unknown>,
): Record<string, unknown> => {
	if (!documentToolsWithInputEnvelope.has(toolName)) {
		return input;
	}

	if (Object.hasOwn(input, "input")) {
		return input;
	}

	return {
		input,
	};
};

export const executeDocumentUnifiedTool = async (
	context: UnifiedExecutionContext,
): Promise<UnifiedExecutionStep[] | null> => {
	if (context.unifiedTool !== "search_docs" && context.unifiedTool !== "document_architecture") {
		return null;
	}

	if (context.unifiedTool === "document_architecture") {
		const searchDocumentsRoute = context.routes.find(
			(route) => route.engineTool === "search_documents",
		);
		if (!searchDocumentsRoute) {
			return [];
		}

		const rawQuery =
			typeof context.input.query === "string"
				? context.input.query.trim()
				: typeof context.input.prompt === "string"
					? context.input.prompt.trim()
					: "";
		const query =
			rawQuery ||
			"architecture overview system design components boundaries runtime adapters routing docker compose adr";
		const limit =
			typeof context.input.limit === "number" && context.input.limit > 0
				? Math.floor(context.input.limit)
				: typeof context.input.max_results === "number" && context.input.max_results > 0
					? Math.floor(context.input.max_results)
					: 8;
		const searchType =
			typeof context.input.search_type === "string" ? context.input.search_type : "chunks";

		const startedAt = performance.now();
		const response = await context.invoke(
			searchDocumentsRoute.engineTool,
			prepareDocumentToolInput(searchDocumentsRoute.engineTool, {
				query,
				limit,
				search_type: searchType,
			}),
		);
		const latencyMs = Math.round(performance.now() - startedAt);

		return [
			{
				route: searchDocumentsRoute,
				response,
				latencyMs,
			},
		];
	}

	const query =
		typeof context.input.query === "string"
			? context.input.query.trim()
			: typeof context.input.search_text === "string"
				? context.input.search_text.trim()
				: "";
	if (!query) {
		return [];
	}

	const maxResults =
		typeof context.input.max_results === "number" && context.input.max_results > 0
			? Math.floor(context.input.max_results)
			: typeof context.input.limit === "number" && context.input.limit > 0
				? Math.floor(context.input.limit)
				: 10;
	const searchType =
		typeof context.input.search_type === "string"
			? context.input.search_type
			: typeof context.input.scope === "string" && context.input.scope === "chunks"
				? "chunks"
				: "documents";

	const searchDocumentsRoute = context.routes.find(
		(route) => route.engineTool === "search_documents",
	);
	if (searchDocumentsRoute) {
		const startedAt = performance.now();
		const response = await context.invoke(
			searchDocumentsRoute.engineTool,
			prepareDocumentToolInput(searchDocumentsRoute.engineTool, {
				query,
				limit: maxResults,
				search_type: searchType,
			}),
		);
		const latencyMs = Math.round(performance.now() - startedAt);
		return [
			{
				route: searchDocumentsRoute,
				response,
				latencyMs,
			},
		];
	}

	const explicitDocument =
		typeof context.input.document_name === "string" ? context.input.document_name.trim() : "";
	let documentNames: string[] = [];

	if (explicitDocument) {
		documentNames = [explicitDocument];
	} else {
		const listed = await context.invoke("list_documents", {});
		if (!listed.ok) {
			const fallbackRoute = context.routes[0];
			if (!fallbackRoute) {
				return [];
			}
			return [
				{
					route: fallbackRoute,
					response: listed,
					latencyMs: 0,
				},
			];
		}

		const documents =
			extractStructuredResult<Array<{ document_name?: string }>>(listed.result) ?? [];
		documentNames = documents.map((entry) => entry.document_name?.trim() ?? "").filter(Boolean);
	}

	const findTextRoute = context.routes.find((route) => route.engineTool === "find_text");
	if (!findTextRoute) {
		return [];
	}
	const targetRoute = findTextRoute;

	const legacyMaxResults =
		typeof context.input.max_results === "number" && context.input.max_results > 0
			? Math.floor(context.input.max_results)
			: 10;
	const scope = typeof context.input.scope === "string" ? context.input.scope : "document";

	const perDocument = await Promise.all(
		documentNames.map(async (documentName) => {
			const startedAt = performance.now();
			const response = await context.invoke(findTextRoute.engineTool, {
				document_name: documentName,
				search_text: query,
				scope,
				max_results: legacyMaxResults,
			});
			const latencyMs = Math.round(performance.now() - startedAt);
			const hits = extractStructuredResult<unknown[]>(response.result);
			if (response.ok && Array.isArray(hits) && hits.length === 0) {
				return null;
			}
			return {
				route: targetRoute,
				response,
				latencyMs,
			};
		}),
	);

	return perDocument.filter((entry): entry is UnifiedExecutionStep => Boolean(entry));
};
