import { join } from "node:path";

import { getMimirmeshDir } from "@mimirmesh/config";

import { getLogLayout, sessionLogFilenames } from "./layout";
import type { LogChannel } from "./types";

export const getSessionLogPath = (
  projectRoot: string,
  sessionId: string,
  channel: LogChannel,
): string => {
  const layout = getLogLayout(projectRoot, sessionId);
  return join(layout.sessionDir, sessionLogFilenames[channel]);
};

export const getErrorLogPath = (projectRoot: string): string =>
  join(getMimirmeshDir(projectRoot), "logs", "error.log");
