FROM oven/bun:slim

ARG CODEBASE_MEMORY_VERSION=v0.3.1
ARG TARGETARCH

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates tar gzip \
  && rm -rf /var/lib/apt/lists/*

RUN case "$TARGETARCH" in \
    "arm64") BIN="codebase-memory-mcp-linux-arm64.tar.gz" ;; \
    "amd64") BIN="codebase-memory-mcp-linux-amd64.tar.gz" ;; \
    *) echo "Unsupported architecture: $TARGETARCH" && exit 1 ;; \
  esac \
  && URL="https://github.com/DeusData/codebase-memory-mcp/releases/download/${CODEBASE_MEMORY_VERSION}/${BIN}" \
  && curl -fsSL "$URL" -o /tmp/codebase-memory.tgz \
  && tar -xzf /tmp/codebase-memory.tgz -C /usr/local/bin \
  && chmod +x /usr/local/bin/codebase-memory-mcp \
  && rm -f /tmp/codebase-memory.tgz

WORKDIR /opt/mimirmesh
RUN bun init -y && bun add @modelcontextprotocol/sdk@latest
COPY common/engine-bridge.mjs /opt/mimirmesh/engine-bridge.mjs

ENV MIMIRMESH_ENGINE_ID=codebase-memory-mcp
ENV MIMIRMESH_BRIDGE_PORT=4701
ENV MIMIRMESH_ENGINE_CMD=/usr/local/bin/codebase-memory-mcp
ENV MIMIRMESH_ENGINE_ARGS=[]

EXPOSE 4701

HEALTHCHECK --interval=10s --timeout=5s --retries=10 CMD curl -fsS http://127.0.0.1:4701/health || exit 1

CMD ["bun", "/opt/mimirmesh/engine-bridge.mjs"]
