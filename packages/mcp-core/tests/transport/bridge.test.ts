import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { invokeEngineTool } from "../../src/transport/bridge";

const callBridgeToolMock = mock(
	async (): Promise<{ ok: boolean; result?: unknown; error?: string }> => ({ ok: true }),
);
const reconnectBridgeMock = mock(async (): Promise<{ ok: boolean }> => ({ ok: true }));

const bridgeDependencies = {
	callBridgeTool: callBridgeToolMock as typeof import("@mimirmesh/runtime").callBridgeTool,
	reconnectBridge: reconnectBridgeMock as typeof import("@mimirmesh/runtime").reconnectBridge,
};

describe("invokeEngineTool", () => {
	beforeEach(() => {
		callBridgeToolMock.mockReset();
		reconnectBridgeMock.mockReset();
	});

	afterEach(() => {
		mock.restore();
	});

	test("reconnects and retries once when the bridge call aborts", async () => {
		callBridgeToolMock
			.mockRejectedValueOnce(new Error("The operation was aborted."))
			.mockResolvedValueOnce({
				ok: true,
				result: { recovered: true },
			});
		reconnectBridgeMock.mockResolvedValueOnce({ ok: true });

		const result = await invokeEngineTool(
			{
				bridgePorts: { "document-mcp": 55032 },
				engine: "document-mcp",
				tool: "search_documents",
				args: { query: "runtime status" },
			},
			bridgeDependencies,
		);

		expect(result.ok).toBe(true);
		expect(result.result).toEqual({ recovered: true });
		expect(reconnectBridgeMock).toHaveBeenCalledTimes(1);
		expect(callBridgeToolMock).toHaveBeenCalledTimes(2);
	});

	test("returns a missing-port error without reconnect attempts", async () => {
		const result = await invokeEngineTool(
			{
				bridgePorts: {},
				engine: "document-mcp",
				tool: "search_documents",
				args: { query: "runtime status" },
			},
			bridgeDependencies,
		);

		expect(result.ok).toBe(false);
		expect(result.error).toContain("Bridge port not available");
		expect(reconnectBridgeMock).toHaveBeenCalledTimes(0);
	});

	test("reconnects and retries once when the bridge returns 503", async () => {
		callBridgeToolMock
			.mockResolvedValueOnce({
				ok: false,
				error: "Bridge request failed (503)",
			})
			.mockResolvedValueOnce({
				ok: true,
				result: { recovered: "sse" },
			});
		reconnectBridgeMock.mockResolvedValueOnce({ ok: true });

		const result = await invokeEngineTool(
			{
				bridgePorts: { srclight: 55032 },
				engine: "srclight",
				tool: "search_symbols",
				args: { symbol: "runtimeStart" },
			},
			bridgeDependencies,
		);

		expect(result.ok).toBe(true);
		expect(result.result).toEqual({ recovered: "sse" });
		expect(reconnectBridgeMock).toHaveBeenCalledTimes(1);
		expect(callBridgeToolMock).toHaveBeenCalledTimes(2);
	});

	test("reconnects and retries once when the socket closes unexpectedly", async () => {
		callBridgeToolMock
			.mockRejectedValueOnce(
				new Error(
					"The socket connection was closed unexpectedly. For more information, pass `verbose: true` in the second argument to fetch()",
				),
			)
			.mockResolvedValueOnce({
				ok: true,
				result: { recovered: "socket" },
			});
		reconnectBridgeMock.mockResolvedValueOnce({ ok: true });

		const result = await invokeEngineTool(
			{
				bridgePorts: { "document-mcp": 55032 },
				engine: "document-mcp",
				tool: "search_documents",
				args: { query: "runtime status" },
			},
			bridgeDependencies,
		);

		expect(result.ok).toBe(true);
		expect(result.result).toEqual({ recovered: "socket" });
		expect(reconnectBridgeMock).toHaveBeenCalledTimes(1);
		expect(callBridgeToolMock).toHaveBeenCalledTimes(2);
	});
});
