#!/usr/bin/env sh

set -eu

SERVER_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SERVER_DIR"

mkdir -p certs public

LOCAL_IP=$(bun network.ts --primary)

mkcert -key-file certs/dev-key.pem -cert-file certs/dev-cert.pem localhost 127.0.0.1 ::1 "$LOCAL_IP"
cp "$(mkcert -CAROOT)/rootCA.pem" public/rootCA.pem

echo "Created the Robin server certificate for $LOCAL_IP and published /rootCA.pem."
