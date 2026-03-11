import { beforeAll, describe, expect, test } from "bun:test";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { detectDockerAvailability } from "@mimirmesh/runtime";
import { createFixtureCopy, createSpecifyStub } from "@mimirmesh/testing";

import { run } from "../_helpers/repo";

const root = process.cwd();
const distBinary = join(root, "dist", "mimirmesh");
const distServer = join(root, "dist", "mimirmesh-server");
const distClient = join(root, "dist", "mimirmesh-client");

let installDir = "";

const exists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

describe("workflow end-to-end", () => {
	beforeAll(async () => {
		const build = await run(["bun", "run", "build"], root);
		expect(build.code).toBe(0);
		installDir = await mkdtemp(join(tmpdir(), "mimirmesh-install-"));
		const install = await run(["bun", "run", "scripts/install.ts"], root, {
			MIMIRMESH_INSTALL_DIR: installDir,
		});
		expect(install.code).toBe(0);
	}, 180_000);

	test("produces single-file artifacts and local install binaries", async () => {
		expect(await exists(distBinary)).toBe(true);
		expect(await exists(distServer)).toBe(true);
		expect(await exists(distClient)).toBe(true);
		expect(await exists(join(installDir, "mimirmesh"))).toBe(true);
		expect(await exists(join(installDir, "mm"))).toBe(true);
	});

	test("initializes project and runs refresh/config/speckit flows", async () => {
		const repo = await createFixtureCopy("single-ts", { initializeGit: true });
		const cli = join(installDir, "mimirmesh");
		const specifyStub = await createSpecifyStub(join(repo, ".mimirmesh", "testing"));
		try {
			const init = await run([cli, "init"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
				MIMIRMESH_SPECIFY_BIN: specifyStub,
			});
			expect(init.code).toBe(0);
			expect(await exists(join(repo, ".mimirmesh", "config.yml"))).toBe(true);
			expect(await exists(join(repo, ".mimirmesh", "reports", "project-summary.md"))).toBe(true);
			expect(await exists(join(repo, ".specify", "scripts", "bash", "common.sh"))).toBe(true);
			expect(await exists(join(repo, "docs", "specifications"))).toBe(true);
			expect(await exists(join(repo, ".mimirmesh", "runtime", "engines", "srclight.json"))).toBe(
				true,
			);
			expect(await exists(join(repo, ".mimirmesh", "runtime", "bootstrap-state.json"))).toBe(true);

			const configSet = await run([cli, "config", "set", "logging.level", "debug"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
			});
			expect(configSet.code).toBe(0);

			const refresh = await run([cli, "refresh"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
			});
			expect(refresh.code).toBe(0);

			const runtimeStatus = await run([cli, "runtime", "status"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
			});
			expect(runtimeStatus.code).toBe(0);
			const runtimeStatusPayload = JSON.parse(runtimeStatus.stdout) as {
				health: {
					state: string;
					reasons: string[];
				};
			};
			expect(["ready", "degraded", "bootstrapping"]).toContain(runtimeStatusPayload.health.state);
			expect(
				runtimeStatusPayload.health.reasons.some((reason) => reason.includes("srclight")),
			).toBe(false);

			const doctor = await run([cli, "doctor"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
			});
			expect(doctor.code).toBe(0);
			const doctorPayload = JSON.parse(doctor.stdout) as {
				status: string;
				issues: string[];
			};
			expect(["healthy", "issues-found"]).toContain(doctorPayload.status);
			expect(doctorPayload.issues.some((issue) => issue.includes("srclight"))).toBe(false);

			const installIde = await run([cli, "install", "ide", "vscode"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
			});
			expect(installIde.code).toBe(0);
			const ideConfig = (await Bun.file(join(repo, ".vscode", "mcp.json")).json()) as {
				servers?: {
					mimirmesh?: {
						command?: string;
						args?: string[];
					};
				};
			};
			const configuredCommand = ideConfig.servers?.mimirmesh?.command ?? "";
			expect(Boolean(ideConfig.servers)).toBe(true);
			expect(configuredCommand.includes("mimirmesh-server")).toBe(false);
			expect(configuredCommand.endsWith("mimirmesh") || configuredCommand === "mimirmesh").toBe(
				true,
			);
			expect(ideConfig.servers?.mimirmesh?.args).toEqual(["server"]);

			const specInit = await run([cli, "speckit", "init"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
				MIMIRMESH_SPECIFY_BIN: specifyStub,
			});
			expect(specInit.code).toBe(0);
			const specStatus = await run([cli, "speckit", "status"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
				MIMIRMESH_SPECIFY_BIN: specifyStub,
			});
			expect(specStatus.code).toBe(0);
			expect(specStatus.stdout.includes("docs/specifications")).toBe(true);
		} finally {
			await run([cli, "runtime", "stop"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
			});
			await rm(repo, { recursive: true, force: true });
		}
	}, 300_000);

	test("invokes MCP server through client binary", async () => {
		const docker = await detectDockerAvailability();
		if (!docker.dockerInstalled || !docker.dockerDaemonRunning || !docker.composeAvailable) {
			return;
		}

		const repo = await createFixtureCopy("single-ts", { initializeGit: true });
		const specifyStub = await createSpecifyStub(join(repo, ".mimirmesh", "testing"));
		try {
			const init = await run([distBinary, "init"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
				MIMIRMESH_SPECIFY_BIN: specifyStub,
			});
			expect(init.code).toBe(0);

			const tools = await run([distClient, "list-tools"], root, {
				MIMIRMESH_SERVER_BIN: distServer,
				MIMIRMESH_PROJECT_ROOT: repo,
			});
			expect(tools.code).toBe(0);
			const listed = JSON.parse(tools.stdout) as Array<{ name: string }>;
			expect(listed.some((tool) => tool.name === "explain_project")).toBe(true);
			const passthrough = listed.find((tool) => tool.name.startsWith("mimirmesh_srclight_"));
			expect(listed.some((tool) => tool.name.includes("."))).toBe(false);
			expect(passthrough).toBeDefined();
			if (!passthrough) {
				throw new Error("Expected a discovered Srclight passthrough tool");
			}

			const unifiedCall = await run(
				[distClient, "tool", "search_code", '{"query":"export"}'],
				root,
				{
					MIMIRMESH_SERVER_BIN: distServer,
					MIMIRMESH_PROJECT_ROOT: repo,
				},
			);
			expect(unifiedCall.code).toBe(0);
			expect(
				unifiedCall.stdout.includes("provenance") || unifiedCall.stdout.includes("content"),
			).toBe(true);

			const passthroughCall = await run(
				[distClient, "tool", passthrough.name, '{"query":"export","symbol":"export"}'],
				root,
				{
					MIMIRMESH_SERVER_BIN: distServer,
					MIMIRMESH_PROJECT_ROOT: repo,
				},
			);
			expect(passthroughCall.code).toBe(0);
			expect(
				passthroughCall.stdout.includes("srclight") || passthroughCall.stdout.includes("content"),
			).toBe(true);
		} finally {
			await run([distBinary, "runtime", "stop"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
			});
			await rm(repo, { recursive: true, force: true });
		}
	}, 300_000);
});
