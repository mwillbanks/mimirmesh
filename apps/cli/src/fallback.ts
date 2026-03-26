import { render } from "ink";
import React from "react";
import type { ZodType } from "zod/v4";

import { type CommandHelpDefinition, formatCommandHelpLines } from "./lib/command-help";

type CommandModule = {
	default: React.ComponentType<never>;
	args?: ZodType<unknown>;
	help?: CommandHelpDefinition;
	options?: ZodType<unknown>;
};

const asCommandModule = (loader: () => Promise<unknown>): (() => Promise<CommandModule>) =>
	loader as () => Promise<CommandModule>;

const commandModules: Record<string, () => Promise<CommandModule>> = {
	"": asCommandModule(() => import("./commands/index")),
	install: asCommandModule(() => import("./commands/install/index")),
	refresh: asCommandModule(() => import("./commands/refresh")),
	doctor: asCommandModule(() => import("./commands/doctor")),
	upgrade: asCommandModule(() => import("./commands/upgrade")),
	update: asCommandModule(() => import("./commands/update")),
	"config/get": asCommandModule(() => import("./commands/config/get")),
	"config/set": asCommandModule(() => import("./commands/config/set")),
	"config/enable": asCommandModule(() => import("./commands/config/enable")),
	"config/disable": asCommandModule(() => import("./commands/config/disable")),
	"config/validate": asCommandModule(() => import("./commands/config/validate")),
	"runtime/start": asCommandModule(() => import("./commands/runtime/start")),
	"runtime/stop": asCommandModule(() => import("./commands/runtime/stop")),
	"runtime/restart": asCommandModule(() => import("./commands/runtime/restart")),
	"runtime/status": asCommandModule(() => import("./commands/runtime/status")),
	"runtime/refresh": asCommandModule(() => import("./commands/runtime/refresh")),
	"runtime/doctor": asCommandModule(() => import("./commands/runtime/doctor")),
	"runtime/upgrade": asCommandModule(() => import("./commands/runtime/upgrade/index")),
	"runtime/upgrade/status": asCommandModule(() => import("./commands/runtime/upgrade/status")),
	"runtime/upgrade/migrate": asCommandModule(() => import("./commands/runtime/upgrade/migrate")),
	"runtime/upgrade/repair": asCommandModule(() => import("./commands/runtime/upgrade/repair")),
	"mcp/list-tools": asCommandModule(() => import("./commands/mcp/list-tools")),
	"mcp/load-tools": asCommandModule(() => import("./commands/mcp/load-tools")),
	"mcp/tool": asCommandModule(() => import("./commands/mcp/tool")),
	"mcp/tool-schema": asCommandModule(() => import("./commands/mcp/tool-schema")),
	"note/add": asCommandModule(() => import("./commands/note/add")),
	"note/list": asCommandModule(() => import("./commands/note/list")),
	"note/search": asCommandModule(() => import("./commands/note/search")),
	"document/add": asCommandModule(() => import("./commands/document/add")),
	"report/generate": asCommandModule(() => import("./commands/report/generate")),
	"report/show": asCommandModule(() => import("./commands/report/show")),
	"install/ide": asCommandModule(() => import("./commands/install/ide")),
	"skills/install": asCommandModule(() => import("./commands/skills/install")),
	"skills/update": asCommandModule(() => import("./commands/skills/update")),
	"skills/remove": asCommandModule(() => import("./commands/skills/remove")),
	"speckit/init": asCommandModule(() => import("./commands/speckit/init")),
	"speckit/status": asCommandModule(() => import("./commands/speckit/status")),
	"speckit/doctor": asCommandModule(() => import("./commands/speckit/doctor")),
};

const commandKeys = Object.keys(commandModules).sort(
	(left, right) => right.split("/").length - left.split("/").length,
);

const print = (value: string): void => {
	process.stdout.write(`${value}\n`);
};

const printUsage = (): void => {
	print("mimirmesh");
	print("  Launch the interactive shell.");
	print("");
	print("Core commands:");
	print(
		"  mimirmesh install [--preset <preset>] [--areas core,ide,skills] [--ide <target>] [--skills all|name[,name]] [--non-interactive] [--json]",
	);
	print("  mimirmesh refresh [--non-interactive] [--json]");
	print("  mimirmesh doctor [--json]");
	print(
		"  mimirmesh runtime status|start|stop|restart|refresh|doctor [--non-interactive] [--json]",
	);
	print("  mimirmesh runtime upgrade [status|migrate|repair] [--non-interactive] [--json]");
	print("  mimirmesh mcp list-tools [--json]");
	print("  mimirmesh mcp load-tools <engine> [--non-interactive] [--json]");
	print("  mimirmesh mcp tool <tool> [json] [--non-interactive] [--json]");
	print("  mimirmesh mcp tool-schema <tool> [--view compressed|full|debug] [--json]");
	print("  mimirmesh install ide [--target <target>] [--non-interactive] [--json]");
	print("  mimirmesh skills install|update|remove [skill-name] [--non-interactive] [--json]");
	print("");
	print("Command-first workflows:");
	print("  mimirmesh config get|set|enable|disable|validate");
	print("  mimirmesh report generate|show");
	print("  mimirmesh note add|list|search");
	print("  mimirmesh document add");
	print("  mimirmesh speckit init|status|doctor");
	print("  mimirmesh update [--check]");
	print("  mimirmesh server");
};

const printCommandHelp = (help: CommandHelpDefinition): void => {
	for (const line of formatCommandHelpLines(help)) {
		print(line);
	}
};

const kebabToCamel = (value: string): string =>
	value.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());

const booleanFlags = new Set(["help", "json", "nonInteractive", "check"]);
const optionAliases: Record<string, string> = {
	h: "help",
	j: "json",
};

const parseTokens = (
	tokens: string[],
): { options: Record<string, unknown>; positionals: string[] } => {
	const options: Record<string, unknown> = {};
	const positionals: string[] = [];

	for (let index = 0; index < tokens.length; index += 1) {
		const token = tokens[index];
		if (!token) {
			continue;
		}

		if (token.startsWith("--")) {
			const body = token.slice(2);
			const [rawKey = "", inlineValue] = body.split("=");
			const key = kebabToCamel(rawKey);
			if (booleanFlags.has(key)) {
				options[key] = inlineValue ? inlineValue !== "false" : true;
				continue;
			}

			if (inlineValue !== undefined) {
				options[key] = inlineValue;
				continue;
			}

			const next = tokens[index + 1];
			if (next && !next.startsWith("-")) {
				options[key] = next;
				index += 1;
				continue;
			}

			options[key] = true;
			continue;
		}

		if (token.startsWith("-") && token.length > 1) {
			const alias = optionAliases[token.slice(1)];
			if (alias) {
				options[alias] = true;
				continue;
			}
		}

		positionals.push(token);
	}

	return { options, positionals };
};

const resolveCommand = (argv: string[]): { key: string; remaining: string[] } => {
	for (const key of commandKeys) {
		if (!key) {
			continue;
		}
		const parts = key.split("/");
		if (parts.every((part, index) => argv[index] === part)) {
			return {
				key,
				remaining: argv.slice(parts.length),
			};
		}
	}

	if (argv.length === 0 || argv[0]?.startsWith("-")) {
		return {
			key: "",
			remaining: argv,
		};
	}

	throw new Error(`Unknown command: ${argv.join(" ")}`);
};

const validateProps = (module: CommandModule, tokens: string[]): Record<string, unknown> => {
	const { options, positionals } = parseTokens(tokens);
	const props: Record<string, unknown> = {};

	if (module.options) {
		props.options = module.options.parse(options);
	}

	if (module.args) {
		props.args = module.args.parse(positionals);
	}

	return props;
};

const renderCommand = async (
	module: CommandModule,
	props: Record<string, unknown>,
): Promise<void> => {
	const app = render(
		React.createElement(module.default as React.ComponentType<Record<string, unknown>>, props),
	);
	await app.waitUntilExit();
};

export const runFallbackCli = async (argv: string[]): Promise<number> => {
	const [first] = argv;
	if (first === "--help" || first === "-h") {
		printUsage();
		return 0;
	}
	if (first === "--version" || first === "-v") {
		const packageJson = await Bun.file(new URL("../../package.json", import.meta.url)).json();
		print((packageJson as { version?: string }).version ?? "1.0.0");
		return 0;
	}
	if (first === "server") {
		const serverModule = await import("../../server/src/index.ts");
		await serverModule.startMcpServer(process.env.MIMIRMESH_PROJECT_ROOT ?? process.cwd());
		return 0;
	}

	try {
		const { key, remaining } = resolveCommand(argv);
		const loadModule = commandModules[key];
		if (!loadModule) {
			throw new Error(`No compiled command module is registered for ${key || "index"}.`);
		}
		const module = await loadModule();
		if (remaining.some((token) => token === "--help" || token === "-h") && module.help) {
			printCommandHelp(module.help);
			return 0;
		}
		const props = validateProps(module, remaining);
		await renderCommand(module, props);
		return 0;
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		return 1;
	}
};
