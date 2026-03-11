export type SpecKitInstallMode = "existing" | "uv-tool" | "uvx" | "missing";

export type SpecKitStatus = {
	initialized: boolean;
	ready: boolean;
	signals: string[];
	missing: string[];
	findings: string[];
	binary: string | null;
	version: string | null;
	installMode: SpecKitInstallMode;
	agent: string | null;
	promptDirectories: string[];
	translatedSpecsDir: string;
	legacySpecsDir: string;
};

export type SpecKitInitResult = {
	initialized: boolean;
	installed: boolean;
	binary: string;
	version: string | null;
	installMode: SpecKitInstallMode;
	agent: string;
	translatedPaths: string[];
	status: SpecKitStatus;
};

export type SpecKitDoctorResult = {
	ready: boolean;
	findings: string[];
	status: SpecKitStatus;
};

export type SpecKitInitOptions = {
	agent?: string;
	force?: boolean;
};
