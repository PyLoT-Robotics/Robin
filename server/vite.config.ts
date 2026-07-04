import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const certFile = process.env.TLS_CERT_PATH ?? path.resolve(__dirname, 'certs/dev-cert.pem')
const keyFile = process.env.TLS_KEY_PATH ?? path.resolve(__dirname, 'certs/dev-key.pem')

function loadHttpsOptions() {
  if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
    throw new Error(
      `Robin server certificates were not found. Run "bun run create_cert" first.\n` +
      `Expected certificate: ${certFile}\nExpected key: ${keyFile}`,
    )
  }

  return {
    cert: fs.readFileSync(certFile),
    key: fs.readFileSync(keyFile),
  }
}

const proxy = {
  '/rosbridge': {
    target: process.env.ROSBRIDGE_URL ?? 'ws://localhost:9090',
    ws: true,
    changeOrigin: true,
    rewrite: (requestPath: string) => requestPath.replace(/^\/rosbridge/, ''),
  },
  '/video_publisher': {
    target: process.env.VIDEO_PUBLISHER_URL ?? 'http://localhost:8080',
    changeOrigin: true,
    rewrite: (requestPath: string) => requestPath.replace(/^\/video_publisher/, ''),
  },
}

export default defineConfig(({ command }) => {
  if (command === 'build') return { publicDir: false }

  const serverOptions = {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    https: loadHttpsOptions(),
    // The client is served from Vercel, so video signaling is cross-origin.
    // ROS traffic uses WebSocket and is forwarded by the proxy above.
    cors: true,
    proxy,
  }

  return {
    publicDir: false,
    server: serverOptions,
    preview: serverOptions,
  }
})
