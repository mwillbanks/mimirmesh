import type { EngineId, MimirmeshConfig } from "@mimirmesh/config";
import { codebaseMemoryAdapter } from "../codebase-memory-mcp/src";
import { documentMcpAdapter } from "../document-mcp/src";
import { adrAdapter } from "../mcp-adr-analysis-server/src";
import { srclightAdapter } from "../srclight/src";
import type { EngineAdapterModule, EngineConfigTranslationResult } from "./types";

export type {
	AdapterRoutingRule,
	EngineAdapterModule,
	EngineBootstrapDefinition,
	EngineRuntimeContract,
} from "./types";

export const allEngineAdapters: EngineAdapterModule[] = [
	srclightAdapter,
	documentMcpAdapter,
	adrAdapter,
	codebaseMemoryAdapter,
];

export const getAdapter = (engine: EngineId): EngineAdapterModule => {
	const adapter = allEngineAdapters.find((entry) => entry.id === engine);
	if (!adapter) {
		throw new Error(`Unknown engine adapter: ${engine}`);
	}
	return adapter;
};

export const createAdapters = (_config: MimirmeshConfig): EngineAdapterModule[] =>
	allEngineAdapters;

export const translateEngineConfig = (
	engine: EngineId,
	projectRoot: string,
	config: MimirmeshConfig,
): EngineConfigTranslationResult => getAdapter(engine).translateConfig(projectRoot, config);

export const translateAllEngineConfigs = (
	projectRoot: string,
	config: MimirmeshConfig,
): EngineConfigTranslationResult[] =>
	allEngineAdapters.map((adapter) => adapter.translateConfig(projectRoot, config));
