import { access, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { McpCompressionLevel } from "@mimirmesh/config";
import { z } from "zod";

import { writeJson } from "./io";
import { mcpServerStatePath, mcpSessionStatePath } from "./paths";

const buildManifestSchema = z.object({
	version: z.string().min(1),
	builtAt: z.string().min(1),
	buildId: z.string().min(1),
	artifacts: z.array(z.string()).default([]),
});

const mcpServerSessionSchema = z.object({
	pid: z.number().int().positive(),
	sessionId: z.string().min(1).default("mcp-server"),
	startedAt: z.string().min(1),
	version: z.string().min(1),
	builtAt: z.string().min(1),
	buildId: z.string().min(1),
	executablePath: z.string().min(1),
	manifestPath: z.string().min(1).nullable().default(null),
});

const mcpLazyLoadDiagnosticSchema = z.object({
	sessionId: z.string().min(1),
	engineId: z.enum(["srclight", "document-mcp", "mcp-adr-analysis-server"]),
	trigger: z.enum(["explicit-load", "tool-invocation", "refresh"]),
	startedAt: z.string().min(1),
	completedAt: z.string().min(1),
	outcome: z.enum(["success", "degraded", "failed"]),
	discoveredToolCount: z.number().int().nonnegative(),
	diagnostics: z.array(z.string()).default([]),
	notificationSent: z.boolean().default(false),
});

const mcpToolSurfaceSessionSchema = z.object({
	sessionId: z.string().min(1),
	policyVersion: z.string().min(1),
	compressionLevel: z.enum(["minimal", "balanced", "aggressive"]),
	loadedEngineGroups: z
		.array(z.enum(["srclight", "document-mcp", "mcp-adr-analysis-server"]))
		.default([]),
	lastNotificationAt: z.string().min(1).nullable().default(null),
	lastLoadedAt: z.string().min(1).nullable().default(null),
	lastUpdatedAt: z.string().min(1),
	lazyLoadDiagnostics: z.array(mcpLazyLoadDiagnosticSchema).default([]),
});

export type BuildManifest = z.infer<typeof buildManifestSchema>;
export type McpServerSession = z.infer<typeof mcpServerSessionSchema>;
export type McpLazyLoadDiagnostic = z.infer<typeof mcpLazyLoadDiagnosticSchema>;
export type McpToolSurfaceSession = z.infer<typeof mcpToolSurfaceSessionSchema>;

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

export const createDefaultMcpToolSurfaceSession = (options: {
	sessionId: string;
	policyVersion: string;
	compressionLevel: McpCompressionLevel;
}): McpToolSurfaceSession => ({
	sessionId: options.sessionId,
	policyVersion: options.policyVersion,
	compressionLevel: options.compressionLevel,
	loadedEngineGroups: [],
	lastNotificationAt: null,
	lastLoadedAt: null,
	lastUpdatedAt: new Date().toISOString(),
	lazyLoadDiagnostics: [],
});

export const persistMcpToolSurfaceSession = async (
	projectRoot: string,
	session: McpToolSurfaceSession,
): Promise<void> => {
	await writeJson(mcpSessionStatePath(projectRoot, session.sessionId), session);
};

export const loadMcpToolSurfaceSession = async (
	projectRoot: string,
	sessionId: string,
): Promise<McpToolSurfaceSession | null> => {
	try {
		const parsed = JSON.parse(
			await readFile(mcpSessionStatePath(projectRoot, sessionId), "utf8"),
		) as unknown;
		const validated = mcpToolSurfaceSessionSchema.safeParse(parsed);
		return validated.success ? validated.data : null;
	} catch {
		return null;
	}
};

export const clearMcpToolSurfaceSession = async (
	projectRoot: string,
	sessionId: string,
): Promise<void> => {
	await rm(mcpSessionStatePath(projectRoot, sessionId), { force: true });
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
