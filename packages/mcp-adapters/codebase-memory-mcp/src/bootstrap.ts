import type { EngineBootstrapDefinition } from "../../src/types";

// The codebase-memory engine auto-indexes from REPO_PATH during startup, so issuing
// an additional index_repository bootstrap call creates a duplicate index race.
export const codebaseMemoryBootstrap: EngineBootstrapDefinition | null = null;
