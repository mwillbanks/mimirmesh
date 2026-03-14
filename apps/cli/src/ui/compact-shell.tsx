import { CompactTerminalNotice, type PresentationProfile } from "@mimirmesh/ui";

type CompactShellProps = {
	columns?: number;
	rows?: number;
	presentation: PresentationProfile;
};

export const CompactShell = ({ columns, rows, presentation }: CompactShellProps) => (
	<CompactTerminalNotice
		title="Compact terminal fallback"
		reason={`The current terminal${columns && rows ? ` (${columns}x${rows})` : ""} is too small for the interactive dashboard. Use direct commands for the same workflows or resize the terminal and rerun \`mimirmesh\`.`}
		colorSupport={presentation.colorSupport}
		recommendedCommands={[
			"mimirmesh init",
			"mimirmesh runtime status",
			"mimirmesh runtime upgrade status",
			"mimirmesh mcp list-tools",
			"mimirmesh install ide",
		]}
	/>
);
