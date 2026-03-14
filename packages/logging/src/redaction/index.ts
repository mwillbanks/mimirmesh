export const redactSecrets = (input: string, patterns: string[]): string => {
	let output = input;
	for (const pattern of patterns) {
		try {
			const regex = new RegExp(pattern, "g");
			output = output.replace(regex, "[REDACTED]");
		} catch {
			// Ignore malformed regex patterns from config and continue logging.
		}
	}
	return output;
};
