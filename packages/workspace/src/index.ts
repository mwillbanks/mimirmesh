export {
	analyzeRepository,
	collectRepositoryFiles,
	type DependencyTrace,
	detectRepoType,
	findSymbols,
	isInsideGitRepo,
	type RepositoryAnalysis,
	type RepositoryShape,
	type SearchHit,
	searchInRepository,
	traceDependency,
} from "./detection/repository";
export {
	detectSpecKit,
	detectSpecKit as detectSpecKitStatus,
	doctorSpecKit,
	initializeSpecKit,
	type SpecKitDoctorResult,
	type SpecKitInitResult,
	type SpecKitInstallMode,
	type SpecKitStatus,
} from "./detection/speckit";
export {
	loadRepositoryIgnoreMatcher,
	type RepositoryIgnoreMatcher,
} from "./ignore";
export { createMountPlan } from "./mounts";
export { getRepositoryName, pathExists } from "./paths";
