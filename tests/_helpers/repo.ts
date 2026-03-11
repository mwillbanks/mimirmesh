export const run = async (
	cmd: string[],
	cwd: string,
	env?: Record<string, string>,
): Promise<{ code: number; stdout: string; stderr: string }> => {
	const child = Bun.spawn({
		cmd,
		cwd,
		env: {
			...Bun.env,
			...env,
		},
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	return {
		code,
		stdout,
		stderr,
	};
};
