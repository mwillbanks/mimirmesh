import { afterEach, describe, expect, test } from "bun:test";

import { createTextEmbedding, createTextEmbeddings } from "../src";

const activeServers: Array<ReturnType<typeof Bun.serve>> = [];

afterEach(async () => {
	while (activeServers.length > 0) {
		await activeServers.pop()?.stop(true);
	}
});

const startEmbeddingServer = (resolveVector: (input: string) => number[]): { baseUrl: string } => {
	const server = Bun.serve({
		port: 0,
		async fetch(request) {
			if (request.method !== "POST" || !new URL(request.url).pathname.endsWith("/embeddings")) {
				return new Response("not found", { status: 404 });
			}

			const body = (await request.json()) as {
				input?: string | string[];
				model?: string;
			};
			const inputs = Array.isArray(body.input)
				? body.input
				: typeof body.input === "string"
					? [body.input]
					: [];
			return Response.json({
				object: "list",
				model: body.model ?? "test-embedding-model",
				data: inputs.map((input, index) => ({
					object: "embedding",
					index,
					embedding: resolveVector(input),
				})),
				usage: {
					prompt_tokens: inputs.length,
					total_tokens: inputs.length,
				},
			});
		},
	});
	activeServers.push(server);
	return {
		baseUrl: `http://127.0.0.1:${server.port}/v1`,
	};
};

describe("skill embeddings", () => {
	test("requests embeddings through an OpenAI-compatible provider", async () => {
		const server = startEmbeddingServer((input) =>
			input.includes("semantic") ? [1, 0, 0] : [0, 1, 0],
		);

		const result = await createTextEmbeddings({
			inputs: ["semantic intent", "fallback intent"],
			enabled: true,
			providers: [
				{
					type: "lm_studio",
					model: "text-embedding-nomic-embed-text-v1.5",
					baseUrl: server.baseUrl,
					timeoutMs: 30_000,
					maxRetries: 0,
				},
			],
		});

		expect(result?.providerType).toBe("lm_studio");
		expect(result?.dims).toBe(3);
		expect(result?.vectors).toEqual([
			[1, 0, 0],
			[0, 1, 0],
		]);
	});

	test("falls back across providers when the first OpenAI-compatible endpoint fails", async () => {
		const working = startEmbeddingServer(() => [0.25, 0.75]);

		const result = await createTextEmbedding({
			input: "semantic retry",
			enabled: true,
			fallbackOnFailure: true,
			providers: [
				{
					type: "openai_compatible_remote",
					model: "broken",
					baseUrl: "http://127.0.0.1:1/v1",
					apiKey: "test-key",
					timeoutMs: 250,
					maxRetries: 0,
				},
				{
					type: "lm_studio",
					model: "text-embedding-nomic-embed-text-v1.5",
					baseUrl: working.baseUrl,
					timeoutMs: 30_000,
					maxRetries: 0,
				},
			],
		});

		expect(result?.providerType).toBe("lm_studio");
		expect(result?.vector).toEqual([0.25, 0.75]);
		expect(result?.diagnostics.some((entry) => entry.includes("openai_compatible_remote"))).toBe(
			true,
		);
	});
});
