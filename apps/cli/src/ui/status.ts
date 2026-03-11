export type CliStatusTone = "info" | "success" | "warning" | "error";

export const formatStatusLine = (tone: CliStatusTone, message: string): string =>
  `[${tone.toUpperCase()}] ${message}`;
