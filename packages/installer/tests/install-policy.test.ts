import { describe, expect, test } from "bun:test";

import {
	buildInstallChangeSummary,
	createInstallationPolicy,
	createInstallationStateSnapshot,
	type InstallationPolicy,
	type InstallTarget,
	resolveInstallAreas,
	validateInstallationPolicy,
} from "../src/index";

describe("installer policy helpers", () => {
	test("always retains the required core area", () => {
		expect(resolveInstallAreas("minimal")).toEqual(["core"]);
		expect(
			createInstallationPolicy({
				mode: "interactive",
				selectedAreas: ["skills"],
			}).selectedAreas,
		).toEqual(["core", "skills"]);
	});

	test("requires explicit non-interactive intent and IDE target when needed", () => {
		expect(
			validateInstallationPolicy({
				mode: "non-interactive",
				selectedAreas: ["core"],
				explicitAreaOverrides: [],
				ideTargets: [],
				selectedSkills: [],
			} satisfies InstallationPolicy),
		).toEqual({
			ok: false,
			errors: [
				"Non-interactive install requires an explicit preset or explicit install-area selections.",
			],
		});

		expect(
			validateInstallationPolicy(
				createInstallationPolicy({
					mode: "non-interactive",
					presetId: "full",
					selectedAreas: ["core", "ide"],
					explicitAreaOverrides: ["core", "ide"],
					ideTargets: [],
				}),
			),
		).toEqual({
			ok: false,
			errors: [
				"Non-interactive install requires `--ide <target[,target]>` when IDE integration is selected.",
			],
		});

		expect(
			validateInstallationPolicy(
				createInstallationPolicy({
					mode: "non-interactive",
					presetId: "full",
					selectedAreas: ["core", "ide"],
					explicitAreaOverrides: ["core", "ide"],
					ideTargets: ["vscode", "cursor"] satisfies InstallTarget[],
				}),
			),
		).toEqual({ ok: true, errors: [] });
	});

	test("builds reproducible install change summaries from policy and snapshot", () => {
		const policy = createInstallationPolicy({
			mode: "interactive",
			presetId: "recommended",
			selectedAreas: ["core", "skills"],
			explicitAreaOverrides: ["core", "skills"],
			selectedSkills: ["mimirmesh-agent-router"],
		});
		const snapshot = createInstallationStateSnapshot({
			projectRoot: "/repo",
			completedAreas: ["skills"],
			degradedAreas: ["core"],
			pendingAreas: [],
			detectedArtifacts: [
				{
					areaId: "core",
					path: "/repo/.mimirmesh/runtime/bootstrap-state.json",
					status: "present",
					requiresConfirmation: true,
				},
				{
					areaId: "skills",
					path: "/repo/.agents/skills/mimirmesh-agent-router/SKILL.md",
					status: "missing",
					requiresConfirmation: true,
				},
				{
					areaId: "ide",
					path: "/repo/.vscode/mcp.json",
					status: "missing",
					requiresConfirmation: true,
				},
			],
			specKitStatus: {
				ready: false,
				details: "Spec Kit bootstrap still required.",
			},
			runtimeStatus: {
				state: "degraded",
				message: "Runtime needs attention.",
				reasons: ["Start Docker daemon."],
			},
		});

		expect(buildInstallChangeSummary(policy, snapshot)).toEqual({
			createdFiles: ["/repo/.agents/skills/mimirmesh-agent-router/SKILL.md"],
			updatedFiles: ["/repo/.mimirmesh/runtime/bootstrap-state.json"],
			skippedAreas: ["ide"],
			appliedAreas: ["core", "skills"],
			warnings: ["Start Docker daemon."],
		});
	});
});
