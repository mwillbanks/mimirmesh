import { describe, expect, mock, test } from "bun:test";

import type { PresentationProfile } from "@mimirmesh/ui";

const workflowModulePath = new URL("../../../src/workflows/skills.ts", import.meta.url).pathname;

mock.module(workflowModulePath, () => ({
	createSkillsCreateWorkflow: () => ({ id: "skills-create" }),
	createSkillsFindWorkflow: () => ({ id: "skills-find" }),
	createSkillsReadWorkflow: () => ({ id: "skills-read" }),
	createSkillsRefreshWorkflow: () => ({ id: "skills-refresh" }),
	createSkillsResolveWorkflow: () => ({ id: "skills-resolve" }),
	createSkillsUpdateWorkflow: () => ({ id: "skills-update" }),
}));

const { renderInkStatic } = await import("../../../src/testing/render-ink");

const [
	{ default: SkillsCreateCommand },
	{ default: SkillsFindCommand },
	{ default: SkillsReadCommand },
	{ default: SkillsRefreshCommand },
	{ default: SkillsResolveCommand },
	{ default: SkillsUpdateCommand },
] = await Promise.all([
	import("../../../src/commands/skills/create"),
	import("../../../src/commands/skills/find"),
	import("../../../src/commands/skills/read"),
	import("../../../src/commands/skills/refresh"),
	import("../../../src/commands/skills/resolve"),
	import("../../../src/commands/skills/update"),
]);

const presentation: PresentationProfile = {
	mode: "direct-human",
	interactive: false,
	reducedMotion: true,
	colorSupport: "none",
	screenReaderFriendlyText: true,
	terminalSizeClass: "wide",
};

describe("skills command surface", () => {
	test("renders help and surface text for the registry command family", () => {
		const output = [
			renderInkStatic(<SkillsFindCommand options={{ help: true }} presentation={presentation} />),
			renderInkStatic(
				<SkillsReadCommand
					args={["mimirmesh-code-navigation"]}
					options={{ help: true }}
					presentation={presentation}
				/>,
			),
			renderInkStatic(
				<SkillsResolveCommand
					args={["refine the skill install workflow"]}
					options={{ help: true }}
					presentation={presentation}
				/>,
			),
			renderInkStatic(
				<SkillsRefreshCommand options={{ help: true }} presentation={presentation} />,
			),
			renderInkStatic(<SkillsCreateCommand options={{ help: true }} presentation={presentation} />),
			renderInkStatic(
				<SkillsUpdateCommand
					args={["custom-skill"]}
					options={{ help: true }}
					presentation={presentation}
				/>,
			),
		].join("\n");

		expect(output).toContain("mimirmesh skills find");
		expect(output).toContain("mimirmesh skills read");
		expect(output).toContain("mimirmesh skills resolve");
		expect(output).toContain("mimirmesh skills refresh");
		expect(output).toContain("mimirmesh skills create");
		expect(output).toContain("mimirmesh skills update");
		expect(output).toContain("bundled-skill maintenance flow");
		expect(output).toContain("authoring surface");
	});
});
