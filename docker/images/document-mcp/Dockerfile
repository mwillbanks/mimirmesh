FROM python:3.11-slim

ARG DOCUMENT_MCP_REF=ee226d6af6b950d4a56b4622631bdfb8de940dd1

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates tar gzip nodejs npm \
  && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.8.14 /uv /usr/local/bin/uv
COPY --from=ghcr.io/astral-sh/uv:0.8.14 /uvx /usr/local/bin/uvx

RUN mkdir -p /opt/document-mcp \
  && curl -fsSL "https://codeload.github.com/yairwein/document-mcp/tar.gz/${DOCUMENT_MCP_REF}" \
    | tar -xz --strip-components=1 -C /opt/document-mcp

WORKDIR /opt/document-mcp
RUN uv sync --frozen --no-dev
ENV HF_HOME=/opt/document-mcp/.cache/huggingface
ENV SENTENCE_TRANSFORMERS_HOME=/opt/document-mcp/.cache/sentence-transformers
ENV TRANSFORMERS_CACHE=/opt/document-mcp/.cache/huggingface
RUN mkdir -p "$HF_HOME" "$SENTENCE_TRANSFORMERS_HOME" \
  && uv run --directory /opt/document-mcp python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

WORKDIR /opt/mimirmesh
RUN npm init -y && npm install --omit=dev @modelcontextprotocol/sdk@1.27.1
COPY common/engine-bridge.mjs /opt/mimirmesh/engine-bridge.mjs

ENV PYTHONUNBUFFERED=1
ENV MIMIRMESH_ENGINE_ID=document-mcp
ENV MIMIRMESH_BRIDGE_PORT=4701
ENV MIMIRMESH_ENGINE_CMD=uv
ENV MIMIRMESH_ENGINE_ARGS=["run","--directory","/opt/document-mcp","python","-m","src.main"]

EXPOSE 4701

HEALTHCHECK --interval=10s --timeout=5s --retries=10 CMD curl -fsS http://127.0.0.1:4701/health || exit 1

CMD ["node", "/opt/mimirmesh/engine-bridge.mjs"]
