export type DocumentMcpSettings = {
	watchFolders: string[];
	lancedbPath: string;
	llmModel: string;
	embeddingModel: string;
	fileExtensions: string[];
	chunkSize: number;
	chunkOverlap: number;
	maxFileSizeMb: number;
	ollamaBaseUrl: string;
	batchSize: number;
};
