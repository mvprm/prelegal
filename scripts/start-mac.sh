#!/usr/bin/env bash
# Builds the Prelegal image and starts it at http://localhost:8000.
# The Docker commands are the same on macOS and Linux.
exec "$(dirname "$0")/start-linux.sh" "$@"
