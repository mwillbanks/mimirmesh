import { describe, expect, test } from "bun:test";

import { createDefaultConfig } from "@mimirmesh/config";

import {
	buildRuntimeHealth,
	classifySkillRegistryReadiness,
	createSkillRegistryState,
	skillRegistryStatePath,
} from "../../src";

describe("skill registry readiness", () => {
	test("reports bootstrapping when no registry state exists yet", () => {
		const repo = "/tmp/mimirmesh-skill-readiness";
		const config = createDefaultConfig(repo);

		const readiness = classifySkillRegistryReadiness(repo, config, null);

		expect(readiness).toMatchObject({
			state: "bootstrapping",
			statePath: skillRegistryStatePath(repo),
			embeddingsEnabled: false,
			providerCount: 0,
		});
	});

	test("surfaces the persisted skill registry state in runtime health", () => {
		const repo = "/tmp/mimirmesh-skill-readiness-state";
		const config = createDefaultConfig(repo);
		const registryState = createSkillRegistryState(repo, config);

		const readiness = classifySkillRegistryReadiness(repo, config, registryState);
		const health = buildRuntimeHealth({
			state: "ready",
			dockerInstalled: true,
			dockerDaemonRunning: true,
			composeAvailable: true,
			reasons: [],
			services: [],
			bridges: [],
			skillRegistry: registryState,
			runtimeVersion: null,
			upgradeState: null,
			migrationStatus: null,
		});

		expect(readiness.state).toBe("ready");
		expect(health.skillRegistry).toEqual(registryState);
		expect(health.skillRegistry?.bootstrap.state).toBe("ready");
	});
});
