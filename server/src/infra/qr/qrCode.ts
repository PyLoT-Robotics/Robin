import QRCode from 'qrcode'

export function createQRCodeSvg(value: string) {
  return QRCode.toString(value, { type: 'svg', margin: 1 })
}

export function createTerminalQRCode(value: string) {
  return QRCode.toString(value)
}
