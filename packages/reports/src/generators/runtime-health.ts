import type { MimirmeshConfig } from "@mimirmesh/config";
import {
  loadBootstrapState,
  loadEngineState,
  loadRoutingTable,
  runtimeStatus,
} from "@mimirmesh/runtime";

import { list, section, writeReport } from "./shared";
import type { GeneratedReport } from "./types";

export const generateRuntimeHealthReport = async (
  projectRoot: string,
  config: MimirmeshConfig,
): Promise<GeneratedReport> => {
  const [status, bootstrap, routing] = await Promise.all([
    runtimeStatus(projectRoot, config),
    loadBootstrapState(projectRoot),
    loadRoutingTable(projectRoot),
  ]);

  const enabledEngines = Object.entries(config.engines)
    .filter(([, engine]) => engine.enabled)
    .map(([engine]) => engine);
  const engineStates = await Promise.all(enabledEngines.map((engine) => loadEngineState(projectRoot, engine)));

  const content = [
    "# Runtime Health",
    "",
    section("State", `- ${status.health.state}`),
    section(
      "Docker",
      [
        `- Installed: ${status.health.dockerInstalled ? "yes" : "no"}`,
        `- Daemon running: ${status.health.dockerDaemonRunning ? "yes" : "no"}`,
        `- Compose available: ${status.health.composeAvailable ? "yes" : "no"}`,
      ].join("\n"),
    ),
    section(
      "Enabled Engines",
      list(enabledEngines, "No engines enabled"),
    ),
    section(
      "Services",
      list(
        status.health.services.map(
          (service) =>
            `${service.name} :: state=${service.state} health=${service.health}${
              service.message ? ` (${service.message})` : ""
            }`,
        ),
        "No service status available",
      ),
    ),
    section(
      "Bridge State",
      list(
        status.health.bridges.map(
          (bridge) =>
            `${bridge.engine} :: healthy=${bridge.healthy ? "yes" : "no"}${
              bridge.reason ? ` (${bridge.reason})` : ""
            }`,
        ),
        "No bridge state available",
      ),
    ),
    section(
      "Discovery State",
      list(
        engineStates
          .filter((engine): engine is NonNullable<typeof engine> => Boolean(engine))
          .map(
            (engine) =>
              `${engine.engine} :: tools=${engine.discoveredTools.length} health=${engine.health.state}${
                engine.degradedReason ? ` (${engine.degradedReason})` : ""
              }`,
          ),
        "No engine discovery state available",
      ),
    ),
    section(
      "Bootstrap State",
      list(
        bootstrap?.engines.map(
          (entry) =>
            `${entry.engine} :: required=${entry.required ? "yes" : "no"} completed=${
              entry.completed ? "yes" : "no"
            }${entry.failureReason ? ` (${entry.failureReason})` : ""}`,
        ) ?? [],
        "No bootstrap state available",
      ),
    ),
    section(
      "Routing",
      [
        `- Unified routes: ${routing?.unified.length ?? 0}`,
        `- Passthrough routes: ${routing?.passthrough.length ?? 0}`,
      ].join("\n"),
    ),
    section(
      "Reasons",
      status.health.reasons.length > 0 ? list(status.health.reasons) : "- Runtime healthy",
    ),
  ].join("\n");

  return writeReport(projectRoot, "runtime-health.md", content);
};
