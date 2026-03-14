export type AdrSettings = {
	projectPath: string;
	adrDirectory: string;
	executionMode: "full" | "prompt-only";
	openrouterApiKey: string | null;
};
