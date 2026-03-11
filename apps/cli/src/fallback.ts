import {
	addDocument,
	addNote,
	applyUpdate,
	configDisableEngine,
	configEnableEngine,
	configGet,
	configSet,
	configValidate,
	doctorProject,
	generateReports,
	initializeProject,
	installIde,
	listNotes,
	loadCliContext,
	mcpCallTool,
	mcpListTools,
	refreshProject,
	runtimeAction,
	runtimeDoctor,
	runtimeUpgradeMigrate,
	runtimeUpgradeRepair,
	runtimeUpgradeStatus,
	searchNotes,
	setupProject,
	showReport,
	speckitDoctor,
	speckitInit,
	speckitStatus,
	updateCheck,
} from "./lib/context";

const print = (value: unknown): void => {
	if (typeof value === "string") {
		process.stdout.write(`${value}\n`);
		return;
	}
	process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

const printUsage = (): void => {
	print([
		"mimirmesh commands:",
		"  init",
		"  setup",
		"  refresh",
		"  doctor",
		"  upgrade",
		"  config get|set|enable|disable|validate",
		"  runtime start|stop|restart|status|refresh|doctor|upgrade",
		"  mcp list-tools|tool",
		"  note add|list|search",
		"  document add",
		"  report generate|show",
		"  install ide",
		"  update [--check]",
		"  speckit init|status|doctor",
		"  server",
	]);
};

const parseUpdateCheck = (args: string[]): boolean => args.includes("--check");

const parseJsonArg = (value: string | undefined): Record<string, unknown> => {
	if (!value) {
		return {};
	}
	const parsed = JSON.parse(value) as unknown;
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error("JSON argument must be an object.");
	}
	return parsed as Record<string, unknown>;
};

export const runFallbackCli = async (argv: string[]): Promise<number> => {
	const [command, ...rest] = argv;
	if (!command || command === "--help" || command === "-h") {
		printUsage();
		return 0;
	}
	if (command === "--version" || command === "-v") {
		const packageJson = await Bun.file(new URL("../../package.json", import.meta.url)).json();
		print((packageJson as { version?: string }).version ?? "1.0.0");
		return 0;
	}
	if (command === "server") {
		const serverModule = await import("../../server/src/index.ts");
		await serverModule.startMcpServer(process.env.MIMIRMESH_PROJECT_ROOT ?? process.cwd());
		return 0;
	}

	const context = await loadCliContext();

	try {
		if (command === "init") {
			const result = await initializeProject(context);
			print(result);
			return 0;
		}
		if (command === "setup") {
			print(await setupProject(context));
			return 0;
		}
		if (command === "refresh") {
			print(await refreshProject(context));
			return 0;
		}
		if (command === "doctor") {
			print(await doctorProject(context));
			return 0;
		}

		if (command === "upgrade") {
			print(await runtimeUpgradeMigrate(context));
			return 0;
		}

		if (command === "config") {
			const [sub, ...args] = rest;
			if (sub === "get") {
				print(await configGet(context, args[0] ?? ""));
				return 0;
			}
			if (sub === "set") {
				if (!args[0] || !args[1]) {
					throw new Error("Usage: mimirmesh config set <path> <value>");
				}
				await configSet(context, args[0], args[1]);
				print(`Updated ${args[0]}`);
				return 0;
			}
			if (sub === "enable") {
				if (!args[0]) {
					throw new Error("Usage: mimirmesh config enable <engine>");
				}
				await configEnableEngine(context, args[0] as never);
				print(`Enabled ${args[0]}`);
				return 0;
			}
			if (sub === "disable") {
				if (!args[0]) {
					throw new Error("Usage: mimirmesh config disable <engine>");
				}
				await configDisableEngine(context, args[0] as never);
				print(`Disabled ${args[0]}`);
				return 0;
			}
			if (sub === "validate") {
				print(await configValidate(context));
				return 0;
			}
			throw new Error("Unknown config subcommand.");
		}

		if (command === "runtime") {
			const [sub, nested] = rest;
			if (sub === "doctor") {
				print(await runtimeDoctor(context));
				return 0;
			}
			if (sub === "upgrade") {
				if (!nested || nested === "status") {
					print(await runtimeUpgradeStatus(context));
					return 0;
				}
				if (nested === "migrate") {
					print(await runtimeUpgradeMigrate(context));
					return 0;
				}
				if (nested === "repair") {
					print(await runtimeUpgradeRepair(context));
					return 0;
				}
				throw new Error("Usage: mimirmesh runtime upgrade <status|migrate|repair>");
			}
			if (!sub || !["start", "stop", "restart", "status", "refresh"].includes(sub)) {
				throw new Error(
					"Usage: mimirmesh runtime <start|stop|restart|status|refresh|doctor|upgrade>",
				);
			}
			print(
				await runtimeAction(context, sub as "start" | "stop" | "restart" | "status" | "refresh"),
			);
			return 0;
		}

		if (command === "mcp") {
			const [sub, ...args] = rest;
			if (sub === "list-tools") {
				print(await mcpListTools(context));
				return 0;
			}
			if (sub === "tool") {
				if (!args[0]) {
					throw new Error("Usage: mimirmesh mcp tool <tool> [json]");
				}
				print(await mcpCallTool(context, args[0], parseJsonArg(args[1])));
				return 0;
			}
			throw new Error("Unknown mcp subcommand.");
		}

		if (command === "note") {
			const [sub, ...args] = rest;
			if (sub === "add") {
				if (!args[0] || !args[1]) {
					throw new Error("Usage: mimirmesh note add <title> <content>");
				}
				print(await addNote(context, args[0], args.slice(1).join(" ")));
				return 0;
			}
			if (sub === "list") {
				print(await listNotes(context));
				return 0;
			}
			if (sub === "search") {
				if (!args[0]) {
					throw new Error("Usage: mimirmesh note search <query>");
				}
				print(await searchNotes(context, args.join(" ")));
				return 0;
			}
			throw new Error("Unknown note subcommand.");
		}

		if (command === "document") {
			const [sub, ...args] = rest;
			if (sub !== "add" || !args[0]) {
				throw new Error("Usage: mimirmesh document add <path>");
			}
			print(await addDocument(context, args[0]));
			return 0;
		}

		if (command === "report") {
			const [sub, ...args] = rest;
			if (sub === "generate") {
				print(await generateReports(context));
				return 0;
			}
			if (sub === "show") {
				if (!args[0]) {
					throw new Error("Usage: mimirmesh report show <name>");
				}
				print(await showReport(context, args[0]));
				return 0;
			}
			throw new Error("Unknown report subcommand.");
		}

		if (command === "install") {
			const [sub, ...args] = rest;
			if (sub !== "ide") {
				throw new Error("Usage: mimirmesh install ide [target]");
			}
			print(await installIde(context, (args[0] as never) ?? "vscode"));
			return 0;
		}

		if (command === "update") {
			if (parseUpdateCheck(rest)) {
				print(await updateCheck(context));
				return 0;
			}
			print(await applyUpdate(context));
			return 0;
		}

		if (command === "speckit") {
			const [sub] = rest;
			if (sub === "init") {
				print(await speckitInit(context));
				return 0;
			}
			if (sub === "status") {
				print(await speckitStatus(context));
				return 0;
			}
			if (sub === "doctor") {
				print(await speckitDoctor(context));
				return 0;
			}
			throw new Error("Unknown speckit subcommand.");
		}

		printUsage();
		return 1;
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		return 1;
	}
};
