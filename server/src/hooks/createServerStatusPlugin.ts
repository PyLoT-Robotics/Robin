import type { Plugin } from 'vite'

import { createServerApiMiddleware } from './createServerApiMiddleware'
import type { CertificatePaths } from '../models/certificate'

export function createServerStatusPlugin(paths: CertificatePaths): Plugin {
  const middleware = createServerApiMiddleware(paths)
  return {
    name: 'robin-server-status',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
