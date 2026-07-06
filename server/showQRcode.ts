import QRCode from 'qrcode'
import { getPrimaryIPv4 } from './network'

const requestedPath = process.argv[2] ?? ''

const localIP = getPrimaryIPv4()

const url = new URL(requestedPath, `https://${localIP}:5173/`).toString()

QRCode.toString(url, (error, qrcode) => {
  if (error) throw error
  console.log(qrcode)
  console.log(`Robin server: ${url}`)
})
