#!/usr/bin/env bash
# Stops and removes the Prelegal container, discarding its temporary database.
# The Docker commands are the same on macOS and Linux.
exec "$(dirname "$0")/stop-linux.sh" "$@"
