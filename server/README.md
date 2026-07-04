# Robin server

The ROS-side Vite server provides only the local robot-facing services:

- `wss://<robot>:5173/rosbridge` → `ws://localhost:9090`
- `https://<robot>:5173/video_publisher` → `http://localhost:8080`
- a landing page linking to <https://robin.pylot-robotics.org>

## Setup and run

```sh
bun install
bun run create_cert
bun run dev
```

For a built landing page, use `bun run build && bun run preview`.

To transfer the root CA to a new device, run:

```sh
bun run show_root_ca
```

This starts a temporary HTTP server at
`http://<robot>:5174/rootCA.pem`, prints a QR code, and stops after the
certificate is downloaded. The root CA is not exposed by the normal HTTPS
server or included in production builds.

The upstream services can be changed with `ROSBRIDGE_URL` and
`VIDEO_PUBLISHER_URL` environment variables. Certificate paths can be
overridden with `TLS_CERT_PATH` and `TLS_KEY_PATH`. Root CA transfers can be
configured with `ROOT_CA_PATH` and `ROOT_CA_PORT`.
