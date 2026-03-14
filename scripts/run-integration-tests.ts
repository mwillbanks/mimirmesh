import { join } from "node:path";

import {
	cleanupIntegrationContainers,
	integrationCacheDir,
	parseIntegrationCliOptions,
	pruneDockerBuilderCache,
	warmIntegrationContainers,
} from "../packages/testing/src/integration/manager";

const projectRoot = process.cwd();
const cliOptions = parseIntegrationCliOptions(process.argv.slice(2), process.env);

if (!cliOptions.shouldRunIntegration) {
	console.log("Skipping integration tests (MIMIRMESH_RUN_INTEGRATION_TESTS=false or --skip-integration).");
	process.exit(0);
}

const dockerImagesDir = join(projectRoot, "docker", "images");
const targetArch = process.arch === "arm64" ? "arm64" : "amd64";
const codebaseMemoryVersion = process.env.CODEBASE_MEMORY_VERSION ?? "v0.3.1";
const engineImages = [
	{
		tag: "mimirmesh/mm-srclight:local",
		dockerfile: join(dockerImagesDir, "srclight", "Dockerfile"),
	},
	{
		tag: "mimirmesh/mm-document-mcp:local",
		dockerfile: join(dockerImagesDir, "document-mcp", "Dockerfile"),
	},
	{
		tag: "mimirmesh/mm-adr-analysis:local",
		dockerfile: join(dockerImagesDir, "adr-analysis", "Dockerfile"),
	},
	{
		tag: "mimirmesh/mm-codebase-memory:local",
		dockerfile: join(dockerImagesDir, "codebase-memory", "Dockerfile"),
		buildArgs: [
			"--build-arg",
			`TARGETARCH=${targetArch}`,
			"--build-arg",
			`CODEBASE_MEMORY_VERSION=${codebaseMemoryVersion}`,
		],
	},
];

const runCommand = async (cmd: string[]): Promise<void> => {
	const child = Bun.spawn({
		cmd,
		cwd: projectRoot,
		stdout: "inherit",
		stderr: "inherit",
	});
	const exitCode = await child.exited;
	if (exitCode !== 0) {
		throw new Error(`Command failed (${exitCode}): ${cmd.join(" ")}`);
	}
};

const prebuildEngineImages = async (): Promise<void> => {
	console.log("Prebuilding runtime images so integration tests reuse cached layers...");

	await Promise.all(
		engineImages.map(async (build) => {
			const command = [
				"docker",
				"build",
				"--file",
				build.dockerfile,
				"--tag",
				build.tag,
				...(build.buildArgs ?? []),
				dockerImagesDir,
			];
			console.log(`Building ${build.tag}...`);
			await runCommand(command);
		}),
	);
	console.log("Runtime image prebuild finished.");
};

const runIntegrationTests = async (): Promise<void> => {
	console.log("Running integration tests (tests/integration) ...");
	const command = ["bun", "test", "tests/integration"];
	const child = Bun.spawn({
		cmd: command,
		cwd: projectRoot,
		stdout: "inherit",
		stderr: "inherit",
	});
	const exitCode = await child.exited;
	if (exitCode !== 0) {
		throw new Error(`Integration tests failed (exit code ${exitCode}).`);
	}
};

let warmContainersCreated = false;
try {
	if (cliOptions.shouldPrebuild) {
		await prebuildEngineImages();
	}

	if (cliOptions.shouldWarmContainers) {
		const warmed = await warmIntegrationContainers(projectRoot, engineImages.map((entry) => entry.tag), {
			reuse: cliOptions.keepWarmContainers,
		});
		warmContainersCreated = warmed.length > 0;
		console.log(
			`Prepared ${warmed.length} warm integration container(s) in ${integrationCacheDir(projectRoot)}.`,
		);
	}

	await runIntegrationTests();
} finally {
	if (warmContainersCreated && !cliOptions.keepWarmContainers) {
		console.log("Cleaning up warm integration containers.");
		await cleanupIntegrationContainers(projectRoot);
	}
	if (cliOptions.shouldPruneCache) {
		console.log("Pruning docker builder cache for integration artifacts.");
		await pruneDockerBuilderCache();
	}
}
