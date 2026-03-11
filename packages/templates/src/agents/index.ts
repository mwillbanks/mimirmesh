import type { MimirmeshConfig } from "@mimirmesh/config";

import { generateDocument } from "../documents/generate";

export const generateAgentGuidance = async (
  projectRoot: string,
  config: MimirmeshConfig,
  title: string,
  context: Record<string, string | number | boolean | null | undefined>,
): Promise<{ path: string; created: boolean }> =>
  generateDocument(projectRoot, config, {
    family: "agentGuidance",
    title,
    context,
  });
