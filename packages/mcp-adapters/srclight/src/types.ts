export type SrclightSettings = {
	transport: "stdio" | "sse";
	port: number;
	rootPath: string;
	indexOnStart: boolean;
	embedModel: string | null;
	defaultEmbedModel: string;
	ollamaBaseUrl: string | null;
	embedRequestTimeoutSeconds: number;
};
