ARG LLAMA_CPP_BASE_IMAGE=ghcr.io/ggml-org/llama.cpp:full
FROM ${LLAMA_CPP_BASE_IMAGE}

USER root

RUN set -eux; \
	if command -v apt-get >/dev/null 2>&1; then \
		apt-get update; \
		apt-get install -y --no-install-recommends curl ca-certificates; \
		rm -rf /var/lib/apt/lists/*; \
	elif command -v apk >/dev/null 2>&1; then \
		apk add --no-cache curl ca-certificates; \
	else \
		echo "Unsupported package manager in ${LLAMA_CPP_BASE_IMAGE}" >&2; \
		exit 1; \
	fi

WORKDIR /models
