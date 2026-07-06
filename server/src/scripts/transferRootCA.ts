import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPrimaryIPv4 } from '../infra/network/network'
import { createTerminalQRCode } from '../infra/qr/qrCode'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '../..')
const rootCAFile = process.env.ROOT_CA_PATH ?? path.resolve(serverRoot, 'public/rootCA.pem')
const port = Number.parseInt(process.env.ROOT_CA_PORT ?? '5174', 10)

if (!fs.existsSync(rootCAFile)) {
  throw new Error(
    `Root CA was not found at ${rootCAFile}. Run "bun run create_certificate" first.`,
  )
}

const localHost = process.env.ROBIN_HOST ?? getPrimaryIPv4()

const url = `http://${localHost}:${port}/rootCA.pem`
const server = http.createServer((request, response) => {
  if (request.method !== 'GET' || request.url !== '/rootCA.pem') {
    response.writeHead(404).end('Not found')
    return
  }

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Disposition': 'attachment; filename="rootCA.pem"',
    'Content-Length': fs.statSync(rootCAFile).size,
    'Content-Type': 'application/x-pem-file',
    'X-Content-Type-Options': 'nosniff',
  })

  fs.createReadStream(rootCAFile).pipe(response)
  response.on('finish', () => {
    console.log('Root CA transferred. Stopping the temporary HTTP server.')
    server.close()
  })
})

server.listen(port, '0.0.0.0', async () => {
  console.log(await createTerminalQRCode(url))
  console.log(`Temporary root CA transfer: ${url}`)
  console.log('The server will stop after one successful download.')
})
