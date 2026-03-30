import type { EngineId } from "@mimirmesh/config";
import { callBridgeTool, reconnectBridge } from "@mimirmesh/runtime";

type BridgeRuntimeDependencies = {
	callBridgeTool: typeof import("@mimirmesh/runtime").callBridgeTool;
	reconnectBridge: typeof import("@mimirmesh/runtime").reconnectBridge;
};

const defaultBridgeRuntimeDependencies: BridgeRuntimeDependencies = {
	callBridgeTool,
	reconnectBridge,
};

export const bridgeUrlForEngine = (
	bridgePorts: Partial<Record<EngineId, number>>,
	engine: EngineId,
): string | null => {
	const port = bridgePorts[engine];
	return port ? `http://127.0.0.1:${port}` : null;
};

export const invokeEngineTool = async (
	options: {
		bridgePorts: Partial<Record<EngineId, number>>;
		engine: EngineId;
		tool: string;
		args: Record<string, unknown>;
	},
	dependencies: BridgeRuntimeDependencies = defaultBridgeRuntimeDependencies,
): Promise<{ ok: boolean; result?: unknown; error?: string }> => {
	const url = bridgeUrlForEngine(options.bridgePorts, options.engine);
	if (!url) {
		return {
			ok: false,
			error: `Bridge port not available for ${options.engine}`,
		};
	}

	const shouldReconnect = (error: string | undefined): boolean => {
		if (!error) {
			return false;
		}

		const normalized = error.toLowerCase();
		return (
			normalized.includes("timed out") ||
			normalized.includes("aborted") ||
			normalized.includes("socket connection was closed unexpectedly") ||
			normalized.includes("bridge request failed (502)") ||
			normalized.includes("bridge request failed (503)")
		);
	};

	const callOnce = async () =>
		dependencies.callBridgeTool(url, {
			tool: options.tool,
			args: options.args,
		});

	try {
		const initial = await callOnce();
		if (!initial.ok && shouldReconnect(initial.error)) {
			await dependencies.reconnectBridge(url);
			return await callOnce();
		}
		return initial;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (shouldReconnect(message)) {
			try {
				await dependencies.reconnectBridge(url);
				return await callOnce();
			} catch (retryError) {
				return {
					ok: false,
					error: retryError instanceof Error ? retryError.message : String(retryError),
				};
			}
		}

		return {
			ok: false,
			error: message,
		};
	}
};
