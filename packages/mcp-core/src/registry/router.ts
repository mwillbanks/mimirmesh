import {
  disableEngine,
  enableEngine,
  getConfigValue,
  parseConfigPrimitive,
  setConfigValue,
  writeConfig,
  type EngineId,
  type MimirmeshConfig,
} from "@mimirmesh/config";
import { getAdapter } from "@mimirmesh/mcp-adapters";
import { runtimeStatus } from "@mimirmesh/runtime";

import { loadRuntimeRoutingContext } from "../discovery/runtime";
import { deduplicateAndRank } from "../merge/results";
import { passthroughRouteFor, unifiedRoutesFor } from "../routing/table";
import { invokeEngineTool } from "../transport/bridge";
import {
  isUnifiedTool,
  unifiedToolDescriptions,
  unifiedToolList,
} from "./unified";
import { applyMiddleware, errorNormalizationMiddleware, timingMiddleware } from "./middleware";
import type {
  MiddlewareContext,
  NormalizedToolResult,
  ToolDefinition,
  ToolInput,
  ToolName,
  ToolProvenance,
  ToolResultItem,
  ToolRouterOptions,
  UnifiedToolName,
} from "../types";

const nowId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const toResultItems = (engine: string, tool: string, payload: unknown): ToolResultItem[] => {
  if (Array.isArray(payload)) {
    return payload.map((entry, index) => ({
      id: nowId("arr"),
      title: `${engine}.${tool}[${index}]`,
      content: typeof entry === "string" ? entry : JSON.stringify(entry, null, 2),
      score: 60,
      metadata: {
        engine,
        tool,
        index,
      },
    }));
  }

  if (typeof payload === "object" && payload !== null) {
    const asRecord = payload as Record<string, unknown>;

    if (Array.isArray(asRecord.content)) {
      const text = asRecord.content
        .map((part) => (typeof part === "object" && part !== null ? String((part as { text?: unknown }).text ?? "") : ""))
        .filter(Boolean)
        .join("\n");
      return [
        {
          id: nowId("content"),
          title: `${engine}.${tool}`,
          content: text || JSON.stringify(payload, null, 2),
          score: 70,
          metadata: { engine, tool },
        },
      ];
    }

    if (typeof asRecord.result === "object" && asRecord.result !== null) {
      return toResultItems(engine, tool, asRecord.result);
    }

    return [
      {
        id: nowId("obj"),
        title: `${engine}.${tool}`,
        content: JSON.stringify(payload, null, 2),
        score: 65,
        metadata: { engine, tool },
      },
    ];
  }

  return [
    {
      id: nowId("val"),
      title: `${engine}.${tool}`,
      content: String(payload),
      score: 55,
      metadata: { engine, tool },
    },
  ];
};

const normalizeWarnings = (warnings: Array<string | undefined | null>): string[] =>
  warnings.filter((warning): warning is string => Boolean(warning?.trim()));

export class ToolRouter {
  private readonly projectRoot: string;
  private config: MimirmeshConfig;
  private readonly logger?: ToolRouterOptions["logger"];
  private readonly executeWithMiddleware: (context: MiddlewareContext) => Promise<NormalizedToolResult>;

  constructor(options: ToolRouterOptions) {
    this.projectRoot = options.projectRoot;
    this.config = options.config;
    this.logger = options.logger;

    const defaultMiddlewares = [
      errorNormalizationMiddleware(this.logger),
      timingMiddleware(this.logger),
    ];

    this.executeWithMiddleware = applyMiddleware(
      options.middlewares ?? defaultMiddlewares,
      this.executeTool.bind(this),
    );
  }

  public getConfig(): MimirmeshConfig {
    return this.config;
  }

  public setConfig(config: MimirmeshConfig): void {
    this.config = config;
  }

  public async listTools(): Promise<ToolDefinition[]> {
    const base: ToolDefinition[] = unifiedToolList.map((tool) => ({
      name: tool.name,
      description: tool.description,
      type: "unified",
    }));

    const runtime = await loadRuntimeRoutingContext(this.projectRoot);
    const passthrough = (runtime.routing?.passthrough ?? []).map((route) => ({
      name: route.publicTool as ToolName,
      description: route.description ?? `${route.engine}.${route.engineTool}`,
      type: "passthrough" as const,
    }));

    return [...base, ...passthrough];
  }

  public async callTool(toolName: ToolName, input: ToolInput = {}): Promise<NormalizedToolResult> {
    return this.executeWithMiddleware({
      toolName,
      input,
      projectRoot: this.projectRoot,
      config: this.config,
    });
  }

  private async executeTool(context: MiddlewareContext): Promise<NormalizedToolResult> {
    if (isUnifiedTool(context.toolName)) {
      return this.executeUnifiedTool(context.toolName, context.input);
    }
    return this.executePassthroughTool(context.toolName, context.input);
  }

  private async executeUnifiedTool(
    toolName: UnifiedToolName,
    input: ToolInput,
  ): Promise<NormalizedToolResult> {
    if (toolName === "runtime_status") {
      const status = await runtimeStatus(this.projectRoot, this.config);
      return {
        tool: toolName,
        success: status.ok,
        message: status.message,
        items: status.health.services.map((service, index) => ({
          id: `runtime-${index}`,
          title: service.name,
          content: `state=${service.state} health=${service.health}`,
          score: service.state === "running" ? 100 : 40,
          metadata: {
            state: service.state,
            health: service.health,
          },
        })),
        provenance: [
          {
            engine: "runtime",
            tool: "runtime_status",
            latencyMs: 0,
            health: status.ok ? "healthy" : "degraded",
            note: status.message,
          },
        ],
        degraded: status.health.state !== "ready",
        warnings: status.health.reasons,
        raw: {
          health: status.health,
          connection: status.connection,
        },
      };
    }

    if (toolName === "config_get") {
      const path = typeof input.path === "string" ? input.path : "";
      const value = path ? getConfigValue(this.config, path) : this.config;
      return {
        tool: toolName,
        success: true,
        message: path ? `Read config path ${path}` : "Read full config",
        items: [
          {
            id: "config-get",
            title: path || "config",
            content: JSON.stringify(value, null, 2),
            score: 100,
            metadata: { path },
          },
        ],
        provenance: [
          {
            engine: "mimirmesh",
            tool: "config_get",
            latencyMs: 0,
            health: "healthy",
          },
        ],
        degraded: false,
        warnings: [],
      };
    }

    if (toolName === "config_set") {
      const path = typeof input.path === "string" ? input.path : "";
      if (!path) {
        return {
          tool: toolName,
          success: false,
          message: "config_set requires 'path'.",
          items: [],
          provenance: [],
          degraded: true,
          warnings: ["Missing path."],
        };
      }

      const rawValue = input.value;
      const parsedValue =
        typeof rawValue === "string" ? parseConfigPrimitive(rawValue) : (rawValue as unknown);
      const nextConfig =
        path === "engines.enable"
          ? enableEngine(this.config, String(parsedValue) as EngineId)
          : path === "engines.disable"
            ? disableEngine(this.config, String(parsedValue) as EngineId)
            : setConfigValue(this.config, path, parsedValue);

      await writeConfig(this.projectRoot, nextConfig);
      this.config = nextConfig;

      return {
        tool: toolName,
        success: true,
        message: `Updated config path ${path}`,
        items: [
          {
            id: "config-set",
            title: path,
            content: JSON.stringify(getConfigValue(nextConfig, path), null, 2),
            score: 100,
            metadata: { path },
          },
        ],
        provenance: [
          {
            engine: "mimirmesh",
            tool: "config_set",
            latencyMs: 0,
            health: "healthy",
          },
        ],
        degraded: false,
        warnings: [],
      };
    }

    const runtime = await loadRuntimeRoutingContext(this.projectRoot);
    if (!runtime.routing || !runtime.connection) {
      return {
        tool: toolName,
        success: false,
        message: "Runtime routing table not available. Start runtime first.",
        items: [],
        provenance: [],
        degraded: true,
        warnings: ["Missing runtime routing table"],
      };
    }

    const routes = unifiedRoutesFor(runtime.routing, toolName);
    if (routes.length === 0) {
      return {
        tool: toolName,
        success: false,
        message: `No discovered engine capability for ${toolName}.`,
        items: [],
        provenance: [],
        degraded: true,
        warnings: [
          "Unified routes are generated from live discovery; refresh runtime to rebuild routing.",
        ],
      };
    }

    const routeGroups = new Map<EngineId, typeof routes>();
    for (const route of routes) {
      const existing = routeGroups.get(route.engine) ?? [];
      existing.push(route);
      routeGroups.set(route.engine, existing);
    }

    const groupedResults = await Promise.all(
      [...routeGroups.entries()].map(async ([engine, engineRoutes]) => {
        const adapter = getAdapter(engine);
        if (adapter.executeUnifiedTool) {
          const handled = await adapter.executeUnifiedTool({
            unifiedTool: toolName,
            routes: engineRoutes,
            input,
            projectRoot: this.projectRoot,
            config: this.config,
            bridgePorts: runtime.connection?.bridgePorts ?? {},
            invoke: (tool, args) =>
              invokeEngineTool({
                bridgePorts: runtime.connection?.bridgePorts ?? {},
                engine,
                tool,
                args,
              }),
          });
          if (handled) {
            return handled;
          }
        }

        return Promise.all(
          engineRoutes.map(async (route) => {
            const startedAt = performance.now();
            const response = await invokeEngineTool({
              bridgePorts: runtime.connection?.bridgePorts ?? {},
              engine: route.engine,
              tool: route.engineTool,
              args: input,
            });
            const latencyMs = Math.round(performance.now() - startedAt);
            return {
              route,
              response,
              latencyMs,
            };
          }),
        );
      }),
    );
    const results = groupedResults.flat();

    const provenance: ToolProvenance[] = [];
    const items: ToolResultItem[] = [];
    const warnings: string[] = [];

    for (const result of results) {
      if (!result.response.ok) {
        warnings.push(`${result.route.engine}: ${result.response.error ?? "failed"}`);
        provenance.push({
          engine: result.route.engine,
          tool: result.route.engineTool,
          latencyMs: result.latencyMs,
          health: "unavailable",
          note: result.response.error,
        });
        continue;
      }

      items.push(...toResultItems(result.route.engine, result.route.engineTool, result.response.result));
      provenance.push({
        engine: result.route.engine,
        tool: result.route.engineTool,
        latencyMs: result.latencyMs,
        health: "healthy",
      });
    }

    const merged = deduplicateAndRank(items);
    return {
      tool: toolName,
      success: merged.length > 0,
      message:
        merged.length > 0
          ? `Merged ${merged.length} result item(s) from discovered engine routes.`
          : "No results returned by discovered engine routes.",
      items: merged,
      provenance,
      degraded: warnings.length > 0,
      warnings: normalizeWarnings(warnings),
      raw: {
        routes,
      },
    };
  }

  private async executePassthroughTool(
    toolName: `${string}.${string}`,
    input: ToolInput,
  ): Promise<NormalizedToolResult> {
    const runtime = await loadRuntimeRoutingContext(this.projectRoot);
    if (!runtime.routing || !runtime.connection) {
      return {
        tool: toolName,
        success: false,
        message: "Runtime routing table not available. Start runtime first.",
        items: [],
        provenance: [],
        degraded: true,
        warnings: ["Missing runtime routing table"],
      };
    }

    const route = passthroughRouteFor(runtime.routing, toolName);
    if (!route) {
      return {
        tool: toolName,
        success: false,
        message: `Unknown passthrough tool: ${toolName}`,
        items: [],
        provenance: [],
        degraded: true,
        warnings: ["Tool is not present in discovered passthrough routes."],
      };
    }

    const adapter = getAdapter(route.engine);
    const preparedInput = adapter.prepareToolInput
      ? adapter.prepareToolInput(route.engineTool, input, {
          projectRoot: this.projectRoot,
          config: this.config,
          inputSchema: route.inputSchema,
        })
      : input;

    const startedAt = performance.now();
    const response = await invokeEngineTool({
      bridgePorts: runtime.connection.bridgePorts,
      engine: route.engine,
      tool: route.engineTool,
      args: preparedInput,
    });
    const latencyMs = Math.round(performance.now() - startedAt);

    if (!response.ok) {
      return {
        tool: toolName,
        success: false,
        message: response.error ?? "Passthrough call failed",
        items: [],
        provenance: [
          {
            engine: route.engine,
            tool: route.engineTool,
            latencyMs,
            health: "unavailable",
            note: response.error,
          },
        ],
        degraded: true,
        warnings: [response.error ?? "Passthrough call failed"],
      };
    }

    return {
      tool: toolName,
      success: true,
      message: `Executed passthrough route ${toolName}`,
      items: toResultItems(route.engine, route.engineTool, response.result),
      provenance: [
        {
          engine: route.engine,
          tool: route.engineTool,
          latencyMs,
          health: "healthy",
        },
      ],
      degraded: false,
      warnings: [],
      raw: {
        route,
      },
    };
  }
}

export const createToolRouter = (options: ToolRouterOptions): ToolRouter => new ToolRouter(options);
export const unifiedTools = unifiedToolList;
export { unifiedToolDescriptions };
