import {
	describeEmbeddingsInstallConfig,
	type InstallAreaId,
	type InstallationPolicy,
} from "./install-policy";

export type DetectedInstallArtifact = {
	areaId: InstallAreaId;
	path: string;
	status: "present" | "missing" | "degraded";
	detail?: string;
	requiresConfirmation?: boolean;
};

export type InstallationStateSnapshot = {
	projectRoot: string;
	completedAreas: InstallAreaId[];
	degradedAreas: InstallAreaId[];
	pendingAreas: InstallAreaId[];
	detectedArtifacts: DetectedInstallArtifact[];
	specKitStatus: {
		ready: boolean;
		details?: string;
	};
	runtimeStatus: {
		state: string;
		message: string;
		reasons: string[];
	};
};

export type InstallChangeSummary = {
	createdFiles: string[];
	updatedFiles: string[];
	skippedAreas: InstallAreaId[];
	appliedAreas: InstallAreaId[];
	warnings: string[];
};

const unique = <T>(values: T[]): T[] => [...new Set(values)];

export const createInstallationStateSnapshot = (
	snapshot: InstallationStateSnapshot,
): InstallationStateSnapshot => ({
	...snapshot,
	completedAreas: unique(snapshot.completedAreas),
	degradedAreas: unique(snapshot.degradedAreas),
	pendingAreas: unique(snapshot.pendingAreas),
	detectedArtifacts: snapshot.detectedArtifacts,
});

export const buildInstallChangeSummary = (
	policy: InstallationPolicy,
	snapshot: InstallationStateSnapshot,
): InstallChangeSummary => {
	const selectedAreas = unique(policy.selectedAreas);
	const createdFiles: string[] = [];
	const updatedFiles: string[] = [];
	const warnings = [...snapshot.runtimeStatus.reasons];

	for (const artifact of snapshot.detectedArtifacts) {
		if (!selectedAreas.includes(artifact.areaId)) {
			continue;
		}

		if (artifact.status === "missing") {
			createdFiles.push(artifact.path);
			continue;
		}

		if (artifact.requiresConfirmation ?? true) {
			updatedFiles.push(artifact.path);
		}
		if (artifact.detail) {
			warnings.push(artifact.detail);
		}
	}

	if (selectedAreas.includes("skills")) {
		warnings.push(describeEmbeddingsInstallConfig(policy.embeddings));
	}

	return {
		createdFiles: unique(createdFiles).sort((left, right) => left.localeCompare(right)),
		updatedFiles: unique(updatedFiles).sort((left, right) => left.localeCompare(right)),
		skippedAreas: unique(
			(["core", "ide", "skills"] as InstallAreaId[]).filter(
				(area) => !selectedAreas.includes(area),
			),
		),
		appliedAreas: selectedAreas,
		warnings: unique(warnings).filter(Boolean),
	};
};
