import { callTool, listTools } from "./orchestration/tools";

const parseJson = (raw: string): Record<string, unknown> => {
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
	} catch {
		// handled below
	}
	throw new Error("Input must be a valid JSON object.");
};

const main = async (): Promise<void> => {
	const [command, ...rest] = process.argv.slice(2);
	const projectRoot = process.env.MIMIRMESH_PROJECT_ROOT ?? process.cwd();

	if (command === "list-tools") {
		const tools = await listTools(projectRoot);
		process.stdout.write(`${JSON.stringify(tools, null, 2)}\n`);
		return;
	}

	if (command === "tool") {
		const [toolName, inputJson = "{}"] = rest;
		if (!toolName) {
			throw new Error("Usage: mimirmesh-client tool <tool-name> [json-input]");
		}
		const args = parseJson(inputJson);
		const result = await callTool(projectRoot, toolName, args);
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
		return;
	}

	process.stdout.write(
		["mimirmesh-client commands:", "  list-tools", "  tool <tool-name> [json-input]"].join("\n") +
			"\n",
	);
};

if (import.meta.main) {
	await main();
}
