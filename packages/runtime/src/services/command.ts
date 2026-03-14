export type CommandResult = {
	exitCode: number;
	stdout: string;
	stderr: string;
};

export const runCommand = async (cmd: string[], cwd?: string): Promise<CommandResult> => {
	const process = Bun.spawn({
		cmd,
		cwd,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(process.stdout).text(),
		new Response(process.stderr).text(),
		process.exited,
	]);
	return { exitCode, stdout, stderr };
};
