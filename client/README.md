# Robin client

This is the static Vue/Vite controller hosted at
<https://robin.pylot-robotics.org>. It does not proxy ROS or video traffic and
does not host the local root CA.

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
