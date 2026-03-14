import { basename } from "node:path";
import { type PresentationProfile, ShellFrame, SpinnerLine, StateMessage } from "@mimirmesh/ui";
import { Box, Text, useApp, useInput } from "ink";
import { useCallback, useEffect, useMemo, useState } from "react";

import { collectDashboardSnapshot } from "../lib/context";
import { CompactShell } from "./compact-shell";
import { Navigation } from "./navigation";
import { WorkflowLaunchers } from "./workflow-launchers";

const sections = [
	{ id: "home", title: "Home" },
	{ id: "setup", title: "Setup" },
	{ id: "runtime", title: "Runtime" },
	{ id: "upgrade", title: "Upgrade" },
	{ id: "mcp", title: "MCP" },
	{ id: "more", title: "More" },
] as const;

type DashboardScreenProps = {
	presentation: PresentationProfile;
};

export const DashboardScreen = ({ presentation }: DashboardScreenProps) => {
	const { exit } = useApp();
	const [sectionIndex, setSectionIndex] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [snapshot, setSnapshot] = useState<Awaited<
		ReturnType<typeof collectDashboardSnapshot>
	> | null>(null);

	const refreshSnapshot = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setSnapshot(await collectDashboardSnapshot());
		} catch (nextError) {
			setError(nextError instanceof Error ? nextError.message : String(nextError));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refreshSnapshot();
	}, [refreshSnapshot]);

	const columns = process.stdout.columns ?? 80;
	const rows = process.stdout.rows ?? 24;
	const compactLayout = presentation.terminalSizeClass === "compact";
	const terminalTooSmall = columns < 72 || rows < 18;

	useInput((_input, key) => {
		if (_input === "q") {
			exit();
			return;
		}
		if (key.leftArrow) {
			setSectionIndex((current) => (current === 0 ? sections.length - 1 : current - 1));
		}
		if (key.rightArrow) {
			setSectionIndex((current) => (current === sections.length - 1 ? 0 : current + 1));
		}
		if (_input === "h") {
			setSectionIndex(0);
		}
		if (_input === "s") {
			setSectionIndex(1);
		}
		if (_input === "r") {
			setSectionIndex(2);
		}
		if (_input === "u") {
			setSectionIndex(3);
		}
		if (_input === "m") {
			setSectionIndex(4);
		}
	});

	const activeSection = sections[sectionIndex]?.id ?? "home";

	const navigationItems = useMemo(
		() =>
			sections.map((section) => {
				if (!snapshot) {
					return {
						id: section.id,
						title: section.title,
						statusSummary: "Loading project state...",
					};
				}

				switch (section.id) {
					case "home":
						return {
							id: section.id,
							title: section.title,
							statusSummary: `Project ${snapshot.initSignals.analysis.shape}, runtime ${snapshot.runtime.health.state}`,
						};
					case "setup":
						return {
							id: section.id,
							title: section.title,
							statusSummary: snapshot.context.config.metadata.lastInitAt
								? "initialized before"
								: "init recommended",
						};
					case "runtime":
						return {
							id: section.id,
							title: section.title,
							statusSummary: `runtime ${snapshot.runtime.health.state}`,
						};
					case "upgrade":
						return {
							id: section.id,
							title: section.title,
							statusSummary: `upgrade ${snapshot.upgrade.report.state}`,
						};
					case "mcp":
						return {
							id: section.id,
							title: section.title,
							statusSummary:
								snapshot.runtime.health.state === "ready"
									? `${snapshot.tools.length} tools available`
									: "passthrough readiness degraded",
						};
					default:
						return {
							id: section.id,
							title: section.title,
							statusSummary: "config, reports, notes, integrations",
						};
				}
			}),
		[snapshot],
	);

	if (terminalTooSmall) {
		return <CompactShell columns={columns} rows={rows} presentation={presentation} />;
	}

	if (loading && !snapshot) {
		return (
			<ShellFrame
				title="Interactive CLI Experience"
				subtitle={
					compactLayout
						? "Collecting live project state for the compact dashboard."
						: "Collecting live project, runtime, upgrade, and MCP state for the shell."
				}
				presentation={presentation}
				footer={
					compactLayout ? (
						<Text>Keyboard: L/R section, U/D action, Enter launch, Esc back, Q exit.</Text>
					) : undefined
				}
			>
				<SpinnerLine label="Loading dashboard state" reducedMotion={presentation.reducedMotion} />
			</ShellFrame>
		);
	}

	if (error || !snapshot) {
		return (
			<ShellFrame
				title="Interactive CLI Experience"
				subtitle="The dashboard could not load live project state."
				presentation={presentation}
				footer={
					compactLayout ? (
						<Text>Keyboard: L/R section, U/D action, Enter launch, Esc back, Q exit.</Text>
					) : undefined
				}
			>
				<StateMessage variant="failed">
					{error ?? "Dashboard state could not be collected."}
				</StateMessage>
			</ShellFrame>
		);
	}

	return (
		<ShellFrame
			title="Interactive CLI Experience"
			subtitle={
				compactLayout
					? "Use the compact dashboard to launch the core setup, runtime, upgrade, and MCP workflows."
					: "Use the dashboard to launch the core setup, runtime, upgrade, and MCP workflows."
			}
			presentation={presentation}
			sidebar={
				compactLayout ? undefined : <Navigation items={navigationItems} activeId={activeSection} />
			}
			statusLine={
				compactLayout ? (
					<Text>
						<Text bold>Project:</Text> {basename(snapshot.context.projectRoot)} |{" "}
						<Text bold>Runtime:</Text> {snapshot.runtime.health.state} | <Text bold>Upgrade:</Text>{" "}
						{snapshot.upgrade.report.state}
					</Text>
				) : (
					<Box flexDirection="column">
						<Text>
							<Text bold>Project:</Text> {snapshot.context.projectRoot}
						</Text>
						<Text>
							<Text bold>Runtime:</Text> {snapshot.runtime.health.state}
						</Text>
						<Text>
							<Text bold>Config valid:</Text> {String(snapshot.configValidation.ok)}
						</Text>
					</Box>
				)
			}
			footer={
				compactLayout ? (
					<Text>Keyboard: L/R section, U/D action, Enter launch, Esc back, Q exit.</Text>
				) : (
					<Text>
						Keyboard: Left/Right changes section, Up/Down selects actions, Enter launches, Escape
						returns, H/S/R/U/M jump to core sections, Q exits.
					</Text>
				)
			}
		>
			<WorkflowLaunchers
				sectionId={activeSection}
				presentation={presentation}
				snapshot={snapshot}
				compact={compactLayout}
				onRefreshSnapshot={refreshSnapshot}
			/>
			{loading ? (
				<Text dimColor>{compactLayout ? "Refreshing state..." : "Refreshing shell state..."}</Text>
			) : null}
		</ShellFrame>
	);
};
