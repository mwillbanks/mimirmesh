import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultConfig } from "@mimirmesh/config";
import { startSkillRegistryRuntime } from "../../../../tests/_helpers/skills-runtime";
import {
	createSkillRegistryState,
	ensureSkillRegistryState,
	loadSkillRegistrySnapshot,
	loadSkillRegistryState,
	persistSkillRegistryState,
	refreshSkillRegistryStore,
	resolveSkillRegistryEmbeddingMatches,
	skillRegistryStatePath,
} from "../../src";

const createdRoots: string[] = [];
const activeServers: Array<ReturnType<typeof Bun.serve>> = [];

const createRepoSkill = async (
	projectRoot: string,
	name: string,
	description: string,
): Promise<void> => {
	const skillRoot = join(projectRoot, ".agents", "skills", name);
	await mkdir(skillRoot, { recursive: true });
	await writeFile(
		join(skillRoot, "SKILL.md"),
		`---
name: ${name}
description: ${description}
---

# ${name}

## Steps
- Use for ${description}
`,
		"utf8",
	);
};

afterEach(async () => {
	while (activeServers.length > 0) {
		await activeServers.pop()?.stop(true);
	}
	await Promise.all(
		createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
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
				model: body.model ?? "text-embedding-nomic-embed-text-v1.5",
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

describe("skill registry state store", () => {
	test("persists and reloads the skill registry state deterministically", async () => {
		const repo = await mkdtemp(join(tmpdir(), "mimirmesh-skill-registry-"));
		createdRoots.push(repo);

		const config = createDefaultConfig(repo);
		const state = createSkillRegistryState(repo, config);

		await persistSkillRegistryState(repo, state);

		const loaded = await loadSkillRegistryState(repo);
		expect(loaded).toMatchObject({
			projectRoot: repo,
			configHash: state.configHash,
			bootstrap: {
				state: "ready",
				hostGpuAvailable: false,
			},
			providerSelection: {
				enabled: false,
				readiness: "ready",
			},
			skills: [],
			positiveCache: [],
			negativeCache: [],
			embeddings: [],
			lastIndexedAt: null,
		});
		expect(await Bun.file(skillRegistryStatePath(repo)).exists()).toBe(true);
	});

	test("reuses the persisted skill registry state when config inputs are unchanged", async () => {
		const repo = await mkdtemp(join(tmpdir(), "mimirmesh-skill-registry-reuse-"));
		createdRoots.push(repo);

		const config = createDefaultConfig(repo);
		const first = await ensureSkillRegistryState(repo, config);
		const second = await ensureSkillRegistryState(repo, config);

		expect(second.updatedAt).toBe(first.updatedAt);
		expect(second.configHash).toBe(first.configHash);
		expect(second.providerSelection).toEqual(first.providerSelection);
	});

	test("refresh indexes skills and builds default memory cache entries", async () => {
		const repo = await mkdtemp(join(tmpdir(), "mimirmesh-skill-registry-refresh-"));
		createdRoots.push(repo);
		await createRepoSkill(repo, "runtime-refresh-skill", "Runtime refresh");
		const config = createDefaultConfig(repo);
		const runtime = await startSkillRegistryRuntime(repo, config);
		if (!runtime.available) {
			return;
		}

		try {
			const refreshed = await refreshSkillRegistryStore(repo, config);
			const loaded = await loadSkillRegistrySnapshot(repo, config);

			expect(refreshed.response.refreshedSkills).toContain("runtime-refresh-skill");
			expect(refreshed.response.runtimeReadiness.stateArtifactPaths).toEqual([
				skillRegistryStatePath(repo),
			]);
			expect(loaded.skills.map((skill) => skill.name)).toContain("runtime-refresh-skill");
			const cachedSkill = loaded.positiveCache.find(
				(entry) => entry.skillName === "runtime-refresh-skill",
			);
			expect(cachedSkill?.payload.mode).toBe("memory");
			expect(loaded.lastIndexedAt).toBeString();
		} finally {
			await runtime.stop();
		}
	}, 120_000);

	test("targeted refresh invalidates stale positive and negative cache assumptions", async () => {
		const repo = await mkdtemp(join(tmpdir(), "mimirmesh-skill-registry-invalidation-"));
		createdRoots.push(repo);
		await createRepoSkill(repo, "runtime-invalidated-skill", "Original description");
		const config = createDefaultConfig(repo);
		const runtime = await startSkillRegistryRuntime(repo, config);
		if (!runtime.available) {
			return;
		}

		try {
			await refreshSkillRegistryStore(repo, config);
			await refreshSkillRegistryStore(repo, config, {
				names: ["runtime-missing-skill"],
			});
			await createRepoSkill(repo, "runtime-invalidated-skill", "Updated description");

			const refreshed = await refreshSkillRegistryStore(repo, config, {
				names: ["runtime-invalidated-skill", "runtime-missing-skill"],
			});
			const loaded = await loadSkillRegistrySnapshot(repo, config);

			expect(refreshed.response.invalidatedPositiveCacheEntries).toBeGreaterThanOrEqual(1);
			expect(refreshed.response.invalidatedNegativeCacheEntries).toBeGreaterThanOrEqual(1);
			expect(loaded.negativeCache.map((entry) => entry.lookupKey)).toContain(
				"runtime-missing-skill",
			);
			expect(
				loaded.positiveCache.some((entry) => entry.skillName === "runtime-invalidated-skill"),
			).toBe(true);
		} finally {
			await runtime.stop();
		}
	}, 120_000);

	test("repository refresh clears stale negative-cache entries for the addressed repository", async () => {
		const repo = await mkdtemp(join(tmpdir(), "mimirmesh-skill-registry-negative-cache-"));
		createdRoots.push(repo);
		const config = createDefaultConfig(repo);
		const runtime = await startSkillRegistryRuntime(repo, config);
		if (!runtime.available) {
			return;
		}

		try {
			await refreshSkillRegistryStore(repo, config, {
				names: ["repo-refresh-skill"],
			});
			let loaded = await loadSkillRegistrySnapshot(repo, config);
			expect(loaded.negativeCache.map((entry) => entry.lookupKey)).toContain("repo-refresh-skill");

			await createRepoSkill(repo, "repo-refresh-skill", "Appears after repository refresh");
			const refreshed = await refreshSkillRegistryStore(repo, config);
			loaded = await loadSkillRegistrySnapshot(repo, config);

			expect(refreshed.response.invalidatedNegativeCacheEntries).toBeGreaterThanOrEqual(1);
			expect(loaded.negativeCache.map((entry) => entry.lookupKey)).not.toContain(
				"repo-refresh-skill",
			);
			expect(loaded.skills.map((skill) => skill.name)).toContain("repo-refresh-skill");
		} finally {
			await runtime.stop();
		}
	}, 120_000);

	test("reindexes embeddings through an OpenAI-compatible provider and queries persisted vectors", async () => {
		const repo = await mkdtemp(join(tmpdir(), "mimirmesh-skill-registry-embeddings-"));
		createdRoots.push(repo);
		await createRepoSkill(repo, "semantic-router", "Semantic router guidance");
		await createRepoSkill(repo, "build-helper", "Build helper guidance");
		const embeddingServer = startEmbeddingServer((input) => {
			if (input.includes("semantic-router") || input.includes("semantic intent")) {
				return [1, 0, 0];
			}
			return [0, 1, 0];
		});
		const config = createDefaultConfig(repo);
		config.skills.embeddings.enabled = true;
		config.skills.embeddings.providers = [
			{
				type: "lm_studio",
				model: "text-embedding-nomic-embed-text-v1.5",
				baseUrl: embeddingServer.baseUrl,
				timeoutMs: 30_000,
				maxRetries: 0,
			},
		];
		const runtime = await startSkillRegistryRuntime(repo, config);
		if (!runtime.available) {
			return;
		}

		try {
			const refreshed = await refreshSkillRegistryStore(repo, config, {
				reindexEmbeddings: true,
			});
			const matches = await resolveSkillRegistryEmbeddingMatches(repo, config, {
				prompt: "semantic intent for router guidance",
				limit: 1,
			});

			expect(refreshed.response.embeddingsReindexed).toBeGreaterThanOrEqual(2);
			expect(matches.matches[0]?.name).toBe("semantic-router");
			expect(matches.matches[0]?.score).toBeGreaterThan(0.9);
		} finally {
			await runtime.stop();
		}
	}, 120_000);
});
