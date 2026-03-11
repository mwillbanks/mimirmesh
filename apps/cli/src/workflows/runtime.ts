import type { CliContext } from "../lib/context";
import { runtimeAction } from "../lib/context";

export const runRuntimeWorkflow = async (
  context: CliContext,
  action: "start" | "stop" | "restart" | "status",
) => runtimeAction(context, action);
