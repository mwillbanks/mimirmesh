import { access, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";

import { writeJson } from "./io";
import { mcpServerStatePath } from "./paths";

const buildManifestSchema = z.object({
	version: z.string().min(1),
	builtAt: z.string().min(1),
	buildId: z.string().min(1),
	artifacts: z.array(z.string()).default([]),
});

const mcpServerSessionSchema = z.object({
	pid: z.number().int().positive(),
	startedAt: z.string().min(1),
	version: z.string().min(1),
	builtAt: z.string().min(1),
	buildId: z.string().min(1),
	executablePath: z.string().min(1),
	manifestPath: z.string().min(1).nullable().default(null),
});

export type BuildManifest = z.infer<typeof buildManifestSchema>;
export type McpServerSession = z.infer<typeof mcpServerSessionSchema>;

const pathExists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

const loadBuildManifestFromPath = async (path: string): Promise<BuildManifest | null> => {
	try {
		const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
		const validated = buildManifestSchema.safeParse(parsed);
		return validated.success ? validated.data : null;
	} catch {
		return null;
	}
};

const manifestCandidates = (projectRoot: string, executablePath = process.execPath): string[] => {
	const executableDir = dirname(resolve(executablePath));
	return [
		join(projectRoot, "dist", "manifest.json"),
		join(executableDir, "manifest.json"),
		join(process.cwd(), "dist", "manifest.json"),
	];
};

export const loadLatestBuildManifest = async (
	projectRoot: string,
	executablePath = process.execPath,
): Promise<{ manifest: BuildManifest; path: string } | null> => {
	for (const candidate of manifestCandidates(projectRoot, executablePath)) {
		const manifest = await loadBuildManifestFromPath(candidate);
		if (manifest) {
			return {
				manifest,
				path: candidate,
			};
		}
	}

	return null;
};

export const loadExecutableBuildManifest = async (
	projectRoot: string,
	executablePath = process.execPath,
): Promise<{ manifest: BuildManifest; path: string } | null> => {
	const executableCandidate = join(dirname(resolve(executablePath)), "manifest.json");
	const manifest = await loadBuildManifestFromPath(executableCandidate);
	if (manifest) {
		return {
			manifest,
			path: executableCandidate,
		};
	}

	return loadLatestBuildManifest(projectRoot, executablePath);
};

export const persistMcpServerSession = async (
	projectRoot: string,
	session: McpServerSession,
): Promise<void> => {
	await writeJson(mcpServerStatePath(projectRoot), session);
};

export const loadMcpServerSession = async (
	projectRoot: string,
): Promise<McpServerSession | null> => {
	try {
		const parsed = JSON.parse(await readFile(mcpServerStatePath(projectRoot), "utf8")) as unknown;
		const validated = mcpServerSessionSchema.safeParse(parsed);
		return validated.success ? validated.data : null;
	} catch {
		return null;
	}
};

export const clearMcpServerSession = async (
	projectRoot: string,
	expectedPid?: number,
): Promise<void> => {
	if (expectedPid) {
		const session = await loadMcpServerSession(projectRoot);
		if (session && session.pid !== expectedPid) {
			return;
		}
	}
	await rm(mcpServerStatePath(projectRoot), { force: true });
};

export const isProcessRunning = (pid: number): boolean => {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
};

export const detectMcpServerStaleness = async (
	projectRoot: string,
	executablePath = process.execPath,
): Promise<
	| {
			state: "current";
			session: McpServerSession;
			latest: BuildManifest;
			latestManifestPath: string;
	  }
	| {
			state: "stale";
			session: McpServerSession;
			latest: BuildManifest;
			latestManifestPath: string;
	  }
	| {
			state: "inactive" | "unknown";
			session: McpServerSession | null;
			latest: BuildManifest | null;
			latestManifestPath: string | null;
	  }
> => {
	const [session, latestManifest] = await Promise.all([
		loadMcpServerSession(projectRoot),
		loadLatestBuildManifest(projectRoot, executablePath),
	]);

	if (!session || !isProcessRunning(session.pid)) {
		return {
			state: "inactive",
			session,
			latest: latestManifest?.manifest ?? null,
			latestManifestPath: latestManifest?.path ?? null,
		};
	}

	if (!latestManifest) {
		return {
			state: "unknown",
			session,
			latest: null,
			latestManifestPath: null,
		};
	}

	return {
		state: session.buildId === latestManifest.manifest.buildId ? "current" : "stale",
		session,
		latest: latestManifest.manifest,
		latestManifestPath: latestManifest.path,
	};
};

export const hasLatestBuildManifest = async (
	projectRoot: string,
	executablePath = process.execPath,
): Promise<boolean> => {
	const latestManifest = await loadLatestBuildManifest(projectRoot, executablePath);
	return latestManifest !== null && (await pathExists(latestManifest.path));
};
