# Robin server

The ROS-side Vite server provides only the local robot-facing services:

- `wss://<robot>:5173/rosbridge` → `ws://localhost:9090`
- `https://<robot>:5173/video_publisher` → `http://localhost:8080`
- `https://<robot>:5173/rootCA.pem`
- a landing page linking to <https://robin.pylot-robotics.org>

## Setup and run

```sh
bun install
bun run create_cert
bun run dev
```

For a built landing page, use `bun run build && bun run preview`.

The upstream services can be changed with `ROSBRIDGE_URL` and
`VIDEO_PUBLISHER_URL` environment variables. Certificate paths can be
overridden with `TLS_CERT_PATH` and `TLS_KEY_PATH`.
