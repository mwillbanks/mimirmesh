import { describe, expect, test } from "bun:test";

import { createDefaultConfig } from "@mimirmesh/config";
import type { InstallationStateSnapshot } from "@mimirmesh/installer";
import type { InstalledBundledSkill } from "@mimirmesh/skills";

import { inferExistingInstallSettings } from "../../src/lib/install-existing-settings";

describe("inferExistingInstallSettings", () => {
	test("derives rerun defaults from the existing config and detected artifacts", () => {
		const projectRoot = "/repo";
		const config = createDefaultConfig(projectRoot);
		config.skills.embeddings.enabled = true;
		config.skills.embeddings.providers = [
			{
				type: "lm_studio",
				model: "text-embedding-nomic-embed-text-v1.5",
				baseUrl: "http://localhost:1234/v1",
				apiKey: "secret-token",
				timeoutMs: 30_000,
				maxRetries: 2,
			},
		];

		const snapshot: InstallationStateSnapshot = {
			projectRoot,
			completedAreas: ["core", "ide", "skills"],
			degradedAreas: [],
			pendingAreas: [],
			detectedArtifacts: [
				{
					areaId: "ide",
					path: "/repo/.vscode/mcp.json",
					status: "present",
				},
				{
					areaId: "skills",
					path: "/repo/.agents/skills/mimirmesh-code-navigation/SKILL.md",
					status: "present",
				},
			],
			specKitStatus: {
				ready: true,
			},
			runtimeStatus: {
				state: "ready",
				message: "Ready",
				reasons: [],
			},
		};
		const skillStatuses: InstalledBundledSkill[] = [
			{
				name: "mimirmesh-code-navigation",
				description: "Navigate code.",
				sourcePath: "/source/navigation",
				targetPath: "/repo/.agents/skills/mimirmesh-code-navigation",
				installed: true,
				mode: "copy",
				outdated: false,
				broken: false,
			},
		];

		expect(
			inferExistingInstallSettings({
				projectRoot,
				config,
				snapshot,
				skillStatuses,
			}),
		).toEqual({
			hasExistingState: true,
			presetId: "full",
			selectedAreas: ["core", "ide", "skills"],
			ideTargets: ["vscode"],
			selectedSkills: ["mimirmesh-code-navigation"],
			embeddings: {
				mode: "existing-lm-studio",
				model: "text-embedding-nomic-embed-text-v1.5",
				baseUrl: "http://localhost:1234/v1",
				apiKey: "secret-token",
				fallbackOnFailure: true,
			},
		});
	});

	test("keeps first-run defaults disabled when no existing install state is detected", () => {
		const projectRoot = "/repo";
		const config = createDefaultConfig(projectRoot);
		const snapshot: InstallationStateSnapshot = {
			projectRoot,
			completedAreas: [],
			degradedAreas: [],
			pendingAreas: ["core", "skills"],
			detectedArtifacts: [],
			specKitStatus: {
				ready: false,
			},
			runtimeStatus: {
				state: "pending",
				message: "Pending",
				reasons: [],
			},
		};

		expect(
			inferExistingInstallSettings({
				projectRoot,
				config,
				snapshot,
				skillStatuses: [],
			}),
		).toEqual({
			hasExistingState: false,
			presetId: "minimal",
			selectedAreas: ["core"],
			ideTargets: [],
			selectedSkills: [],
			embeddings: {
				mode: "disabled",
				fallbackOnFailure: true,
			},
		});
	});
});
