import type { SkillCompressionAlgorithm } from "./types";

const bunCompression = Bun as unknown as {
	gzipSync?: (value: Uint8Array | string) => Uint8Array;
	gunzipSync?: (value: Uint8Array) => Uint8Array;
	zstdCompressSync?: (value: Uint8Array | string) => Uint8Array;
	zstdDecompressSync?: (value: Uint8Array) => Uint8Array;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const resolveCompressionAlgorithm = (
	requested: SkillCompressionAlgorithm,
	fallback: SkillCompressionAlgorithm = "gzip",
): SkillCompressionAlgorithm => {
	if (requested === "zstd" && typeof bunCompression.zstdCompressSync === "function") {
		return "zstd";
	}
	if (requested === "gzip" && typeof bunCompression.gzipSync === "function") {
		return "gzip";
	}
	if (fallback !== requested) {
		return resolveCompressionAlgorithm(fallback, "none");
	}
	return "none";
};

export const compressText = (
	value: string,
	requested: SkillCompressionAlgorithm = "zstd",
): { algorithm: SkillCompressionAlgorithm; data: string; sizeBytes: number } => {
	const algorithm = resolveCompressionAlgorithm(requested);
	const input = textEncoder.encode(value);
	if (algorithm === "zstd" && bunCompression.zstdCompressSync) {
		const compressed = bunCompression.zstdCompressSync(input);
		return {
			algorithm,
			data: Buffer.from(compressed).toString("base64"),
			sizeBytes: compressed.byteLength,
		};
	}
	if (algorithm === "gzip" && bunCompression.gzipSync) {
		const compressed = bunCompression.gzipSync(input);
		return {
			algorithm,
			data: Buffer.from(compressed).toString("base64"),
			sizeBytes: compressed.byteLength,
		};
	}
	return {
		algorithm: "none",
		data: Buffer.from(input).toString("base64"),
		sizeBytes: input.byteLength,
	};
};

export const decompressText = (value: {
	algorithm: SkillCompressionAlgorithm;
	data: string;
}): string => {
	const bytes = Buffer.from(value.data, "base64");
	if (value.algorithm === "zstd" && bunCompression.zstdDecompressSync) {
		return textDecoder.decode(bunCompression.zstdDecompressSync(bytes));
	}
	if (value.algorithm === "gzip" && bunCompression.gunzipSync) {
		return textDecoder.decode(bunCompression.gunzipSync(bytes));
	}
	return textDecoder.decode(bytes);
};
