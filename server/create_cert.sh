#!/usr/bin/env sh

set -eu

SERVER_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SERVER_DIR"

mkdir -p certs public

OS_NAME=$(uname -s)
if [ "$OS_NAME" = "Darwin" ]; then
    LOCAL_IP=$(ipconfig getifaddr en0)
elif [ "$OS_NAME" = "Linux" ]; then
    LOCAL_IP=$(ip -4 route get 1.1.1.1 | awk '{print $7; exit}')
else
    echo "Unsupported OS: $OS_NAME"
    exit 1
fi

mkcert -key-file certs/dev-key.pem -cert-file certs/dev-cert.pem localhost 127.0.0.1 ::1 "$LOCAL_IP"
cp "$(mkcert -CAROOT)/rootCA.pem" public/rootCA.pem

echo "Created the Robin server certificate for $LOCAL_IP and published /rootCA.pem."
