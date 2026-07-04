import { networkInterfaces } from 'node:os'
import QRCode from 'qrcode'

const requestedPath = process.argv[2] ?? ''

const localHost = (() => {
  if (process.env.ROBIN_HOST) return process.env.ROBIN_HOST

  try {
    for (const addresses of Object.values(networkInterfaces())) {
      for (const address of addresses ?? []) {
        const family = String(address.family)
        if (
          (family === 'IPv4' || family === '4') &&
          !address.internal
        ) {
          return address.address
        }
      }
    }
  } catch (error) {
    console.warn(`Could not inspect network interfaces: ${String(error)}`)
  }

  console.warn(
    'No non-loopback IPv4 address found; using localhost. Set ROBIN_HOST to override.',
  )
  return 'localhost'
})()

const url = new URL(requestedPath, `https://${localHost}:5173/`).toString()

QRCode.toString(url, (error, qrcode) => {
  if (error) throw error
  console.log(qrcode)
  console.log(`Robin server: ${url}`)
})
