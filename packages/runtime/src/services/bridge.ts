import type { EngineId } from "@mimirmesh/config";

import type { EngineDiscoveredTool } from "../types";

const requestJson = async <T>(url: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
    const body = (await response.json()) as T;
    if (!response.ok) {
      throw new Error(`Bridge request failed (${response.status})`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
};

export type BridgeHealthResponse = {
  ok: boolean;
  engine?: string;
  ready?: boolean;
  child?: {
    running: boolean;
    lastError?: string;
    command?: string;
  };
  discoveredToolCount?: number;
  uptimeMs?: number;
};

export type BridgeDiscoverResponse = {
  ok: boolean;
  tools: EngineDiscoveredTool[];
  engine?: string;
};

export type BridgeCallResponse = {
  ok: boolean;
  result?: unknown;
  error?: string;
};

export type BridgeReconnectResponse = {
  ok: boolean;
  engine?: string;
};

export const checkBridgeHealth = async (url: string): Promise<BridgeHealthResponse> =>
  requestJson<BridgeHealthResponse>(`${url}/health`, { method: "GET" }, 8_000);

export const discoverBridgeTools = async (
  url: string,
  engine: EngineId,
): Promise<BridgeDiscoverResponse> =>
  requestJson<BridgeDiscoverResponse>(`${url}/discover`, {
    method: "POST",
    body: JSON.stringify({ engine }),
  }, 180_000);

export const callBridgeTool = async (
  url: string,
  payload: { tool: string; args: Record<string, unknown> },
): Promise<BridgeCallResponse> =>
  requestJson<BridgeCallResponse>(`${url}/call`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, 300_000);

export const reconnectBridge = async (url: string): Promise<BridgeReconnectResponse> =>
  requestJson<BridgeReconnectResponse>(`${url}/reconnect`, {
    method: "POST",
  });
