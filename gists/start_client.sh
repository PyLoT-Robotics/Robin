ROBIN_REPOSITORY_PATH="$(cd "$(dirname "$0")/.." && pwd)"

sh "${ROBIN_REPOSITORY_PATH}/gists/setup.sh"

cd "${ROBIN_REPOSITORY_PATH}/client"
bun run preview