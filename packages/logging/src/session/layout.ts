import { join } from "node:path";

import { getMimirmeshDir } from "@mimirmesh/config";

import type { LogChannel } from "./types";

export const sessionLogFilenames: Record<LogChannel, string> = {
	cli: "cli.log",
	mcp: "mcp.log",
	runtime: "runtime.log",
	engines: "engines.log",
	"tool-calls": "tool-calls.log",
};

export const createSessionId = (): string =>
	`${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(16).slice(2, 8)}`;

export const nowIso = (): string => new Date().toISOString();

export const getLogLayout = (projectRoot: string, sessionId: string) => {
	const root = getMimirmeshDir(projectRoot);
	const logsDir = join(root, "logs");
	const sessionsDir = join(logsDir, "sessions");
	const sessionDir = join(sessionsDir, sessionId);
	const errorLog = join(logsDir, "error.log");
	return {
		logsDir,
		sessionsDir,
		sessionDir,
		errorLog,
	};
};
