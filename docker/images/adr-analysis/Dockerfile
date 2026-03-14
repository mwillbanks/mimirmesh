FROM oven/bun:slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates python3 python3-setuptools make g++ nodejs npm \
  && rm -rf /var/lib/apt/lists/*

RUN bun install --global mcp-adr-analysis-server@latest openai@latest

WORKDIR /opt/mimirmesh
RUN bun init -y && bun add @modelcontextprotocol/sdk@latest
COPY common/engine-bridge.mjs /opt/mimirmesh/engine-bridge.mjs

ENV MIMIRMESH_ENGINE_ID=mcp-adr-analysis-server
ENV MIMIRMESH_BRIDGE_PORT=4701
ENV MIMIRMESH_ENGINE_CMD=mcp-adr-analysis-server
ENV MIMIRMESH_ENGINE_ARGS=[]

EXPOSE 4701

HEALTHCHECK --interval=10s --timeout=5s --retries=10 CMD curl -fsS http://127.0.0.1:4701/health || exit 1

CMD ["bun", "/opt/mimirmesh/engine-bridge.mjs"]
