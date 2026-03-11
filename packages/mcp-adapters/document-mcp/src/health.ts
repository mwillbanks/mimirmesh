import type { BridgeHealthResponse } from "@mimirmesh/runtime";

export const deriveDocumentMcpHealth = (health: BridgeHealthResponse): {
  healthy: boolean;
  message: string;
} => {
  if (!health.ok) {
    return { healthy: false, message: "Bridge health check failed" };
  }
  if (!health.ready || !health.child?.running) {
    return {
      healthy: false,
      message: health.child?.lastError ?? "Document MCP child process is not ready",
    };
  }
  return { healthy: true, message: "healthy" };
};
