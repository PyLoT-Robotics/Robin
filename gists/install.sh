#!/usr/bin/env sh

set -eu

ROBIN_REPOSITORY_PATH="$(cd "$(dirname "$0")/.." && pwd)"
exec "${ROBIN_REPOSITORY_PATH}/setup.sh" "$@"
