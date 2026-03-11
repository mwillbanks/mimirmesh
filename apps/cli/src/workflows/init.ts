import type { CliContext } from "../lib/context";
import { initializeProject } from "../lib/context";

export const runInitWorkflow = async (context: CliContext) => initializeProject(context);
