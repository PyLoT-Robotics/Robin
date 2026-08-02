ROBIN_REPOSITORY_PATH="$(cd "$(dirname "$0")/.." && pwd)"

cd "${ROBIN_REPOSITORY_PATH}/server"
mkdir -p public
cp "$(mkcert -CAROOT)/rootCA.pem" ./public/rootCA.pem
bun run show_root_ca
