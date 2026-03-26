import { Select } from "@inkjs/ui";
import type { PresentationProfile, WorkflowRunState } from "@mimirmesh/ui";
import { Box, Text, useInput } from "ink";
import { useCallback, useMemo, useState } from "react";

import InstallCommand from "../commands/install";
import InstallIdeCommand from "../commands/install/ide";
import McpListToolsCommand from "../commands/mcp/list-tools";
import McpLoadToolsCommand from "../commands/mcp/load-tools";
import McpToolCommand from "../commands/mcp/tool";
import McpToolSchemaCommand from "../commands/mcp/tool-schema";
import RefreshCommand from "../commands/refresh";
import RuntimeDoctorCommand from "../commands/runtime/doctor";
import RuntimeRefreshCommand from "../commands/runtime/refresh";
import RuntimeRestartCommand from "../commands/runtime/restart";
import RuntimeStartCommand from "../commands/runtime/start";
import RuntimeStatusCommand from "../commands/runtime/status";
import RuntimeStopCommand from "../commands/runtime/stop";
import RuntimeUpgradeMigrateCommand from "../commands/runtime/upgrade/migrate";
import RuntimeUpgradeRepairCommand from "../commands/runtime/upgrade/repair";
import RuntimeUpgradeStatusCommand from "../commands/runtime/upgrade/status";
import SkillsCreateCommand from "../commands/skills/create";
import SkillsFindCommand from "../commands/skills/find";
import SkillsReadCommand from "../commands/skills/read";
import SkillsRefreshCommand from "../commands/skills/refresh";
import SkillsResolveCommand from "../commands/skills/resolve";
import SkillsUpdateCommand from "../commands/skills/update";
import type { collectDashboardSnapshot } from "../lib/context";
import { WorkflowCard } from "./workflow-card";

type DashboardSnapshot = Awaited<ReturnType<typeof collectDashboardSnapshot>>;

type WorkflowLaunchersProps = {
	sectionId: string;
	presentation: PresentationProfile;
	snapshot: DashboardSnapshot;
	onRefreshSnapshot: () => Promise<void>;
	compact?: boolean;
};

type ActionOption = {
	id: string;
	label: string;
	description: string;
};

const sectionActions: Record<string, ActionOption[]> = {
	setup: [
		{
			id: "install",
			label: "Install repository",
			description: "Run the guided umbrella install flow for core setup and optional integrations.",
		},
		{
			id: "install-ide",
			label: "Install IDE integration",
			description: "Write project-local MCP configuration for an IDE or agent.",
		},
		{
			id: "refresh",
			label: "Refresh reports",
			description: "Refresh runtime state and regenerate reports.",
		},
	],
	runtime: [
		{
			id: "status",
			label: "Inspect runtime",
			description: "Check Docker, runtime, routing, and upgrade readiness.",
		},
		{ id: "start", label: "Start runtime", description: "Start project-local runtime services." },
		{
			id: "restart",
			label: "Restart runtime",
			description: "Restart project-local runtime services.",
		},
		{ id: "stop", label: "Stop runtime", description: "Stop project-local runtime services." },
		{
			id: "refresh",
			label: "Refresh runtime",
			description: "Refresh runtime state and live checks.",
		},
		{
			id: "doctor",
			label: "Inspect upgrade health",
			description: "Validate preserved runtime assets and upgrade drift.",
		},
	],
	upgrade: [
		{
			id: "status",
			label: "Inspect upgrade state",
			description: "Classify runtime upgrade drift and required actions.",
		},
		{
			id: "migrate",
			label: "Migrate runtime",
			description: "Run the supported in-place runtime migration flow.",
		},
		{
			id: "repair",
			label: "Repair runtime",
			description: "Repair resumable or degraded runtime upgrade state.",
		},
	],
	mcp: [
		{
			id: "list-tools",
			label: "List MCP tools",
			description: "Inspect unified and passthrough MCP tools.",
		},
		{
			id: "load-tools",
			label: "Load deferred tools",
			description: "Load a deferred engine group into the current session.",
		},
		{
			id: "tool",
			label: "Invoke MCP tool",
			description: "Choose and call a unified or passthrough MCP tool.",
		},
		{
			id: "tool-schema",
			label: "Inspect tool schema",
			description: "Compare compressed and full schema detail for a visible tool.",
		},
	],
	skills: [
		{
			id: "find",
			label: "Find skills",
			description: "List or search skills through the deterministic discovery contract.",
		},
		{
			id: "read",
			label: "Read skill",
			description: "Read a skill with compressed memory or targeted disclosure.",
		},
		{
			id: "resolve",
			label: "Resolve skills",
			description: "Rank relevant skills for a prompt with deterministic precedence.",
		},
		{
			id: "refresh",
			label: "Refresh skills",
			description: "Refresh repository-scoped skill cache and index state.",
		},
		{
			id: "create",
			label: "Create skill",
			description: "Guide new skill authoring with maintained prompts and validation.",
		},
		{
			id: "update",
			label: "Update skill",
			description: "Update an existing skill package or keep bundled maintenance workflows.",
		},
	],
};

const renderAction = (
	sectionId: string,
	actionId: string,
	presentation: PresentationProfile,
	onComplete: (state: WorkflowRunState) => void,
) => {
	if (sectionId === "setup") {
		if (actionId === "install") {
			return (
				<InstallCommand
					options={{}}
					presentation={presentation}
					exitOnComplete={false}
					onComplete={onComplete}
				/>
			);
		}
		if (actionId === "install-ide") {
			return (
				<InstallIdeCommand
					options={{}}
					presentation={presentation}
					exitOnComplete={false}
					onComplete={onComplete}
				/>
			);
		}
		return (
			<RefreshCommand
				options={{}}
				presentation={presentation}
				exitOnComplete={false}
				onComplete={onComplete}
			/>
		);
	}

	if (sectionId === "runtime") {
		switch (actionId) {
			case "status":
				return (
					<RuntimeStatusCommand
						options={{}}
						presentation={presentation}
						exitOnComplete={false}
						onComplete={onComplete}
					/>
				);
			case "start":
				return (
					<RuntimeStartCommand
						options={{}}
						presentation={presentation}
						exitOnComplete={false}
						onComplete={onComplete}
					/>
				);
			case "restart":
				return (
					<RuntimeRestartCommand
						options={{}}
						presentation={presentation}
						exitOnComplete={false}
						onComplete={onComplete}
					/>
				);
			case "stop":
				return (
					<RuntimeStopCommand
						options={{}}
						presentation={presentation}
						exitOnComplete={false}
						onComplete={onComplete}
					/>
				);
			case "refresh":
				return (
					<RuntimeRefreshCommand
						options={{}}
						presentation={presentation}
						exitOnComplete={false}
						onComplete={onComplete}
					/>
				);
			default:
				return (
					<RuntimeDoctorCommand
						options={{}}
						presentation={presentation}
						exitOnComplete={false}
						onComplete={onComplete}
					/>
				);
		}
	}

	if (sectionId === "upgrade") {
		switch (actionId) {
			case "status":
				return (
					<RuntimeUpgradeStatusCommand
						options={{}}
						presentation={presentation}
						exitOnComplete={false}
						onComplete={onComplete}
					/>
				);
			case "migrate":
				return (
					<RuntimeUpgradeMigrateCommand
						options={{}}
						presentation={presentation}
						exitOnComplete={false}
						onComplete={onComplete}
					/>
				);
			default:
				return (
					<RuntimeUpgradeRepairCommand
						options={{}}
						presentation={presentation}
						exitOnComplete={false}
						onComplete={onComplete}
					/>
				);
		}
	}

	if (sectionId === "mcp") {
		switch (actionId) {
			case "tool":
				return (
					<McpToolCommand
						args={[undefined, undefined]}
						options={{}}
						presentation={presentation}
						exitOnComplete={false}
						onComplete={onComplete}
					/>
				);
			case "load-tools":
				return (
					<McpLoadToolsCommand
						args={["srclight"]}
						options={{}}
						presentation={presentation}
						exitOnComplete={false}
						onComplete={onComplete}
					/>
				);
			case "tool-schema":
				return (
					<McpToolSchemaCommand
						args={["explain_project"]}
						options={{ view: "compressed" }}
						presentation={presentation}
						exitOnComplete={false}
						onComplete={onComplete}
					/>
				);
			default:
				return (
					<McpListToolsCommand
						options={{}}
						presentation={presentation}
						exitOnComplete={false}
						onComplete={onComplete}
					/>
				);
		}
	}

	if (sectionId === "skills") {
		switch (actionId) {
			case "find":
				return (
					<SkillsFindCommand
						options={{}}
						presentation={presentation}
						exitOnComplete={false}
						onComplete={onComplete}
					/>
				);
			case "read":
				return (
					<SkillsReadCommand
						args={["mimirmesh-code-navigation"]}
						options={{}}
						presentation={presentation}
						exitOnComplete={false}
						onComplete={onComplete}
					/>
				);
			case "resolve":
				return (
					<SkillsResolveCommand
						args={["improve the skill discovery workflow"]}
						options={{}}
						presentation={presentation}
						exitOnComplete={false}
						onComplete={onComplete}
					/>
				);
			case "refresh":
				return (
					<SkillsRefreshCommand
						options={{}}
						presentation={presentation}
						exitOnComplete={false}
						onComplete={onComplete}
					/>
				);
			case "create":
				return (
					<SkillsCreateCommand
						options={{
							prompt: "Create a MímirMesh skill that teaches deterministic skill discovery.",
						}}
						presentation={presentation}
						exitOnComplete={false}
						onComplete={onComplete}
					/>
				);
			default:
				return (
					<SkillsUpdateCommand
						args={["custom-skill"]}
						options={{
							prompt:
								"Update the custom skill package to preserve deterministic skill registry guidance.",
						}}
						presentation={presentation}
						exitOnComplete={false}
						onComplete={onComplete}
					/>
				);
		}
	}

	return null;
};

export const WorkflowLaunchers = ({
	sectionId,
	presentation,
	snapshot,
	onRefreshSnapshot,
	compact = false,
}: WorkflowLaunchersProps) => {
	const [activeActionId, setActiveActionId] = useState<string | null>(null);
	const [shellRefreshState, setShellRefreshState] = useState<"idle" | "refreshing" | "done">(
		"idle",
	);
	const actions = sectionActions[sectionId] ?? [];
	const selectedAction = useMemo(
		() => actions.find((action) => action.id === activeActionId) ?? null,
		[actions, activeActionId],
	);

	const closeActiveAction = useCallback(() => {
		setShellRefreshState("idle");
		setActiveActionId(null);
	}, []);

	const launchAction = useCallback((actionId: string) => {
		setShellRefreshState("idle");
		setActiveActionId(actionId);
	}, []);

	const handleWorkflowComplete = useCallback(
		async (_state: WorkflowRunState) => {
			setShellRefreshState("refreshing");
			await onRefreshSnapshot();
			setShellRefreshState("done");
		},
		[onRefreshSnapshot],
	);

	useInput((_input, key) => {
		if (key.escape && activeActionId) {
			closeActiveAction();
		}
	});

	if (sectionId === "home") {
		if (compact) {
			return (
				<Box flexDirection="column" gap={1}>
					<Text bold>Dashboard</Text>
					<Text>Project: {snapshot.context.projectRoot}</Text>
					<Text>Runtime: {snapshot.runtime.health.state}</Text>
					<Text>Upgrade: {snapshot.upgrade.report.state}</Text>
					<Text>MCP tools: {snapshot.tools.length}</Text>
					<Text dimColor>Use Left/Right to switch sections. Open a section to run a workflow.</Text>
				</Box>
			);
		}

		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Dashboard</Text>
				<Text>Project root: {snapshot.context.projectRoot}</Text>
				<Text>
					Runtime: {snapshot.runtime.health.state}. Upgrade: {snapshot.upgrade.report.state}. MCP
					tools: {snapshot.tools.length}.
				</Text>
				<WorkflowCard
					title="Install"
					status={
						snapshot.installState.completedAreas.includes("core")
							? "installed before"
							: snapshot.installState.degradedAreas.includes("core")
								? "repair recommended"
								: "install recommended"
					}
					description="Run the umbrella install flow to scaffold the repository, verify readiness, and attach optional integrations."
					nextAction="Use the Install section for `install` or `install ide`."
				/>
				<WorkflowCard
					title="Runtime control"
					status={snapshot.runtime.health.state}
					description="Start, stop, refresh, or inspect the project-local runtime with live health evidence."
					nextAction="Use the Runtime section for lifecycle and upgrade health actions."
				/>
				<WorkflowCard
					title="Upgrade and repair"
					status={snapshot.upgrade.report.state}
					description="Inspect drift, migrate supported runtime state, or repair degraded preserved assets."
					nextAction="Use the Upgrade section for status, migrate, or repair."
				/>
				<WorkflowCard
					title="MCP inspection"
					status={
						snapshot.runtime.health.state === "ready"
							? "runtime ready"
							: "passthrough readiness degraded"
					}
					description="Inspect unified and passthrough MCP tools, then invoke a specific tool when needed."
					nextAction="Use the MCP section for tool discovery and invocation."
				/>
				<WorkflowCard
					title="Skills"
					status="deterministic registry"
					description="Discover, read, resolve, refresh, create, or update repository skill workflows."
					nextAction="Use the Skills section for discovery, reading, resolution, refresh, and authoring."
				/>
			</Box>
		);
	}

	if (sectionId === "more") {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Command-first workflows</Text>
				<Text>
					These lower-frequency surfaces remain direct-command-first in the first TUI release.
				</Text>
				<Text>- `mimirmesh config get|set|enable|disable|validate`</Text>
				<Text>- `mimirmesh report generate|show`</Text>
				<Text>- `mimirmesh note add|list|search`</Text>
				<Text>- `mimirmesh document add`</Text>
				<Text>- `mimirmesh skills find|read|resolve|refresh|create|update`</Text>
				<Text>- `mimirmesh skills install|update|remove`</Text>
				<Text>- `mimirmesh speckit init|status|doctor`</Text>
			</Box>
		);
	}

	if (activeActionId) {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>{selectedAction?.label ?? activeActionId}</Text>
				<Text>{selectedAction?.description ?? "Embedded workflow surface."}</Text>
				{renderAction(sectionId, activeActionId, presentation, handleWorkflowComplete)}
				{shellRefreshState === "refreshing" ? (
					<Text dimColor>Refreshing shell state with the latest project and runtime status...</Text>
				) : shellRefreshState === "done" ? (
					<Text dimColor>Shell state refreshed. Press Escape to return to the action list.</Text>
				) : (
					<Text dimColor>Press Escape to return to the action list.</Text>
				)}
			</Box>
		);
	}

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold>
				{sectionId[0]?.toUpperCase()}
				{sectionId.slice(1)}
			</Text>
			<Text>
				Use Up/Down to focus an action and Enter to launch it. The shell status refreshes once after
				each workflow completes.
			</Text>
			<Select
				visibleOptionCount={compact ? Math.min(actions.length, 4) : Math.min(actions.length, 6)}
				options={actions.map((action) => ({
					label: action.label,
					value: action.id,
				}))}
				onChange={(value) => {
					launchAction(value);
				}}
			/>
			{compact ? (
				<Text dimColor>
					Compact mode hides the long action descriptions. Resize wider for the full dashboard
					layout.
				</Text>
			) : (
				<Box flexDirection="column">
					{actions.map((action) => (
						<Text key={action.id}>
							{action.label}: {action.description}
						</Text>
					))}
				</Box>
			)}
		</Box>
	);
};
