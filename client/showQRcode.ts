import { networkInterfaces } from 'os'
import QRCode from 'qrcode'

const args = process.argv.slice(2)
const requestedPort = Number.parseInt(args[0] ?? '', 10)
const hasPortArgument = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort <= 65535
const port = hasPortArgument ? requestedPort : 5173
const path = hasPortArgument ? (args[1] ?? '') : (args[0] ?? '')

const localIP: string = (() => {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  throw new Error('No local IP address found')
})()


const url = `https://${localIP}:${port}/${path}`

QRCode.toString(url, (error, qrcode) => {
  if (error) {
    throw error
  }
  console.log(qrcode)
  console.log(`URL: ${url}`)
})
