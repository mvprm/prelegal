#!/usr/bin/env bash
# Stops and removes the Prelegal container, discarding its temporary database.
set -euo pipefail

docker rm -f prelegal >/dev/null 2>&1 || true
echo "Prelegal stopped"
