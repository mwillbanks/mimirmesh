import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { resolveRepositoryAdrDirectory } from "../adr";
import { getMimirmeshDir, projectSlug, runtimeDir } from "../paths";
import type { EngineConfig, MimirmeshConfig, MimirmeshGlobalConfig } from "../schema";
import { createDefaultSkillsConfig } from "./skills";

const DEFAULT_REDACT_PATTERNS = [
	"(?i)apikey",
	"(?i)token",
	"(?i)password",
	"(?i)secret",
	"(?i)authorization",
];

const runtimeImagesRoot = ".mimirmesh/runtime/images";

const engineImage = (service: string, dockerfile: string): EngineConfig["image"] => ({
	service,
	dockerfile,
	context: runtimeImagesRoot,
	tag: `mimirmesh/${service}:local`,
});

const detectDocumentMountConfig = (
	projectRoot: string,
	repoMount: string,
): {
	watchFolders: string[];
} => {
	if (existsSync(join(projectRoot, "docs"))) {
		return {
			watchFolders: [`${repoMount}/docs`],
		};
	}

	return {
		watchFolders: [repoMount],
	};
};

export const defaultEngines = (projectRoot: string): MimirmeshConfig["engines"] => {
	const repoMount = "/workspace";
	const mimirmeshMount = "/mimirmesh";
	const documentMountConfig = detectDocumentMountConfig(projectRoot, repoMount);
	const mounts = {
		repo: repoMount,
		mimirmesh: mimirmeshMount,
		logs: `${mimirmeshMount}/logs`,
		indexes: `${mimirmeshMount}/indexes`,
		templates: `${mimirmeshMount}/templates`,
	};

	return {
		srclight: {
			enabled: true,
			required: false,
			displayName: "Srclight",
			namespace: "mimirmesh.srclight",
			serviceName: "mm-srclight",
			image: engineImage("mm-srclight", `${runtimeImagesRoot}/srclight/Dockerfile`),
			bridge: {
				containerPort: 4701,
				healthPath: "/health",
				discoverPath: "/discover",
				callPath: "/call",
			},
			mounts,
			settings: {
				transport: "sse",
				port: 8742,
				rootPath: repoMount,
				indexOnStart: true,
				embedModel: process.env.MIMIRMESH_SRCLIGHT_EMBED_MODEL ?? null,
				defaultEmbedModel: process.env.MIMIRMESH_SRCLIGHT_DEFAULT_EMBED_MODEL ?? "nomic-embed-text",
				ollamaBaseUrl:
					process.env.MIMIRMESH_SRCLIGHT_OLLAMA_BASE_URL ?? "http://host.docker.internal:11434",
				embedRequestTimeoutSeconds: 20,
			},
		},
		"document-mcp": {
			enabled: true,
			required: false,
			displayName: "Document MCP",
			namespace: "mimirmesh.docs",
			serviceName: "mm-document-mcp",
			image: engineImage("mm-document-mcp", `${runtimeImagesRoot}/document-mcp/Dockerfile`),
			bridge: {
				containerPort: 4701,
				healthPath: "/health",
				discoverPath: "/discover",
				callPath: "/call",
			},
			mounts,
			settings: {
				watchFolders: documentMountConfig.watchFolders,
				lancedbPath: `${mimirmeshMount}/indexes/document-mcp`,
				llmModel: "llama3.2:3b",
				embeddingModel: "all-MiniLM-L6-v2",
				fileExtensions: [".pdf", ".docx", ".doc", ".txt", ".md", ".rtf"],
				chunkSize: 1000,
				chunkOverlap: 200,
				maxFileSizeMb: 100,
				ollamaBaseUrl: "http://host.docker.internal:11434",
				batchSize: 10,
			},
		},
		"mcp-adr-analysis-server": {
			enabled: true,
			required: false,
			displayName: "ADR Analysis",
			namespace: "mimirmesh.adr",
			serviceName: "mm-adr-analysis",
			image: engineImage("mm-adr-analysis", `${runtimeImagesRoot}/adr-analysis/Dockerfile`),
			bridge: {
				containerPort: 4701,
				healthPath: "/health",
				discoverPath: "/discover",
				callPath: "/call",
			},
			mounts,
			settings: {
				projectPath: repoMount,
				adrDirectory: resolveRepositoryAdrDirectory(projectRoot),
				executionMode: process.env.OPENROUTER_API_KEY ? "full" : "prompt-only",
				openrouterApiKey: process.env.OPENROUTER_API_KEY ?? null,
			},
		},
	};
};

export const createDefaultConfig = (projectRoot: string): MimirmeshConfig => {
	const runtime = runtimeDir(projectRoot);
	const initializedAt = new Date().toISOString();

	return {
		version: 2,
		project: {
			name: basename(projectRoot),
			rootPath: projectRoot,
			initializedAt,
		},
		engines: defaultEngines(projectRoot),
		runtime: {
			composeFile: join(runtime, "docker-compose.yml"),
			connectionFile: join(runtime, "connection.json"),
			healthFile: join(runtime, "health.json"),
			routingTableFile: join(runtime, "routing-table.json"),
			bootstrapStateFile: join(runtime, "bootstrap-state.json"),
			enginesStateDir: join(runtime, "engines"),
			projectName: `mimirmesh-${projectSlug(projectRoot)}`,
			autoStart: true,
			preferInternalNetwork: true,
			useRandomPorts: true,
			gpuMode: "auto",
			state: "failed",
		},
		logging: {
			level: "info",
			sessionLogging: true,
			redactPatterns: DEFAULT_REDACT_PATTERNS,
		},
		templates: {
			overrideDir: join(getMimirmeshDir(projectRoot), "templates"),
			families: {
				architecture: "architecture.md",
				feature: "feature.md",
				runbook: "runbook.md",
				operationalNote: "operational-note.md",
				decisionNote: "decision-note.md",
				agentGuidance: "agent-guidance.md",
			},
		},
		ide: {
			targets: {
				vscode: { installed: false, configPath: join(projectRoot, ".vscode", "mcp.json") },
				cursor: { installed: false, configPath: join(projectRoot, ".cursor", "mcp.json") },
				claude: { installed: false, configPath: join(projectRoot, ".claude", "mcp.json") },
				codex: { installed: false, configPath: join(projectRoot, ".codex", "mcp.json") },
			},
		},
		mcp: {
			toolSurface: {
				compressionLevel: "balanced",
				coreEngineGroups: [],
				deferredEngineGroups: ["srclight", "document-mcp", "mcp-adr-analysis-server"],
				deferredVisibility: "summary",
				fullSchemaAccess: true,
				refreshPolicy: "explicit",
				allowInvocationLazyLoad: true,
			},
			routingHints: {
				adaptiveSubset: {
					include: [],
					exclude: [],
				},
			},
		},
		skills: createDefaultSkillsConfig(),
		update: {
			channel: "stable",
			autoCheck: true,
		},
		metadata: {
			lastInitAt: null,
			lastRefreshAt: null,
			lastDoctorAt: null,
			specKitExpected: true,
		},
	};
};

export const createDefaultGlobalConfig = (): MimirmeshGlobalConfig => ({
	version: 1,
	skills: {
		install: {
			symbolic: true,
		},
	},
});

export { createDefaultSkillsConfig } from "./skills";
