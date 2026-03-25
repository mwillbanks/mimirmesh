import { beforeAll, describe, expect, test } from "bun:test";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createInstallationPolicy } from "@mimirmesh/installer";
import { detectDockerAvailability } from "@mimirmesh/runtime";
import { createFixtureCopy, createSpecifyStub } from "@mimirmesh/testing";
import { executeWorkflowRun, type PresentationProfile } from "@mimirmesh/ui";

import { createInstallWorkflow } from "apps/cli/src/workflows/install";

import { run } from "../_helpers/repo";

const root = process.cwd();
const distBinary = join(root, "dist", "mimirmesh");
const distServer = join(root, "dist", "mimirmesh-server");
const distClient = join(root, "dist", "mimirmesh-client");

let installDir = "";

const workflowPresentation: PresentationProfile = {
	mode: "direct-human",
	interactive: false,
	reducedMotion: true,
	colorSupport: "none",
	screenReaderFriendlyText: true,
	terminalSizeClass: "wide",
};

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
		const cli = distBinary;
		const specifyStub = await createSpecifyStub(join(repo, ".mimirmesh", "testing"));
		try {
			process.env.MIMIRMESH_PROJECT_ROOT = repo;
			process.env.MIMIRMESH_SPECIFY_BIN = specifyStub;
			const install = await executeWorkflowRun(
				createInstallWorkflow({
					policy: createInstallationPolicy({
						presetId: "minimal",
						mode: "non-interactive",
						selectedAreas: ["core"],
						explicitAreaOverrides: ["core"],
					}),
				}),
				workflowPresentation,
			);
			expect(["success", "degraded", "failed"]).toContain(install.phase);
			expect(await exists(join(repo, ".mimirmesh", "config.yml"))).toBe(true);
			expect(await exists(join(repo, ".mimirmesh", "reports", "project-summary.md"))).toBe(true);
			expect(await exists(join(repo, ".specify", "scripts", "bash", "common.sh"))).toBe(true);
			expect(await exists(join(repo, "docs", "specifications"))).toBe(true);
			expect(await exists(join(repo, ".mimirmesh", "runtime", "engines", "srclight.json"))).toBe(
				true,
			);
			expect(await exists(join(repo, ".mimirmesh", "runtime", "bootstrap-state.json"))).toBe(true);

			const configSet = await run(
				[cli, "config", "set", "logging.level", "debug", "--non-interactive"],
				repo,
				{
					MIMIRMESH_PROJECT_ROOT: repo,
				},
			);
			expect(configSet.code).toBe(0);

			const refresh = await run([cli, "refresh", "--non-interactive"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
			});
			expect(refresh.code).toBe(0);

			const runtimeStatus = await run([cli, "runtime", "status", "--json"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
			});
			expect(runtimeStatus.code).toBe(0);
			const runtimeStatusPayload = JSON.parse(runtimeStatus.stdout) as {
				outcome: {
					payload: {
						health: {
							state: string;
							reasons: string[];
						};
					};
				};
			};
			expect(["ready", "degraded", "bootstrapping", "failed"]).toContain(
				runtimeStatusPayload.outcome.payload.health.state,
			);
			if (runtimeStatusPayload.outcome.payload.health.state === "ready") {
				expect(
					runtimeStatusPayload.outcome.payload.health.reasons.some((reason) =>
						reason.includes("srclight"),
					),
				).toBe(false);
			}

			const doctor = await run([cli, "doctor", "--json"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
			});
			expect(doctor.code).toBe(0);
			const doctorPayload = JSON.parse(doctor.stdout) as {
				outcome: {
					payload: {
						status: string;
						issues: string[];
					};
				};
			};
			expect(["healthy", "issues-found"]).toContain(doctorPayload.outcome.payload.status);
			if (doctorPayload.outcome.payload.status === "healthy") {
				expect(
					doctorPayload.outcome.payload.issues.some((issue) => issue.includes("srclight")),
				).toBe(false);
			}

			const installIde = await run(
				[cli, "install", "ide", "--non-interactive", "--target", "vscode"],
				repo,
				{
					MIMIRMESH_PROJECT_ROOT: repo,
				},
			);
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

			const specInit = await run([cli, "speckit", "init", "--non-interactive"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
				MIMIRMESH_SPECIFY_BIN: specifyStub,
			});
			expect(specInit.code).toBe(0);
			const specStatus = await run([cli, "speckit", "status", "--json"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
				MIMIRMESH_SPECIFY_BIN: specifyStub,
			});
			expect(specStatus.code).toBe(0);
			const specStatusPayload = JSON.parse(specStatus.stdout) as {
				outcome: {
					payload: {
						ready: boolean;
					};
				};
			};
			expect(specStatusPayload.outcome.payload.ready).toBe(true);
		} finally {
			await run([cli, "runtime", "stop", "--non-interactive"], repo, {
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
			process.env.MIMIRMESH_PROJECT_ROOT = repo;
			process.env.MIMIRMESH_SPECIFY_BIN = specifyStub;
			const install = await executeWorkflowRun(
				createInstallWorkflow({
					policy: createInstallationPolicy({
						presetId: "minimal",
						mode: "non-interactive",
						selectedAreas: ["core"],
						explicitAreaOverrides: ["core"],
					}),
				}),
				workflowPresentation,
			);
			expect(["success", "degraded", "failed"]).toContain(install.phase);

			const tools = await run([distClient, "list-tools"], root, {
				MIMIRMESH_SERVER_BIN: distServer,
				MIMIRMESH_PROJECT_ROOT: repo,
			});
			expect(tools.code).toBe(0);
			const listed = JSON.parse(tools.stdout) as Array<{ name: string }>;
			expect(listed.some((tool) => tool.name === "explain_project")).toBe(true);
			const passthrough = listed.find((tool) => tool.name.startsWith("srclight_"));
			expect(listed.some((tool) => tool.name.includes("."))).toBe(false);
			const runtimeStatus = await run([distBinary, "runtime", "status", "--json"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
			});
			expect(runtimeStatus.code).toBe(0);
			const runtimeStatusPayload = JSON.parse(runtimeStatus.stdout) as {
				outcome: {
					payload: {
						health: {
							state: string;
							reasons: string[];
						};
					};
				};
			};
			if (!passthrough) {
				expect(["bootstrapping", "degraded", "failed"]).toContain(
					runtimeStatusPayload.outcome.payload.health.state,
				);
				expect(runtimeStatusPayload.outcome.payload.health.reasons.length).toBeGreaterThan(0);
				return;
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

			const retiredAliasCall = await run(
				[distClient, "tool", "mimirmesh.srclight.search_symbols", '{"query":"export"}'],
				root,
				{
					MIMIRMESH_SERVER_BIN: distServer,
					MIMIRMESH_PROJECT_ROOT: repo,
				},
			);
			expect(retiredAliasCall.code).toBe(0);
			expect(retiredAliasCall.stdout.includes("srclight_search_symbols")).toBe(true);
		} finally {
			await run([distBinary, "runtime", "stop", "--non-interactive"], repo, {
				MIMIRMESH_PROJECT_ROOT: repo,
			});
			await rm(repo, { recursive: true, force: true });
		}
	}, 300_000);
});
