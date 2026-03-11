import { withClient } from "../transport/mcp-client";

const toTransportToolName = (toolName: string): string =>
  toolName.replaceAll(".", "_").replaceAll("/", "_");

const LIST_TOOLS_TIMEOUT_MS = 180_000;
const CALL_TOOL_TIMEOUT_MS = 300_000;

export const listTools = async (
  projectRoot: string,
): Promise<
  Array<{
    name: string;
    description?: string;
  }>
> =>
  withClient(projectRoot, async (client) => {
    const response = await client.listTools(undefined, {
      timeout: LIST_TOOLS_TIMEOUT_MS,
      maxTotalTimeout: LIST_TOOLS_TIMEOUT_MS,
      resetTimeoutOnProgress: true,
    });
    return response.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  });

export const callTool = async (
  projectRoot: string,
  tool: string,
  args: Record<string, unknown>,
): Promise<unknown> =>
  withClient(projectRoot, async (client) => {
    const mappedName = toTransportToolName(tool);
    const result = await client.callTool(
      {
        name: mappedName,
        arguments: args,
      },
      undefined,
      {
        timeout: CALL_TOOL_TIMEOUT_MS,
        maxTotalTimeout: CALL_TOOL_TIMEOUT_MS,
        resetTimeoutOnProgress: true,
      },
    );
    return result.structuredContent ?? result.content;
  });
