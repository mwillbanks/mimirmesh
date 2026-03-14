import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SKIP_INTEGRATION_FLAGS = [
	"--skip-integration",
	"--no-integration",
	"--skip-integration-tests",
	"--no-integration-tests",
];
const SKIP_PREBUILD_FLAGS = ["--no-prebuild-images", "--skip-image-build"];
const WARM_CONTAINER_FLAGS = ["--no-warm-containers", "--skip-warm-containers"];
const KEEP_WARM_CONTAINER_FLAGS = ["--keep-warm-containers"];
const PRUNE_CACHE_FLAGS = ["--prune-docker-cache"];

const WARM_CONTAINERS_DIR = ".mimirmesh-integration-cache";
const WARM_CONTAINER_STATE = "containers.json";

type WarmState = {
	containers: string[];
};

const DEFAULT_WARM_STATE: WarmState = {
	containers: [],
};

const sanitizeImageName = (image: string): string =>
	image.replaceAll("/", "-").replaceAll(":", "-").replaceAll(".", "-").replaceAll("@", "-");

const createContainerName = (image: string): string => `mimirmesh-warm-${sanitizeImageName(image)}`;

const runCommand = async (cmd: string[]): Promise<{ stdout: string; stderr: string }> => {
	const child = Bun.spawn({
		cmd,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	if (code !== 0) {
		throw new Error(`Command failed (${code}): ${cmd.join(" ")}`);
	}
	return { stdout, stderr };
};

const readWarmState = async (cacheFile: string): Promise<WarmState> => {
	try {
		const contents = await readFile(cacheFile, "utf8");
		return JSON.parse(contents) as WarmState;
	} catch {
		return DEFAULT_WARM_STATE;
	}
};

const writeWarmState = async (cacheFile: string, state: WarmState): Promise<void> => {
	await mkdir(dirname(cacheFile), { recursive: true });
	await writeFile(cacheFile, JSON.stringify(state, null, 2), "utf8");
};

export type IntegrationCliOptions = {
	shouldRunIntegration: boolean;
	shouldPrebuild: boolean;
	shouldWarmContainers: boolean;
	keepWarmContainers: boolean;
	shouldPruneCache: boolean;
};

export const parseIntegrationCliOptions = (
	argv: string[],
	env: NodeJS.ProcessEnv,
): IntegrationCliOptions => {
	const args = new Set(argv);
	const envValue = (env.MIMIRMESH_RUN_INTEGRATION_TESTS ?? "true").trim().toLowerCase();
	const skipFromEnv = ["false", "0", "no"].includes(envValue);

	const shouldRunIntegration = !(skipFromEnv || SKIP_INTEGRATION_FLAGS.some((flag) => args.has(flag)));
	const shouldPrebuild = !SKIP_PREBUILD_FLAGS.some((flag) => args.has(flag));
	const shouldWarmContainers = !WARM_CONTAINER_FLAGS.some((flag) => args.has(flag));
	const keepWarmContainers = KEEP_WARM_CONTAINER_FLAGS.some((flag) => args.has(flag));
	const shouldPruneCache = PRUNE_CACHE_FLAGS.some((flag) => args.has(flag));

	return {
		shouldRunIntegration,
		shouldPrebuild,
		shouldWarmContainers,
		keepWarmContainers,
		shouldPruneCache,
	};
};

export const integrationCacheDir = (projectRoot: string): string =>
	join(projectRoot, WARM_CONTAINERS_DIR);

export const warmIntegrationContainers = async (
	projectRoot: string,
	images: string[],
	options?: { reuse?: boolean },
): Promise<string[]> => {
	if (images.length === 0) {
		return [];
	}

	const cacheFile = join(integrationCacheDir(projectRoot), WARM_CONTAINER_STATE);
	const state = await readWarmState(cacheFile);
	const created: string[] = [];

	for (const image of images) {
		const containerName = createContainerName(image);
		if (options?.reuse && state.containers.includes(containerName)) {
			created.push(containerName);
			continue;
		}

		try {
			await runCommand(["docker", "rm", "-f", containerName]);
		} catch {
			// ignore failures if the container is missing
		}

		try {
			await runCommand([
				"docker",
				"create",
				"--name",
				containerName,
				"--label",
				"com.mimirmesh.integration=true",
				image,
				"/bin/sh",
				"-c",
				"true",
			]);
			created.push(containerName);
			state.containers = Array.from(new Set([...state.containers, containerName]));
		} catch (error) {
			console.warn(`Failed to warm container for ${image}: ${(error as Error).message}`);
		}
	}

	await writeWarmState(cacheFile, state);
	return created;
};

export const cleanupIntegrationContainers = async (
	projectRoot: string,
): Promise<void> => {
	const cacheFile = join(integrationCacheDir(projectRoot), WARM_CONTAINER_STATE);
	try {
		const state = await readWarmState(cacheFile);
		for (const containerName of state.containers) {
			try {
				await runCommand(["docker", "rm", "-f", containerName]);
			} catch {
				// ignore missing containers
			}
		}
	} finally {
		await rm(cacheFile, { force: true });
	}
};

export const pruneDockerBuilderCache = async (): Promise<void> => {
	try {
		await runCommand(["docker", "builder", "prune", "--filter", "label=com.mimirmesh.integration=true", "--force"]);
	} catch {
		// best effort cleanup only
	}
};
