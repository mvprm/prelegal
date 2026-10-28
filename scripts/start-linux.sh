#!/usr/bin/env bash
# Builds the Prelegal image and starts it at http://localhost:8000.
set -euo pipefail
cd "$(dirname "$0")/.."

docker build -t prelegal .

# Replace any previous container, so the database always starts empty.
docker rm -f prelegal >/dev/null 2>&1 || true

# .env holds API keys; it is optional until a feature needs them.
env_file_args=()
if [ -f .env ]; then env_file_args=(--env-file .env); fi

# The ${a[@]+...} form keeps an empty array safe under `set -u` in macOS's bash 3.2.
docker run -d --name prelegal -p 8000:8000 ${env_file_args[@]+"${env_file_args[@]}"} prelegal >/dev/null
echo "Prelegal is running at http://localhost:8000"
