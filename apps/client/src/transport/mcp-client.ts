import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { resolveServerInvocation } from "../engines/server-invocation";

export const withClient = async <T>(
  projectRoot: string,
  handler: (client: Client) => Promise<T>,
): Promise<T> => {
  const server = await resolveServerInvocation(projectRoot);
  const transport = new StdioClientTransport({
    command: server.command,
    args: server.args,
    env: server.env,
    stderr: "pipe",
    cwd: projectRoot,
  });

  const client = new Client(
    {
      name: "mimirmesh-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    },
  );

  await client.connect(transport);
  try {
    return await handler(client);
  } finally {
    await client.close();
    await transport.close();
  }
};
