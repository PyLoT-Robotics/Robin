import { getPrimaryIPv4 } from '../infra/network/network'
import { createTerminalQRCode } from '../infra/qr/qrCode'

const requestedPath = process.argv[2] ?? ''

const localIP = getPrimaryIPv4()

const url = new URL(requestedPath, `https://${localIP}:5173/`).toString()

console.log(await createTerminalQRCode(url))
console.log(`Robin server: ${url}`)
