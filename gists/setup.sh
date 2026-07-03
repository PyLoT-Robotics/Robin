ROBIN_REPOSITORY_PATH="$(cd "$(dirname "$0")/.." && pwd)"

sh "${ROBIN_REPOSITORY_PATH}/client/create_cert.sh"

cd "${ROBIN_REPOSITORY_PATH}/client"
rm -rf node_modules
bun i
bun run build

cd "${ROBIN_REPOSITORY_PATH}/server"
rm -rf node_modules
bun i
