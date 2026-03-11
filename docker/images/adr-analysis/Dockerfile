FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g --omit=dev mcp-adr-analysis-server@2.2.1 openai@4.104.0

WORKDIR /opt/mimirmesh
RUN npm init -y && npm install --omit=dev @modelcontextprotocol/sdk@1.27.1
COPY common/engine-bridge.mjs /opt/mimirmesh/engine-bridge.mjs

ENV MIMIRMESH_ENGINE_ID=mcp-adr-analysis-server
ENV MIMIRMESH_BRIDGE_PORT=4701
ENV MIMIRMESH_ENGINE_CMD=mcp-adr-analysis-server
ENV MIMIRMESH_ENGINE_ARGS=[]

EXPOSE 4701

HEALTHCHECK --interval=10s --timeout=5s --retries=10 CMD curl -fsS http://127.0.0.1:4701/health || exit 1

CMD ["node", "/opt/mimirmesh/engine-bridge.mjs"]
