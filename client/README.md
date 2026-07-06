# Robin client

This is the static Vue/Vite controller hosted at
<https://robin.pylot-robotics.org>. It does not proxy ROS or video traffic and
does not host the local root CA.

## Architecture

The client follows a one-way dependency structure:

- `models/`: application and domain types, including ROS, motion, map, storage,
  and PWA state.
- `infra/`: browser storage, service-worker registration, ROSLIB factories,
  endpoint construction, and topic transport adapters.
- `hooks/`: Vue state and application use cases. Components consume this layer
  instead of accessing infrastructure directly.
- `components/`: presentation and view composition.

Dependencies flow from components to hooks, then to infrastructure and models.
Infrastructure never imports components.

## Local development

```sh
bun install
bun run dev
```

The local client uses port 5174 so it can run beside the ROS-side server on
port 5173. Select the server's local IP in the app's Settings view, or provide an initial
value at build time:

```sh
VITE_ROBIN_SERVER_URL=https://192.168.0.10:5173 bun run dev
```

## Vercel

The repository-level `vercel.json` installs and builds this directory. The
result is a static `client/dist` deployment. `VITE_ROBIN_SERVER_URL` is
optional because each browser can save its own robot server URL in Settings.
