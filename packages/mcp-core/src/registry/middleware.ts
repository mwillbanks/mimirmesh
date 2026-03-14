import type { LogChannel } from "@mimirmesh/logging";
import type { ToolExecutor, ToolMiddleware } from "../types";

export const applyMiddleware = (
	middlewares: ToolMiddleware[],
	terminal: ToolExecutor,
): ToolExecutor =>
	middlewares.reduceRight<ToolExecutor>((next, middleware) => {
		return async (context) => middleware(context, next);
	}, terminal);

export const timingMiddleware = (logger?: {
	log: (
		channel: LogChannel,
		level: "debug" | "info" | "warn" | "error",
		message: string,
	) => Promise<void>;
}): ToolMiddleware => {
	return async (context, next) => {
		const startedAt = performance.now();
		const result = await next(context);
		const durationMs = Math.round(performance.now() - startedAt);
		await logger?.log("tool-calls", "info", `${context.toolName} completed in ${durationMs}ms`);
		return {
			...result,
			warnings: [...result.warnings, `duration_ms=${durationMs}`],
			warningCodes: [...result.warningCodes],
		};
	};
};

export const errorNormalizationMiddleware = (logger?: {
	error: (message: string, details?: string) => Promise<void>;
}): ToolMiddleware => {
	return async (context, next) => {
		try {
			return await next(context);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await logger?.error(`Tool ${context.toolName} failed`, message);
			return {
				tool: context.toolName,
				success: false,
				message,
				items: [],
				provenance: [],
				degraded: true,
				warnings: ["Tool execution failed."],
				warningCodes: [],
				raw: {
					error: message,
				},
			};
		}
	};
};
