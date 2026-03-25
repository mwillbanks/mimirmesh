import type { InstallationStateSnapshot, InstallChangeSummary } from "@mimirmesh/installer";
import { GuidedConfirm, StateMessage } from "@mimirmesh/ui";
import { Box, Text } from "ink";

type InstallReviewProps = {
	snapshot: InstallationStateSnapshot;
	summary: InstallChangeSummary;
	onConfirm: () => void;
	onCancel: () => void;
};

const renderAreas = (label: string, values: string[]) => (
	<Text>
		<Text bold>{label}:</Text> {values.length > 0 ? values.join(", ") : "None"}
	</Text>
);

export const InstallReview = ({ snapshot, summary, onConfirm, onCancel }: InstallReviewProps) => (
	<Box flexDirection="column" gap={1}>
		<Text bold>Review install changes</Text>
		<Text>
			Current runtime state: {snapshot.runtimeStatus.state}. Spec Kit:{" "}
			{snapshot.specKitStatus.ready ? "ready" : "needs setup"}.
		</Text>
		{renderAreas("Applied areas", summary.appliedAreas)}
		{renderAreas("Skipped areas", summary.skippedAreas)}
		{summary.createdFiles.length > 0 ? (
			<Box flexDirection="column">
				<Text bold>New install-managed paths</Text>
				{summary.createdFiles.map((path) => (
					<Text key={path}>{path}</Text>
				))}
			</Box>
		) : null}
		{summary.updatedFiles.length > 0 ? (
			<Box flexDirection="column">
				<Text bold>Existing install-managed paths that will be updated</Text>
				{summary.updatedFiles.map((path) => (
					<StateMessage key={path} variant="warning">
						{path}
					</StateMessage>
				))}
			</Box>
		) : null}
		{summary.warnings.length > 0 ? (
			<Box flexDirection="column">
				<Text bold>Observed warnings</Text>
				{summary.warnings.map((warning) => (
					<StateMessage key={warning} variant="warning">
						{warning}
					</StateMessage>
				))}
			</Box>
		) : null}
		<GuidedConfirm
			title="Confirm install-managed updates"
			reason="The selected install plan will modify existing install-managed files or directories."
			consequence="Continuing applies the reviewed install plan. Cancelling leaves the current repository state unchanged."
			nonInteractiveFallback="mimirmesh install --non-interactive --preset <preset> --areas core,skills"
			confirmText="Apply changes"
			cancelText="Keep current state"
			onConfirm={onConfirm}
			onCancel={onCancel}
		/>
	</Box>
);
