import type { ProjectRuntimeVersionRecord, UpgradeCheckpoint } from "@mimirmesh/config";

import { loadUpgradeCheckpoint, persistUpgradeCheckpoint } from "../state/io";

export const createUpgradeCheckpoint = (options: {
	upgradeId: string;
	targetVersion: ProjectRuntimeVersionRecord;
}): UpgradeCheckpoint => ({
	upgradeId: options.upgradeId,
	targetVersion: options.targetVersion,
	currentStepId: null,
	completedStepIds: [],
	quarantinedStepIds: [],
	lastAttemptAt: new Date().toISOString(),
	resumeAllowed: true,
	failureReason: null,
});

export const loadCheckpoint = async (projectRoot: string): Promise<UpgradeCheckpoint | null> =>
	loadUpgradeCheckpoint(projectRoot);

export const saveCheckpoint = async (
	projectRoot: string,
	checkpoint: UpgradeCheckpoint,
): Promise<UpgradeCheckpoint> => {
	const next = {
		...checkpoint,
		lastAttemptAt: new Date().toISOString(),
	};
	await persistUpgradeCheckpoint(projectRoot, next);
	return next;
};

export const startCheckpointStep = async (options: {
	projectRoot: string;
	checkpoint: UpgradeCheckpoint;
	stepId: string;
}): Promise<UpgradeCheckpoint> =>
	saveCheckpoint(options.projectRoot, {
		...options.checkpoint,
		currentStepId: options.stepId,
		resumeAllowed: true,
		failureReason: null,
	});

export const completeCheckpointStep = async (options: {
	projectRoot: string;
	checkpoint: UpgradeCheckpoint;
	stepId: string;
}): Promise<UpgradeCheckpoint> => {
	const completed = options.checkpoint.completedStepIds.includes(options.stepId)
		? options.checkpoint.completedStepIds
		: [...options.checkpoint.completedStepIds, options.stepId];

	return saveCheckpoint(options.projectRoot, {
		...options.checkpoint,
		currentStepId: null,
		completedStepIds: completed,
		quarantinedStepIds: options.checkpoint.quarantinedStepIds.filter(
			(entry) => entry !== options.stepId,
		),
		failureReason: null,
	});
};

export const quarantineCheckpointStep = async (options: {
	projectRoot: string;
	checkpoint: UpgradeCheckpoint;
	stepId: string;
	failureReason: string;
}): Promise<UpgradeCheckpoint> => {
	const quarantined = options.checkpoint.quarantinedStepIds.includes(options.stepId)
		? options.checkpoint.quarantinedStepIds
		: [...options.checkpoint.quarantinedStepIds, options.stepId];

	return saveCheckpoint(options.projectRoot, {
		...options.checkpoint,
		currentStepId: null,
		quarantinedStepIds: quarantined,
		failureReason: options.failureReason,
		resumeAllowed: true,
	});
};

export const failCheckpointStep = async (options: {
	projectRoot: string;
	checkpoint: UpgradeCheckpoint;
	stepId: string;
	failureReason: string;
	resumeAllowed?: boolean;
}): Promise<UpgradeCheckpoint> =>
	saveCheckpoint(options.projectRoot, {
		...options.checkpoint,
		currentStepId: options.stepId,
		failureReason: options.failureReason,
		resumeAllowed: options.resumeAllowed ?? false,
	});

export const finishCheckpoint = async (options: {
	projectRoot: string;
	checkpoint: UpgradeCheckpoint;
}): Promise<UpgradeCheckpoint> =>
	saveCheckpoint(options.projectRoot, {
		...options.checkpoint,
		currentStepId: null,
		resumeAllowed: false,
		failureReason: null,
	});
