export {
  analyzeRepository,
  collectRepositoryFiles,
  detectRepoType,
  findSymbols,
  isInsideGitRepo,
  searchInRepository,
  traceDependency,
  type DependencyTrace,
  type RepositoryAnalysis,
  type RepositoryShape,
  type SearchHit,
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
export { createMountPlan } from "./mounts";
export { getRepositoryName, pathExists } from "./paths";
