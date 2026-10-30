#!/usr/bin/env bash
# Stops and removes the Prelegal container. Accounts and documents stay in the prelegal-data
# volume for the next start; to delete them too, run: docker volume rm prelegal-data
set -euo pipefail

docker rm -f prelegal >/dev/null 2>&1 || true
echo "Prelegal stopped"
