import type { MimirmeshConfig } from "@mimirmesh/config";

export type LogChannel = "cli" | "mcp" | "runtime" | "engines" | "tool-calls";

export type LoggerOptions = {
  projectRoot: string;
  config: MimirmeshConfig;
  sessionId?: string;
};

export type ProjectLogger = {
  sessionId: string;
  log: (
    channel: LogChannel,
    level: "debug" | "info" | "warn" | "error",
    message: string,
  ) => Promise<void>;
  error: (message: string, details?: string) => Promise<void>;
};
