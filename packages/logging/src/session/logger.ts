import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { appendLogLine } from "../appenders/file";
import { redactSecrets } from "../redaction";
import { createSessionId, getLogLayout, nowIso, sessionLogFilenames } from "./layout";
import type { LogChannel, LoggerOptions, ProjectLogger } from "./types";

const ensureLogDirs = async (projectRoot: string, sessionId: string): Promise<void> => {
	const layout = getLogLayout(projectRoot, sessionId);
	await mkdir(layout.sessionDir, { recursive: true });
};

const createSessionWriter = async (options: {
	projectRoot: string;
	sessionId: string;
	redactPatterns: string[];
	enabled: boolean;
}) => {
	const layout = getLogLayout(options.projectRoot, options.sessionId);

	return async (
		channel: LogChannel,
		level: "debug" | "info" | "warn" | "error",
		message: string,
	): Promise<void> => {
		if (!options.enabled) {
			return;
		}
		const sanitized = redactSecrets(message, options.redactPatterns);
		const line = `${nowIso()} ${level.toUpperCase()} ${sanitized}\n`;
		const filePath = join(layout.sessionDir, sessionLogFilenames[channel]);
		await appendLogLine(filePath, line);
	};
};

const createErrorWriter = (options: {
	projectRoot: string;
	sessionId: string;
	redactPatterns: string[];
}) => {
	const layout = getLogLayout(options.projectRoot, options.sessionId);

	return async (message: string, details?: string): Promise<void> => {
		const combined = details ? `${message}\n${details}` : message;
		const sanitized = redactSecrets(combined, options.redactPatterns);
		const line = `${nowIso()} ERROR ${sanitized}\n`;
		await appendLogLine(layout.errorLog, line);
	};
};

export const createProjectLogger = async ({
	projectRoot,
	config,
	sessionId = createSessionId(),
}: LoggerOptions): Promise<ProjectLogger> => {
	await ensureLogDirs(projectRoot, sessionId);

	const log = await createSessionWriter({
		projectRoot,
		sessionId,
		redactPatterns: config.logging.redactPatterns,
		enabled: config.logging.sessionLogging,
	});
	const error = createErrorWriter({
		projectRoot,
		sessionId,
		redactPatterns: config.logging.redactPatterns,
	});

	return {
		sessionId,
		log,
		error,
	};
};
