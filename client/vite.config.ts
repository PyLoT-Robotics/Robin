import { fileURLToPath, URL } from 'node:url'

import fs from 'node:fs'
import path from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const certDir = path.resolve(__dirname, 'certs')
const certFile = path.join(certDir, 'dev-cert.pem')
const keyFile = path.join(certDir, 'dev-key.pem')

const httpsOptions = (() => {
  if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
    throw new Error(
      `HTTPS is enabled but certificate files were not found. Expected:\n- cert: ${certFile}\n- key: ${keyFile}\nCreate them with mkcert, then retry.`,
    )
  }
  return {
    cert: fs.readFileSync(certFile),
    key: fs.readFileSync(keyFile),
  }
})()

// https://vite.dev/config/
export default defineConfig({
  preview: {
    strictPort: true
  },
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      devOptions: {
        enabled: true,
        type: 'module',
      },
      manifest: {
        id: '/',
        name: 'Robin',
        short_name: 'Robin',
        description: 'PyLoT Robotics robot controller and debugging client.',
        start_url: '/',
        scope: '/',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'any',
        categories: ['utilities'],
        prefer_related_applications: false,
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    https: httpsOptions,
    proxy: {
      '/rosbridge': {
        target: 'ws://localhost:9090',
        ws: true,
        rewrite: (path) => path.replace(/^\/rosbridge/, ''),
      },
      '/video_publisher': {
        target: 'http://localhost:8080',
        rewrite: (path) => path.replace(/^\/video_publisher/, ''),
      },
    },
  },
})
