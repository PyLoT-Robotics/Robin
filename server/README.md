# Robin server

The ROS-side Vite server provides only the local robot-facing services:

- `wss://<robot>:5173/rosbridge` → `ws://localhost:9090`
- `https://<robot>:5173/video_publisher` → `http://localhost:8080`
- `https://<robot>:5173/rootCA.pem`
- a landing page linking to <https://robin.pylot-robotics.org>

## Setup

From the repository root on Ubuntu, with ROS 2 sourced:

```sh
./setup.sh
```

The script installs server dependencies, creates the certificate, builds the
landing page, and temporarily runs the server while the phone installs the
root CA. It also stores the server and Bun paths used by the ROS launch file.

The equivalent server-only commands are:

```sh
bun install --frozen-lockfile
bun run create_certificate
bun run build
bun run preview
```

## Run with ROS

After building and sourcing the ROS workspace, start rosbridge, the video
publisher, and this HTTPS server together:

```sh
ros2 launch robin robin.launch.py
```

The landing page exposes `/api/status` for the primary IP, other local IPv4
addresses, server health, and root CA availability. Its browser trust indicator
uses the secure-context signal; browsers do not expose their certificate store
to JavaScript.

The upstream services can be changed with `ROSBRIDGE_URL` and
`VIDEO_PUBLISHER_URL` environment variables. Certificate paths can be
overridden with `TLS_CERT_PATH` and `TLS_KEY_PATH`.
