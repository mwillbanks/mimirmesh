import { access, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import type {
	SpecKitDoctorResult,
	SpecKitInitOptions,
	SpecKitInitResult,
	SpecKitInstallMode,
	SpecKitStatus,
} from "./types";

const SPEC_KIT_SOURCE = "git+https://github.com/github/spec-kit.git";
const TRANSLATED_SPECS_DIR = "docs/specifications";
const LEGACY_SPECS_DIR = "specs";

const promptDirectoryCandidates = [
	{ agent: "codex", relativePath: ".codex/prompts" },
	{ agent: "claude", relativePath: ".claude/commands" },
	{ agent: "gemini", relativePath: ".gemini/commands" },
	{ agent: "copilot", relativePath: ".github/prompts" },
	{ agent: "cursor-agent", relativePath: ".cursor/rules" },
	{ agent: "generic", relativePath: ".ai/commands" },
];

const translationRoots = [
	".specify",
	join(".codex", "prompts"),
	join(".claude", "commands"),
	join(".gemini", "commands"),
	join(".github", "prompts"),
	join(".github", "agents"),
	join(".cursor", "rules"),
	join(".ai", "commands"),
];

const translatedDirPath = (projectRoot: string): string => join(projectRoot, "docs", "specifications");
const legacyDirPath = (projectRoot: string): string => join(projectRoot, LEGACY_SPECS_DIR);
const specRootPath = (projectRoot: string): string => join(projectRoot, ".specify");
const scriptsPath = (projectRoot: string): string => join(projectRoot, ".specify", "scripts", "bash");
const templatesPath = (projectRoot: string): string => join(projectRoot, ".specify", "templates");
const constitutionPath = (projectRoot: string): string =>
	join(projectRoot, ".specify", "memory", "constitution.md");

const pathExists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

const relativePath = (projectRoot: string, path: string): string =>
	relative(projectRoot, path).replaceAll("\\", "/") || ".";

const runCommand = async (
	cmd: string[],
	cwd: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
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

const resolvePromptDirectories = async (
	projectRoot: string,
): Promise<Array<{ agent: string; relativePath: string }>> => {
	const found: Array<{ agent: string; relativePath: string }> = [];
	for (const candidate of promptDirectoryCandidates) {
		const fullPath = join(projectRoot, candidate.relativePath);
		if (await pathExists(fullPath)) {
			found.push(candidate);
		}
	}
	return found;
};

const collectFiles = async (projectRoot: string, relativeRoot: string): Promise<string[]> => {
	const absoluteRoot = join(projectRoot, relativeRoot);
	if (!(await pathExists(absoluteRoot))) {
		return [];
	}

	const output: string[] = [];
	const walk = async (directory: string): Promise<void> => {
		const entries = await readdir(directory, { withFileTypes: true });
		for (const entry of entries) {
			const absolutePath = join(directory, entry.name);
			if (entry.isDirectory()) {
				await walk(absolutePath);
				continue;
			}
			if (entry.isFile()) {
				output.push(relativePath(projectRoot, absolutePath));
			}
		}
	};

	await walk(absoluteRoot);
	return output.sort();
};

const collectTranslationTargets = async (projectRoot: string): Promise<string[]> => {
	const targets = await Promise.all(
		translationRoots.map((relativeRoot) => collectFiles(projectRoot, relativeRoot)),
	);
	return [...new Set(targets.flat())].sort();
};

const uvBinary = (): string | null => Bun.which("uv") ?? null;

const resolveInstallMode = async (binary: string | null): Promise<SpecKitInstallMode> => {
	if (!binary) {
		return uvBinary() ? "uvx" : "missing";
	}
	const uv = uvBinary();
	if (!uv) {
		return "existing";
	}
	const toolDir = await runCommand([uv, "tool", "dir", "--bin"], process.cwd());
	const binDir = toolDir.exitCode === 0 ? toolDir.stdout.trim() : "";
	if (binDir && binary.startsWith(binDir)) {
		return "uv-tool";
	}
	return "existing";
};

const resolveSpecifyBinary = (): string | null => {
	const override = process.env.MIMIRMESH_SPECIFY_BIN;
	if (override?.trim()) {
		return override.trim();
	}
	return Bun.which("specify") ?? null;
};

const resolvePreferredAgent = async (): Promise<string> => {
	const override = process.env.MIMIRMESH_SPECKIT_AI?.trim();
	if (override) {
		return override;
	}
	if (process.env.CODEX_HOME || Bun.which("codex")) {
		return "codex";
	}
	if (Bun.which("claude")) {
		return "claude";
	}
	if (Bun.which("gemini")) {
		return "gemini";
	}
	if (Bun.which("cursor-agent")) {
		return "cursor-agent";
	}
	return "codex";
};

const readSpecifyVersion = async (binary: string | null): Promise<string | null> => {
	if (!binary) {
		return null;
	}
	const extractVersion = (output: string): string | null => {
		const trimmed = output.trim();
		if (!trimmed) {
			return null;
		}
		const directMatch = trimmed.match(/(\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?)/);
		if (directMatch?.[1]) {
			return directMatch[1];
		}
		const cliMatch = trimmed.match(/CLI Version\s+([0-9A-Za-z.+-]+)/i);
		return cliMatch?.[1] ?? null;
	};

	const directVersion = await runCommand([binary, "--version"], process.cwd());
	if (directVersion.exitCode === 0) {
		return extractVersion(directVersion.stdout) ?? extractVersion(directVersion.stderr);
	}

	const upstreamVersion = await runCommand([binary, "version"], process.cwd());
	if (upstreamVersion.exitCode !== 0) {
		return null;
	}
	return extractVersion(upstreamVersion.stdout) ?? extractVersion(upstreamVersion.stderr);
};

const installSpecifyCli = async (): Promise<{ binary: string; installMode: SpecKitInstallMode }> => {
	const existing = resolveSpecifyBinary();
	if (existing) {
		return {
			binary: existing,
			installMode: await resolveInstallMode(existing),
		};
	}

	const uv = uvBinary();
	if (!uv) {
		throw new Error("Spec Kit requires uv. Install uv before running `mimirmesh speckit init`.");
	}

	const install = await runCommand(
		[
			uv,
			"tool",
			"install",
			"specify-cli",
			"--from",
			SPEC_KIT_SOURCE,
		],
		process.cwd(),
	);
	if (install.exitCode !== 0) {
		throw new Error(install.stderr.trim() || install.stdout.trim() || "Unable to install Specify CLI.");
	}

	const toolDir = await runCommand([uv, "tool", "dir", "--bin"], process.cwd());
	if (toolDir.exitCode !== 0) {
		throw new Error(toolDir.stderr.trim() || toolDir.stdout.trim() || "Unable to resolve uv tool bin directory.");
	}

	const binary = join(toolDir.stdout.trim(), "specify");
	if (!(await pathExists(binary))) {
		throw new Error("Specify CLI installation completed but the binary was not found.");
	}

	return {
		binary,
		installMode: "uv-tool",
	};
};

const applyTranslations = (content: string): string => {
	let next = content;
	next = next.replaceAll("$REPO_ROOT/specs", "$REPO_ROOT/docs/specifications");
	next = next.replaceAll("$repo_root/specs", "$repo_root/docs/specifications");
	next = next.replaceAll("$1/specs/$2", "$1/docs/specifications/$2");
	next = next.replaceAll("/specs/", "/docs/specifications/");
	next = next.replaceAll("specs/", "docs/specifications/");
	return next;
};

const translateSpecKitLayout = async (projectRoot: string): Promise<string[]> => {
	const translatedPaths: string[] = [];
	const translatedDir = translatedDirPath(projectRoot);
	await mkdir(translatedDir, { recursive: true });

	const legacyDir = legacyDirPath(projectRoot);
	if (await pathExists(legacyDir)) {
		const entries = await readdir(legacyDir);
		for (const entry of entries) {
			const source = join(legacyDir, entry);
			const destination = join(translatedDir, entry);
			if (await pathExists(destination)) {
				continue;
			}
			await rename(source, destination);
			translatedPaths.push(relativePath(projectRoot, destination));
		}
		const remaining = await readdir(legacyDir).catch(() => []);
		if (remaining.length === 0) {
			await rm(legacyDir, { recursive: true, force: true });
		}
	}

	for (const relativeTarget of await collectTranslationTargets(projectRoot)) {
		const absoluteTarget = join(projectRoot, relativeTarget);
		const content = await readFile(absoluteTarget, "utf8");
		const translated = applyTranslations(content);
		if (translated !== content) {
			await writeFile(absoluteTarget, translated, "utf8");
			translatedPaths.push(relativePath(projectRoot, absoluteTarget));
		}
	}

	return [...new Set(translatedPaths)].sort();
};

const filesContainLegacySpecsPaths = async (projectRoot: string): Promise<boolean> => {
	for (const relativeTarget of await collectTranslationTargets(projectRoot)) {
		const absoluteTarget = join(projectRoot, relativeTarget);
		const content = await readFile(absoluteTarget, "utf8");
		if (content.includes("$REPO_ROOT/specs") || content.includes("$repo_root/specs") || content.includes("specs/")) {
			return true;
		}
	}
	return false;
};

export const detectSpecKit = async (projectRoot: string): Promise<SpecKitStatus> => {
	const signals: string[] = [];
	const missing: string[] = [];
	const findings: string[] = [];

	const promptDirectories = await resolvePromptDirectories(projectRoot);
	const hasSpecRoot = await pathExists(specRootPath(projectRoot));
	const binary = resolveSpecifyBinary();
	const version = await readSpecifyVersion(binary);
	const installMode = await resolveInstallMode(binary);
	const translatedSpecsDir = translatedDirPath(projectRoot);
	const legacySpecsDir = legacyDirPath(projectRoot);

	if (hasSpecRoot) {
		signals.push(".specify");
	} else {
		missing.push(".specify");
	}
	if (await pathExists(scriptsPath(projectRoot))) {
		signals.push(".specify/scripts/bash");
	} else {
		missing.push(".specify/scripts/bash");
	}
	if (await pathExists(templatesPath(projectRoot))) {
		signals.push(".specify/templates");
	} else {
		missing.push(".specify/templates");
	}
	if (await pathExists(constitutionPath(projectRoot))) {
		signals.push(".specify/memory/constitution.md");
	} else {
		missing.push(".specify/memory/constitution.md");
	}
	if (promptDirectories.length > 0) {
		signals.push(...promptDirectories.map((entry) => entry.relativePath));
	} else {
		missing.push("agent prompt directory");
	}
	if (!hasSpecRoot && promptDirectories.length > 0) {
		findings.push("Spec Kit agent prompts exist, but `.specify/` is missing. Run `mimirmesh speckit init` to complete initialization.");
	}
	if (await pathExists(translatedSpecsDir)) {
		signals.push(TRANSLATED_SPECS_DIR);
	} else {
		missing.push(TRANSLATED_SPECS_DIR);
	}
	if (await pathExists(legacySpecsDir)) {
		findings.push("Legacy Spec Kit directory `specs/` is still present.");
	}
	if (await filesContainLegacySpecsPaths(projectRoot)) {
		findings.push("Spec Kit scripts or prompt files still reference legacy `specs/` paths.");
	}
	if (!binary) {
		findings.push(
			uvBinary()
				? "Specify CLI is not installed; MímirMesh can initialize Spec Kit via uv when requested."
				: "Neither Specify CLI nor uv is available.",
		);
	}

	const initialized = hasSpecRoot;
	const ready =
		initialized &&
		missing.length === 0 &&
		findings.every((finding) => !finding.includes("legacy `specs/` paths")) &&
		!findings.includes("Neither Specify CLI nor uv is available.");

	return {
		initialized,
		ready,
		signals: [...new Set(signals)].sort(),
		missing,
		findings,
		binary,
		version,
		installMode,
		agent: hasSpecRoot ? promptDirectories[0]?.agent ?? null : null,
		promptDirectories: promptDirectories.map((entry) => entry.relativePath),
		translatedSpecsDir: TRANSLATED_SPECS_DIR,
		legacySpecsDir: LEGACY_SPECS_DIR,
	};
};

export const initializeSpecKit = async (
	projectRoot: string,
	options: SpecKitInitOptions = {},
): Promise<SpecKitInitResult> => {
	const agent = options.agent?.trim() || (await resolvePreferredAgent());
	const { binary, installMode } = await installSpecifyCli();
	const statusBefore = await detectSpecKit(projectRoot);

	if (!statusBefore.ready || options.force) {
		const init = await runCommand(
			[
				binary,
				"init",
				"--here",
				"--force",
				"--ai",
				agent,
				"--ignore-agent-tools",
				"--no-git",
			],
			projectRoot,
		);
		if (init.exitCode !== 0) {
			throw new Error(init.stderr.trim() || init.stdout.trim() || "Spec Kit initialization failed.");
		}
	}

	const translatedPaths = await translateSpecKitLayout(projectRoot);
	const status = await detectSpecKit(projectRoot);
	if (!status.initialized) {
		throw new Error("Spec Kit initialization did not produce the expected project files.");
	}

	return {
		initialized: status.initialized,
		installed: installMode === "uv-tool",
		binary,
		version: status.version,
		installMode,
		agent,
		translatedPaths,
		status,
	};
};

export const doctorSpecKit = async (projectRoot: string): Promise<SpecKitDoctorResult> => {
	const status = await detectSpecKit(projectRoot);
	const findings = [...status.findings];
	if (!status.initialized) {
		findings.unshift("Spec Kit is not initialized.");
	}
	for (const missingPath of status.missing) {
		findings.push(`Missing ${missingPath}.`);
	}
	if (status.installMode === "missing") {
		findings.push("Install uv so MímirMesh can initialize or repair Spec Kit.");
	}
	return {
		ready: status.ready,
		findings: [...new Set(findings)],
		status,
	};
};
