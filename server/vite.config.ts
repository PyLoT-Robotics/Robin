import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'
import type { Connect, Plugin } from 'vite'
import QRCode from 'qrcode'

import { getLocalIPv4Addresses, getPrimaryIPv4, type RobinServerStatus } from './network'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const certFile = process.env.TLS_CERT_PATH ?? path.resolve(__dirname, 'certs/dev-cert.pem')
const keyFile = process.env.TLS_KEY_PATH ?? path.resolve(__dirname, 'certs/dev-key.pem')
const rootCAFiles = [
  path.resolve(__dirname, 'public/rootCA.pem'),
  path.resolve(__dirname, 'dist/rootCA.pem'),
]

function loadHttpsOptions() {
  if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
    throw new Error(
      `Robin server certificates were not found. Run "bun run create_certificate" first.\n` +
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

const statusMiddleware: Connect.NextHandleFunction = (request, response, next) => {
  const pathname = request.url ? new URL(request.url, 'https://robin.local').pathname : ''
  if (pathname === '/api/root-ca-qr') {
    const host = request.headers.host ?? `${getPrimaryIPv4()}:5173`
    const rootCAUrl = `https://${host}/rootCA.pem`
    QRCode.toString(rootCAUrl, { type: 'svg', margin: 1 }, (error, svg) => {
      if (error) {
        response.statusCode = 500
        response.end(String(error))
        return
      }
      response.statusCode = 200
      response.setHeader('Cache-Control', 'no-store')
      response.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
      response.end(svg)
    })
    return
  }

  if (pathname !== '/api/status') {
    next()
    return
  }

  try {
    const payload: RobinServerStatus = {
      status: 'ok',
      primaryIp: getPrimaryIPv4(),
      addresses: getLocalIPv4Addresses(),
      rootCAAvailable: rootCAFiles.some((candidate) => fs.existsSync(candidate)),
    }
    response.statusCode = 200
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(JSON.stringify(payload))
  } catch (error) {
    response.statusCode = 503
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(JSON.stringify({ status: 'error', error: String(error) }))
  }
}

const robinStatusPlugin: Plugin = {
  name: 'robin-server-status',
  configureServer(server) {
    server.middlewares.use(statusMiddleware)
  },
  configurePreviewServer(server) {
    server.middlewares.use(statusMiddleware)
  },
}

export default defineConfig(({ command }) => {
  if (command === 'build') return {}

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
    plugins: [robinStatusPlugin],
    server: serverOptions,
    preview: serverOptions,
  }
})
