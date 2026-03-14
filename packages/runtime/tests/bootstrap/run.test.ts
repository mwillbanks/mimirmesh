import { beforeEach, describe, expect, mock, test } from "bun:test";

const bridgeMock = {
	callBridgeTool: mock(
		async (): Promise<{ ok: boolean; result?: unknown; error?: string }> => ({ ok: true }),
	),
	reconnectBridge: mock(async (): Promise<{ ok: boolean }> => ({ ok: true })),
};

mock.module("../../src/services/bridge", () => bridgeMock);

const { callBootstrapToolWithRetry } = await import("../../src/bootstrap/run");

describe("callBootstrapToolWithRetry", () => {
	beforeEach(() => {
		bridgeMock.callBridgeTool.mockReset();
		bridgeMock.reconnectBridge.mockReset();
	});

	test("retries tool bootstrap calls after a transient socket close", async () => {
		bridgeMock.callBridgeTool
			.mockRejectedValueOnce(
				new Error(
					"The socket connection was closed unexpectedly. For more information, pass `verbose: true` in the second argument to fetch()",
				),
			)
			.mockResolvedValueOnce({ ok: true, result: { indexed: true } });
		bridgeMock.reconnectBridge.mockResolvedValue({ ok: true });

		await expect(
			callBootstrapToolWithRetry("http://127.0.0.1:55014", "index_repository", {
				repo_path: "/workspace",
				mode: "fast",
			}),
		).resolves.toBeUndefined();

		expect(bridgeMock.reconnectBridge).toHaveBeenCalledTimes(1);
		expect(bridgeMock.callBridgeTool).toHaveBeenCalledTimes(2);
	});
});
