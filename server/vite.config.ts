import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'

import {
  loadHttpsOptions,
} from './src/infra/certificate/certificateRepository'
import { createRosProxy } from './src/infra/ros/proxy'
import { createServerStatusPlugin } from './src/hooks/createServerStatusPlugin'
import type { CertificatePaths } from './src/models/certificate'

const serverRoot = path.dirname(fileURLToPath(import.meta.url))
const certificatePaths: CertificatePaths = {
  certificate: process.env.TLS_CERT_PATH
    ?? path.resolve(serverRoot, 'certs/dev-cert.pem'),
  privateKey: process.env.TLS_KEY_PATH
    ?? path.resolve(serverRoot, 'certs/dev-key.pem'),
  rootCAFiles: [
    path.resolve(serverRoot, 'public/rootCA.pem'),
    path.resolve(serverRoot, 'dist/rootCA.pem'),
  ],
}

export default defineConfig(({ command }) => {
  if (command === 'build') return {}

  const serverOptions = {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    https: loadHttpsOptions(certificatePaths),
    cors: true,
    proxy: createRosProxy(),
  }

  return {
    plugins: [createServerStatusPlugin(certificatePaths)],
    server: serverOptions,
    preview: serverOptions,
  }
})
