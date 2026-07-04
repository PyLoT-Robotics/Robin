import { networkInterfaces } from 'node:os'
import QRCode from 'qrcode'

const requestedPath = process.argv[2] ?? ''

const localIP = (() => {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) return address.address
    }
  }
  throw new Error('No local IP address found')
})()

const url = new URL(requestedPath, `https://${localIP}:5173/`).toString()

QRCode.toString(url, (error, qrcode) => {
  if (error) throw error
  console.log(qrcode)
  console.log(`Robin server: ${url}`)
})
