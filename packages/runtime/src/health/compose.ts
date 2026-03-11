import type { RuntimeServiceStatus } from "../types";

export const parseComposePs = (input: string): RuntimeServiceStatus[] => {
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }

  try {
    if (trimmed.startsWith("[")) {
      const rows = JSON.parse(trimmed) as Array<Record<string, unknown>>;
      return rows.map((row) => {
        const healthRaw = String(row.Health ?? "").toLowerCase();
        const stateRaw = String(row.State ?? "unknown").toLowerCase();
        const health = healthRaw.includes("healthy")
          ? "healthy"
          : healthRaw.includes("unhealthy")
            ? "unhealthy"
            : "unknown";
        const state = stateRaw.includes("running")
          ? "running"
          : stateRaw.includes("starting")
            ? "starting"
            : stateRaw.includes("unhealthy")
              ? "unhealthy"
              : stateRaw.includes("exited")
                ? "stopped"
                : "unknown";

        return {
          name: String(row.Service ?? "unknown"),
          state,
          health,
          containerId: typeof row.ID === "string" ? row.ID : undefined,
          message: typeof row.Status === "string" ? row.Status : undefined,
        };
      });
    }

    return trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .map((row) => ({
        name: String(row.Service ?? "unknown"),
        state: String(row.State ?? "unknown").includes("running") ? "running" : "unknown",
        health: String(row.Health ?? "unknown").includes("healthy") ? "healthy" : "unknown",
      }));
  } catch {
    return [];
  }
};
