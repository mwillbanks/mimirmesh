FROM oven/bun:slim AS bun-runtime

FROM python:3-slim AS document-builder
ARG DOCUMENT_MCP_REF=main

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates tar gzip \
  && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY --from=ghcr.io/astral-sh/uv:latest /uvx /usr/local/bin/uvx

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

FROM python:3-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY --from=ghcr.io/astral-sh/uv:latest /uvx /usr/local/bin/uvx
COPY --from=document-builder /opt/document-mcp /opt/document-mcp
COPY --from=bun-runtime /usr/local/bin/bun /usr/local/bin/bun
COPY --from=bun-runtime /usr/local/bin/bunx /usr/local/bin/bunx

ENV PATH=/usr/local/bin:$PATH
ENV HF_HOME=/opt/document-mcp/.cache/huggingface
ENV SENTENCE_TRANSFORMERS_HOME=/opt/document-mcp/.cache/sentence-transformers
ENV TRANSFORMERS_CACHE=/opt/document-mcp/.cache/huggingface

WORKDIR /opt/mimirmesh
RUN bun init -y && bun add @modelcontextprotocol/sdk@latest
COPY common/engine-bridge.mjs /opt/mimirmesh/engine-bridge.mjs

ENV PYTHONUNBUFFERED=1
ENV MIMIRMESH_ENGINE_ID=document-mcp
ENV MIMIRMESH_BRIDGE_PORT=4701
ENV MIMIRMESH_ENGINE_CMD=uv
ENV MIMIRMESH_ENGINE_ARGS=["run","--directory","/opt/document-mcp","python","-m","src.main"]

EXPOSE 4701

HEALTHCHECK --interval=10s --timeout=5s --retries=10 CMD curl -fsS http://127.0.0.1:4701/health || exit 1

CMD ["bun", "/opt/mimirmesh/engine-bridge.mjs"]
