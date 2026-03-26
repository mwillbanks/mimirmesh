import type { CommandHelpDefinition } from "./command-help";

export const installHelpRows = [
	{
		flag: "--preset <minimal|recommended|full>",
		description: "Start from a documented install preset.",
	},
	{
		flag: "--areas <core,ide,skills>",
		description: "Override the preset and choose the install areas explicitly.",
	},
	{
		flag: "--ide <target[,target]>",
		description: "Choose one or more IDE targets when `ide` is part of the install plan.",
	},
	{
		flag: "--skills <all|name[,name]>",
		description: "Choose bundled skills to install when `skills` is selected.",
	},
	{
		flag: "--embeddings <disabled|docker-llama-cpp|existing-lm-studio|existing-openai-compatible|openai>",
		description: "Choose how embeddings should be configured when `skills` is selected.",
	},
	{
		flag: "--embeddings-model <value>",
		description: "Override the embeddings model for the selected embeddings strategy.",
	},
	{
		flag: "--embeddings-base-url <value>",
		description: "Override the base URL for an existing embeddings runtime.",
	},
	{
		flag: "--embeddings-api-key <value>",
		description: "Persist the API key required by an authenticated embeddings provider.",
	},
	{
		flag: "--yes",
		description: "Auto-confirm install-managed updates in non-interactive mode.",
	},
	{
		flag: "--non-interactive",
		description: "Skip prompts and require an automation-safe install request.",
	},
	{
		flag: "--json",
		description: "Emit machine-readable workflow output instead of the human CLI surface.",
	},
	{
		flag: "--help",
		description: "Show this install-specific help surface.",
	},
] as const;

export const installHelpExamples = [
	"mimirmesh install --non-interactive --preset recommended",
	"mimirmesh install --non-interactive --areas core,ide --ide vscode,cursor",
	"mimirmesh install --non-interactive --areas core,skills --skills all --embeddings existing-lm-studio --embeddings-base-url http://localhost:1234/v1 --embeddings-model text-embedding-nomic-embed-text-v1.5",
	"mimirmesh install --non-interactive --preset full --ide vscode --skills all --embeddings docker-llama-cpp --embeddings-model Qwen/Qwen3-Embedding-0.6B-GGUF --yes",
] as const;

export const installCommandHelp: CommandHelpDefinition = {
	title: "Install MímirMesh",
	usage: "mimirmesh install [flags]",
	flags: installHelpRows,
	sections: [
		{
			title: "Non-interactive requirements",
			lines: [
				"Pass --preset or --areas to resolve the install plan without prompts.",
				"If the plan includes ide, also pass --ide with one or more targets.",
				"If the plan includes skills, optionally pass --skills to avoid the bundled-skill selector and pass --embeddings plus any required provider flags to avoid the embeddings prompts.",
				"Use --yes to auto-confirm install-managed updates during a non-interactive rerun.",
			],
		},
	],
	examples: installHelpExamples,
};

export const installIdeCommandHelp: CommandHelpDefinition = {
	title: "Install IDE MCP Integration",
	usage: "mimirmesh install ide [flags]",
	flags: [
		{
			flag: "--target <vscode|cursor|claude|codex>",
			description: "Choose the IDE or agent target for the project-local MCP config.",
		},
		{
			flag: "--server-command <command>",
			description: "Override the command written into the IDE MCP configuration.",
		},
		{
			flag: "--non-interactive",
			description: "Skip prompts and require an explicit target.",
		},
		{
			flag: "--json",
			description: "Emit machine-readable workflow output instead of the human CLI surface.",
		},
		{
			flag: "--help",
			description: "Show this command-specific help surface.",
		},
	],
	sections: [
		{
			title: "Non-interactive requirements",
			lines: ["Pass --target when running without prompts."],
		},
	],
	examples: [
		"mimirmesh install ide --non-interactive --target vscode",
		"mimirmesh install ide --non-interactive --target cursor --server-command $HOME/.local/bin/mimirmesh-server",
	],
};
