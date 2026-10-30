#!/usr/bin/env bash
# Stops and removes the Prelegal container. Accounts and documents stay in the prelegal-data
# volume for the next start; to delete them too, run: docker volume rm prelegal-data
# The Docker commands are the same on macOS and Linux.
exec "$(dirname "$0")/stop-linux.sh" "$@"
