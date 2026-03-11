import type { MimirmeshConfig } from "@mimirmesh/config";

import { type CommandResult, runCommand } from "./command";

export const runCompose = async (
	config: MimirmeshConfig,
	args: string[],
): Promise<CommandResult> => {
	return runCommand([
		"docker",
		"compose",
		"-p",
		config.runtime.projectName,
		"-f",
		config.runtime.composeFile,
		...args,
	]);
};

export const composePsJson = async (config: MimirmeshConfig): Promise<CommandResult> =>
	runCompose(config, ["ps", "--format", "json"]);

export const composeBuild = async (config: MimirmeshConfig): Promise<CommandResult> =>
	runCompose(config, ["build"]);

export const composeUp = async (config: MimirmeshConfig): Promise<CommandResult> =>
	runCompose(config, ["up", "-d"]);

export const composeDown = async (config: MimirmeshConfig): Promise<CommandResult> =>
	runCompose(config, ["down", "--remove-orphans"]);

export const composePort = async (
	config: MimirmeshConfig,
	service: string,
	port: number,
): Promise<number | null> => {
	const result = await runCompose(config, ["port", service, String(port)]);
	if (result.exitCode !== 0) {
		return null;
	}
	const line = result.stdout.trim().split("\n").at(-1) ?? "";
	const match = line.match(/:(\d+)$/);
	return match ? Number(match[1]) : null;
};

export const composeExec = async (
	config: MimirmeshConfig,
	service: string,
	command: string[],
): Promise<CommandResult> => runCompose(config, ["exec", "-T", service, ...command]);
