#!/usr/bin/env sh

set -eu

ROBIN_REPOSITORY_PATH="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROBIN_REPOSITORY_PATH}/client"
bun run dev
