FROM python:3.12-slim

RUN apt-get update \
	&& apt-get install -y --no-install-recommends curl ca-certificates git nodejs npm \
	&& rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir srclight

WORKDIR /opt/mimirmesh
RUN npm init -y && npm install --omit=dev @modelcontextprotocol/sdk@1.27.1
COPY common/engine-bridge.mjs /opt/mimirmesh/engine-bridge.mjs

ENV PYTHONUNBUFFERED=1
ENV MIMIRMESH_ENGINE_ID=srclight
ENV MIMIRMESH_BRIDGE_PORT=4701
ENV MIMIRMESH_ENGINE_CMD=srclight
ENV MIMIRMESH_ENGINE_ARGS=["serve","--transport","sse","--port","8742"]
ENV MIMIRMESH_ENGINE_TRANSPORT=sse
ENV MIMIRMESH_ENGINE_URL=http://127.0.0.1:8742/sse

EXPOSE 4701 8742

HEALTHCHECK --interval=10s --timeout=5s --retries=12 CMD curl -fsS http://127.0.0.1:4701/health || exit 1

CMD ["node", "/opt/mimirmesh/engine-bridge.mjs"]
