import { PassThrough } from "node:stream";
import { render, renderToString } from "ink";
import type React from "react";

const ansiEscape = String.fromCharCode(0x1b);
const ansiPattern = new RegExp(`${ansiEscape}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`, "g");

export const stripAnsi = (value: string): string =>
	value.replace(ansiPattern, "").replaceAll("\r", "");

type RenderInkOptions = {
	columns?: number;
	rows?: number;
	waitMs?: number;
};

const createStreams = (options: RenderInkOptions = {}) => {
	const stdout = new PassThrough() as PassThrough & {
		isTTY?: boolean;
		columns?: number;
		rows?: number;
	};
	const stdin = new PassThrough() as PassThrough & {
		isTTY?: boolean;
		setRawMode?: (value: boolean) => void;
		ref?: () => void;
		unref?: () => void;
	};

	stdout.isTTY = true;
	stdout.columns = options.columns ?? 140;
	stdout.rows = options.rows ?? 40;
	stdin.isTTY = true;
	stdin.setRawMode = () => {};
	stdin.ref = () => {};
	stdin.unref = () => {};

	return { stdout, stdin };
};

export const renderInkUntilExit = async (
	node: React.ReactNode,
	options: RenderInkOptions = {},
): Promise<string> => {
	const { stdout, stdin } = createStreams(options);
	let output = "";
	stdout.on("data", (chunk) => {
		output += chunk.toString();
	});

	const app = render(node, {
		stdout: stdout as unknown as NodeJS.WriteStream,
		stdin: stdin as unknown as NodeJS.ReadStream,
		stderr: stdout as unknown as NodeJS.WriteStream,
		exitOnCtrlC: false,
		patchConsole: false,
	});

	await app.waitUntilExit();

	return stripAnsi(output);
};

export const renderInkFrame = async (
	node: React.ReactNode,
	options: RenderInkOptions = {},
): Promise<string> => {
	const { stdout, stdin } = createStreams(options);
	let output = "";
	stdout.on("data", (chunk) => {
		output += chunk.toString();
	});

	const app = render(node, {
		stdout: stdout as unknown as NodeJS.WriteStream,
		stdin: stdin as unknown as NodeJS.ReadStream,
		stderr: stdout as unknown as NodeJS.WriteStream,
		exitOnCtrlC: false,
		patchConsole: false,
	});

	await new Promise((resolve) => {
		setTimeout(resolve, options.waitMs ?? 80);
	});

	app.unmount();
	await app.waitUntilExit();

	return stripAnsi(output);
};

export const renderInkInteraction = async (
	node: React.ReactNode,
	interact: (context: {
		stdin: PassThrough;
		wait: (ms?: number) => Promise<void>;
	}) => Promise<void> | void,
	options: RenderInkOptions = {},
): Promise<string> => {
	const { stdout, stdin } = createStreams(options);
	let output = "";
	stdout.on("data", (chunk) => {
		output += chunk.toString();
	});

	const app = render(node, {
		stdout: stdout as unknown as NodeJS.WriteStream,
		stdin: stdin as unknown as NodeJS.ReadStream,
		stderr: stdout as unknown as NodeJS.WriteStream,
		exitOnCtrlC: false,
		patchConsole: false,
	});

	const wait = async (ms = 40): Promise<void> => {
		await new Promise((resolve) => {
			setTimeout(resolve, ms);
		});
	};

	await interact({ stdin, wait });
	await wait(options.waitMs ?? 80);

	stdin.end();
	app.unmount();
	await app.waitUntilExit();

	return stripAnsi(output);
};

export const renderInkStatic = (node: React.ReactNode, columns = 120): string =>
	stripAnsi(renderToString(node, { columns }));
