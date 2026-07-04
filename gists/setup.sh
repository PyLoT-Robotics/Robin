ROBIN_REPOSITORY_PATH="$(cd "$(dirname "$0")/.." && pwd)"

cd "${ROBIN_REPOSITORY_PATH}/client"
bun i

cd "${ROBIN_REPOSITORY_PATH}/server"
bun i
bun run create_cert
