import { beforeEach, describe, expect, mock, test } from "bun:test";

const actualRuntime = await import("@mimirmesh/runtime");

const runtimeMock = {
	...actualRuntime,
	callBridgeTool: mock(
		async (): Promise<{ ok: boolean; result?: unknown; error?: string }> => ({ ok: true }),
	),
	reconnectBridge: mock(async (): Promise<{ ok: boolean }> => ({ ok: true })),
};

mock.module("@mimirmesh/runtime", () => runtimeMock);

const transport = await import("../../src/transport/bridge");

describe("invokeEngineTool", () => {
	beforeEach(() => {
		runtimeMock.callBridgeTool.mockReset();
		runtimeMock.reconnectBridge.mockReset();
	});

	test("reconnects and retries once when the bridge call aborts", async () => {
		runtimeMock.callBridgeTool
			.mockRejectedValueOnce(new Error("The operation was aborted."))
			.mockResolvedValueOnce({
				ok: true,
				result: { recovered: true },
			});
		runtimeMock.reconnectBridge.mockResolvedValueOnce({ ok: true });

		const result = await transport.invokeEngineTool({
			bridgePorts: { "codebase-memory-mcp": 55032 },
			engine: "codebase-memory-mcp",
			tool: "search_code",
			args: { pattern: "runtime status" },
		});

		expect(result.ok).toBe(true);
		expect(result.result).toEqual({ recovered: true });
		expect(runtimeMock.reconnectBridge).toHaveBeenCalledTimes(1);
		expect(runtimeMock.callBridgeTool).toHaveBeenCalledTimes(2);
	});

	test("returns a missing-port error without reconnect attempts", async () => {
		const result = await transport.invokeEngineTool({
			bridgePorts: {},
			engine: "codebase-memory-mcp",
			tool: "search_code",
			args: { pattern: "runtime status" },
		});

		expect(result.ok).toBe(false);
		expect(result.error).toContain("Bridge port not available");
		expect(runtimeMock.reconnectBridge).toHaveBeenCalledTimes(0);
	});

	test("reconnects and retries once when the bridge returns 503", async () => {
		runtimeMock.callBridgeTool
			.mockResolvedValueOnce({
				ok: false,
				error: "Bridge request failed (503)",
			})
			.mockResolvedValueOnce({
				ok: true,
				result: { recovered: "sse" },
			});
		runtimeMock.reconnectBridge.mockResolvedValueOnce({ ok: true });

		const result = await transport.invokeEngineTool({
			bridgePorts: { srclight: 55032 },
			engine: "srclight",
			tool: "search_symbols",
			args: { symbol: "runtimeStart" },
		});

		expect(result.ok).toBe(true);
		expect(result.result).toEqual({ recovered: "sse" });
		expect(runtimeMock.reconnectBridge).toHaveBeenCalledTimes(1);
		expect(runtimeMock.callBridgeTool).toHaveBeenCalledTimes(2);
	});

	test("reconnects and retries once when the socket closes unexpectedly", async () => {
		runtimeMock.callBridgeTool
			.mockRejectedValueOnce(
				new Error(
					"The socket connection was closed unexpectedly. For more information, pass `verbose: true` in the second argument to fetch()",
				),
			)
			.mockResolvedValueOnce({
				ok: true,
				result: { recovered: "socket" },
			});
		runtimeMock.reconnectBridge.mockResolvedValueOnce({ ok: true });

		const result = await transport.invokeEngineTool({
			bridgePorts: { "codebase-memory-mcp": 55032 },
			engine: "codebase-memory-mcp",
			tool: "search_code",
			args: { pattern: "runtime status" },
		});

		expect(result.ok).toBe(true);
		expect(result.result).toEqual({ recovered: "socket" });
		expect(runtimeMock.reconnectBridge).toHaveBeenCalledTimes(1);
		expect(runtimeMock.callBridgeTool).toHaveBeenCalledTimes(2);
	});
});
