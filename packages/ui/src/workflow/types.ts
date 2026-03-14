export type WorkflowCategory =
	| "dashboard"
	| "setup"
	| "runtime"
	| "mcp"
	| "configuration"
	| "reporting"
	| "notes"
	| "repair"
	| "upgrade"
	| "integration";

export type WorkflowEntryMode = "tui-embedded" | "tui-launcher" | "direct-command";

export type WorkflowInteractivePolicy =
	| "default-interactive"
	| "default-non-interactive"
	| "explicit-choice";

export type WorkflowPhase =
	| "idle"
	| "running"
	| "awaiting-input"
	| "success"
	| "degraded"
	| "failed"
	| "cancelled";

export type WorkflowStepKind =
	| "validation"
	| "generation"
	| "runtime-action"
	| "discovery"
	| "bootstrap"
	| "prompt"
	| "reporting"
	| "finalization";

export type WorkflowStepStatus =
	| "pending"
	| "running"
	| "completed"
	| "degraded"
	| "failed"
	| "skipped";

export type TerminalOutcomeKind = "success" | "degraded" | "failed";

export type EvidenceTone = "neutral" | "positive" | "warning" | "negative";

export type WorkflowEvidenceRow = {
	label: string;
	value: string;
	tone?: EvidenceTone;
};

export type WorkflowWarning = {
	id: string;
	label: string;
	message: string;
};

export type PromptChoice = {
	label: string;
	value: string;
	description?: string;
	recommended?: boolean;
};

export type PromptSession = {
	workflowId: string;
	promptId: string;
	controlType: "confirm" | "select" | "text-input" | "multi-select";
	reason: string;
	defaultAction: string;
	choices?: readonly PromptChoice[];
	response?: string | string[] | boolean;
	nonInteractiveFallback: string;
};

export type PresentationProfile = {
	mode: "tui" | "direct-human" | "direct-machine";
	interactive: boolean;
	reducedMotion: boolean;
	colorSupport: "none" | "basic" | "rich";
	screenReaderFriendlyText: boolean;
	terminalSizeClass: "compact" | "standard" | "wide";
};

export type WorkflowStepTemplate = {
	id: string;
	label: string;
	kind: WorkflowStepKind;
	summary?: string;
};

export type WorkflowStep = WorkflowStepTemplate & {
	status: WorkflowStepStatus;
	summary?: string;
	evidence?: WorkflowEvidenceRow[];
};

export type TerminalOutcome = {
	kind: TerminalOutcomeKind;
	message: string;
	impact: string;
	completedWork: string[];
	blockedCapabilities: string[];
	nextAction: string;
	evidence?: WorkflowEvidenceRow[];
	machineReadablePayload?: Record<string, unknown>;
};

export type WorkflowRunState = {
	workflowId: string;
	phase: WorkflowPhase;
	activeStepId: string | null;
	completedStepIds: string[];
	warnings: WorkflowWarning[];
	details: WorkflowEvidenceRow[];
	startedAt: string;
	completedAt: string | null;
	steps: WorkflowStep[];
	promptSession: PromptSession | null;
	outcome: TerminalOutcome | null;
};

export type WorkflowController = {
	startStep: (stepId: string, summary?: string) => void;
	completeStep: (
		stepId: string,
		options?: { summary?: string; evidence?: WorkflowEvidenceRow[] },
	) => void;
	degradeStep: (
		stepId: string,
		options?: { summary?: string; evidence?: WorkflowEvidenceRow[] },
	) => void;
	failStep: (
		stepId: string,
		options?: { summary?: string; evidence?: WorkflowEvidenceRow[] },
	) => void;
	skipStep: (stepId: string, summary?: string) => void;
	addWarning: (warning: WorkflowWarning) => void;
	addDetail: (detail: WorkflowEvidenceRow) => void;
	setPrompt: (prompt: PromptSession | null) => void;
};

export type WorkflowExecutionContext = {
	controller: WorkflowController;
	presentation: PresentationProfile;
};

export type WorkflowDefinition = {
	id: string;
	title: string;
	description: string;
	category: WorkflowCategory;
	entryModes: WorkflowEntryMode[];
	interactivePolicy: WorkflowInteractivePolicy;
	machineReadableSupported: boolean;
	requiresProjectContext: boolean;
	recommendedNextActions: string[];
	steps: WorkflowStepTemplate[];
	execute: (context: WorkflowExecutionContext) => Promise<TerminalOutcome>;
};
