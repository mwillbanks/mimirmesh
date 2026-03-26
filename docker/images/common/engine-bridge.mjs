#!/usr/bin/env node
import { spawn } from "node:child_process";
import http from "node:http";
import process from "node:process";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const bridgePort = Number.parseInt(process.env.MIMIRMESH_BRIDGE_PORT || "4701", 10);
const engineId = process.env.MIMIRMESH_ENGINE_ID || "unknown-engine";
const engineTransport = process.env.MIMIRMESH_ENGINE_TRANSPORT || "stdio";
const engineUrl = process.env.MIMIRMESH_ENGINE_URL || "";
const listTimeoutMs = Number.parseInt(process.env.MIMIRMESH_LIST_TIMEOUT_MS || "180000", 10);
const toolTimeoutMs = Number.parseInt(process.env.MIMIRMESH_TOOL_TIMEOUT_MS || "300000", 10);
const engineCommand = process.env.MIMIRMESH_ENGINE_CMD;
const engineArgs = (() => {
	try {
		return JSON.parse(process.env.MIMIRMESH_ENGINE_ARGS || "[]");
	} catch {
		return [];
	}
})();

const childEnv = { ...process.env };
delete childEnv.MIMIRMESH_ENGINE_CMD;
delete childEnv.MIMIRMESH_ENGINE_ARGS;
delete childEnv.MIMIRMESH_BRIDGE_PORT;
delete childEnv.MIMIRMESH_ENGINE_TRANSPORT;
delete childEnv.MIMIRMESH_ENGINE_URL;

const startedAt = Date.now();
let ready = false;
let lastError = null;
let discoveredTools = [];
let connecting = null;
let client = null;
let transport = null;
let childProcess = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const listToolsWithTimeout = async () => {
	if (!client) {
		throw new Error("MCP client is not connected");
	}

	return client.listTools(undefined, {
		timeout: listTimeoutMs,
		maxTotalTimeout: listTimeoutMs,
		resetTimeoutOnProgress: true,
	});
};

const callToolWithTimeout = async (tool, args) => {
	if (!client) {
		throw new Error("MCP client is not connected");
	}

	return client.callTool(
		{
			name: tool,
			arguments: args,
		},
		undefined,
		{
			timeout: toolTimeoutMs,
			maxTotalTimeout: toolTimeoutMs,
			resetTimeoutOnProgress: true,
		},
	);
};

const ensureCommandConfigured = () => {
	if (!engineCommand || typeof engineCommand !== "string") {
		throw new Error("MIMIRMESH_ENGINE_CMD is required");
	}
};

const ensureHttpConfigured = () => {
	if (!engineUrl || typeof engineUrl !== "string") {
		throw new Error("MIMIRMESH_ENGINE_URL is required for HTTP transports");
	}
};

const childRunning = () => Boolean(childProcess && childProcess.exitCode === null);

const closeTransport = async () => {
	try {
		if (client) {
			await client.close();
		}
	} catch {
		// ignore close failures
	}

	try {
		if (transport && typeof transport.terminateSession === "function") {
			await transport.terminateSession();
		}
	} catch {
		// ignore terminate failures
	}

	try {
		if (transport && typeof transport.close === "function") {
			await transport.close();
		}
	} catch {
		// ignore close failures
	}
};

const stopChild = async () => {
	if (!childProcess) {
		return;
	}

	const runningChild = childProcess;
	childProcess = null;

	if (runningChild.exitCode !== null) {
		return;
	}

	runningChild.kill("SIGTERM");
	await Promise.race([new Promise((resolve) => runningChild.once("exit", resolve)), sleep(2_000)]);

	if (runningChild.exitCode === null) {
		runningChild.kill("SIGKILL");
		await new Promise((resolve) => runningChild.once("exit", resolve));
	}
};

const startChildIfNeeded = () => {
	if (engineTransport === "stdio" || childRunning()) {
		return;
	}

	ensureCommandConfigured();

	const nextChild = spawn(engineCommand, Array.isArray(engineArgs) ? engineArgs : [], {
		cwd: process.env.MIMIRMESH_PROJECT_ROOT || process.cwd(),
		env: childEnv,
		stdio: ["ignore", "pipe", "pipe"],
	});

	nextChild.stdout?.on("data", (chunk) => {
		process.stderr.write(`[${engineId}] ${chunk}`);
	});

	nextChild.stderr?.on("data", (chunk) => {
		process.stderr.write(`[${engineId}] ${chunk}`);
	});

	nextChild.once("exit", (code, signal) => {
		ready = false;
		if (childProcess === nextChild) {
			childProcess = null;
		}
		lastError = code === 0 ? null : `engine exited (${signal ?? code ?? "unknown"})`;
	});

	childProcess = nextChild;
};

const closeClient = async () => {
	await closeTransport();
	client = null;
	transport = null;
	ready = false;
};

const connectHttpClient = async (baseUrl) => {
	const connectWith = async (nextTransport) => {
		const nextClient = new Client(
			{
				name: `mimirmesh-bridge-${engineId}`,
				version: "1.0.0",
			},
			{
				capabilities: {},
			},
		);

		await nextClient.connect(nextTransport);
		return { nextClient, nextTransport };
	};

	if (engineTransport === "sse") {
		return connectWith(new SSEClientTransport(baseUrl));
	}

	if (engineTransport === "streamable-http") {
		return connectWith(new StreamableHTTPClientTransport(baseUrl));
	}

	try {
		return await connectWith(new StreamableHTTPClientTransport(baseUrl));
	} catch {
		return connectWith(new SSEClientTransport(baseUrl));
	}
};

const connectClient = async () => {
	await closeClient();
	await stopChild();

	if (engineTransport === "stdio") {
		ensureCommandConfigured();

		const nextTransport = new StdioClientTransport({
			command: engineCommand,
			args: Array.isArray(engineArgs) ? engineArgs : [],
			env: childEnv,
			stderr: "pipe",
			cwd: process.env.MIMIRMESH_PROJECT_ROOT || process.cwd(),
		});

		const nextClient = new Client(
			{
				name: `mimirmesh-bridge-${engineId}`,
				version: "1.0.0",
			},
			{
				capabilities: {},
			},
		);

		nextTransport.stderr?.on("data", (chunk) => {
			process.stderr.write(`[${engineId}] ${chunk}`);
		});

		await nextClient.connect(nextTransport);

		transport = nextTransport;
		client = nextClient;
	} else {
		ensureHttpConfigured();
		startChildIfNeeded();

		const baseUrl = new URL(engineUrl);
		let connected = null;
		let connectError = null;

		for (let attempt = 0; attempt < 20; attempt += 1) {
			try {
				connected = await connectHttpClient(baseUrl);
				break;
			} catch (error) {
				connectError = error;
				await sleep(500);
			}
		}

		if (!connected) {
			throw connectError instanceof Error ? connectError : new Error(String(connectError));
		}

		transport = connected.nextTransport;
		client = connected.nextClient;
	}

	ready = true;
	lastError = null;
};

const ensureConnected = async () => {
	if (ready && client) {
		return;
	}
	if (!connecting) {
		connecting = connectClient()
			.catch((error) => {
				logError("ensureConnected: engine connection failed", error);
				ready = false;
				lastError = "Engine connection failed";
				throw error;
			})
			.finally(() => {
				connecting = null;
			});
	}
	await connecting;
};

const logError = (context, error) => {
	if (error instanceof Error && error.stack) {
		process.stderr.write(`${context}: ${error.stack}\n`);
	} else {
		process.stderr.write(`${context}: ${String(error)}\n`);
	}
};

export const sanitizeErrorMessage = (error) => {
	const raw = error instanceof Error ? error.message : String(error);
	// Return single-line error messages without stack traces or absolute paths.
	return raw
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith("at "))
		.join(" ");
};

export const toSafeJsonValue = (value, seen = new WeakSet()) => {
	if (typeof value === "bigint") {
		return value.toString();
	}

	if (value instanceof Error) {
		const safeError = {
			name: value.name,
			message: sanitizeErrorMessage(value),
		};
		if (typeof value.code === "string" || typeof value.code === "number") {
			safeError.code = value.code;
		}
		return safeError;
	}

	if (Array.isArray(value)) {
		return value.map((entry) => toSafeJsonValue(entry, seen));
	}

	if (typeof value === "object" && value !== null) {
		if (seen.has(value)) {
			return "[Circular]";
		}

		seen.add(value);
		const safeObject = {};
		for (const [key, entry] of Object.entries(value)) {
			if (key === "stack") {
				continue;
			}
			safeObject[key] = toSafeJsonValue(entry, seen);
		}
		seen.delete(value);
		return safeObject;
	}

	return value;
};

const jsonResponse = (res, statusCode, payload) => {
	res.writeHead(statusCode, {
		"content-type": "application/json",
		"cache-control": "no-store",
	});
	res.end(JSON.stringify(toSafeJsonValue(payload)));
};

const parseBody = async (req) => {
	const chunks = [];
	for await (const chunk of req) {
		chunks.push(chunk);
	}
	if (chunks.length === 0) {
		return {};
	}
	const raw = Buffer.concat(chunks).toString("utf8");
	if (!raw.trim()) {
		return {};
	}
	return JSON.parse(raw);
};

const handleHealth = async (_req, res) => {
	jsonResponse(res, 200, {
		ok: true,
		engine: engineId,
		ready,
		child: {
			running: engineTransport === "stdio" ? ready : childRunning(),
			transport: engineTransport,
			lastError,
			command: engineCommand,
		},
		discoveredToolCount: discoveredTools.length,
		uptimeMs: Date.now() - startedAt,
	});
};

const handleDiscover = async (_req, res) => {
	try {
		await ensureConnected();
		const tools = await listToolsWithTimeout();
		discoveredTools = tools.tools || [];
		jsonResponse(res, 200, {
			ok: true,
			engine: engineId,
			tools: discoveredTools.map((tool) => ({
				name: tool.name,
				description: tool.description,
				inputSchema: tool.inputSchema,
			})),
		});
	} catch (error) {
		logError("handleDiscover failed", error);
		ready = false;
		lastError = "Engine unavailable";
		jsonResponse(res, 503, {
			ok: false,
			engine: engineId,
			error: lastError,
			tools: [],
		});
	}
};

const handleCall = async (req, res) => {
	try {
		const body = await parseBody(req);
		const tool = typeof body.tool === "string" ? body.tool : "";
		const args = typeof body.args === "object" && body.args !== null ? body.args : {};

		if (!tool) {
			jsonResponse(res, 400, {
				ok: false,
				error: "'tool' is required",
			});
			return;
		}

		await ensureConnected();
		const result = await callToolWithTimeout(tool, args);

		jsonResponse(res, 200, {
			ok: true,
			result,
		});
	} catch (error) {
		logError("handleCall failed", error);
		ready = false;
		lastError = "Call to engine failed";
		jsonResponse(res, 502, {
			ok: false,
			error: lastError,
		});
	}
};

const server = http.createServer(async (req, res) => {
	try {
		if (req.url === "/health" && req.method === "GET") {
			await handleHealth(req, res);
			return;
		}

		if (req.url === "/discover" && req.method === "POST") {
			await handleDiscover(req, res);
			return;
		}

		if (req.url === "/call" && req.method === "POST") {
			await handleCall(req, res);
			return;
		}

		if (req.url === "/reconnect" && req.method === "POST") {
			await connectClient();
			jsonResponse(res, 200, {
				ok: true,
				engine: engineId,
			});
			return;
		}

		jsonResponse(res, 404, {
			ok: false,
			error: "Not Found",
		});
	} catch (error) {
		logError("Unhandled error in HTTP server", error);
		jsonResponse(res, 500, {
			ok: false,
			error: "Internal server error",
		});
	}
});

let shutdownHandlersRegistered = false;

const registerShutdownHandlers = () => {
	if (shutdownHandlersRegistered) {
		return;
	}

	shutdownHandlersRegistered = true;
	process.on("SIGINT", async () => {
		await closeClient();
		await stopChild();
		process.exit(0);
	});

	process.on("SIGTERM", async () => {
		await closeClient();
		await stopChild();
		process.exit(0);
	});
};

export const startBridge = async () => {
	registerShutdownHandlers();
	try {
		await ensureConnected();
	} catch (error) {
		logError("startBridge: initial connection failed", error);
		lastError = "Initial engine connection failed";
	}

	server.listen(bridgePort, "0.0.0.0", () => {
		process.stderr.write(`bridge:${engineId}:listening:${bridgePort}\n`);
	});
};

if (import.meta.main) {
	await startBridge();
}
