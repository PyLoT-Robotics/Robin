import type { Connect } from 'vite'

import { isRootCAAvailable } from '../infra/certificate/certificateRepository'
import { getLocalIPv4Addresses, getPrimaryIPv4 } from '../infra/network/network'
import { createQRCodeSvg } from '../infra/qr/qrCode'
import type { RobinServerError, RobinServerStatus } from '../models/serverStatus'
import type { CertificatePaths } from '../models/certificate'

function sendJson(response: Parameters<Connect.NextHandleFunction>[1], status: number, body: unknown) {
  response.statusCode = status
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

export function createServerApiMiddleware(
  certificatePaths: CertificatePaths,
): Connect.NextHandleFunction {
  return (request, response, next) => {
    const pathname = request.url
      ? new URL(request.url, 'https://robin.local').pathname
      : ''

    if (pathname === '/api/root-ca-qr') {
      const host = request.headers.host ?? `${getPrimaryIPv4()}:5173`
      void createQRCodeSvg(`https://${host}/rootCA.pem`)
        .then((svg) => {
          response.statusCode = 200
          response.setHeader('Cache-Control', 'no-store')
          response.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
          response.end(svg)
        })
        .catch((error) => {
          sendJson(response, 500, { status: 'error', error: String(error) })
        })
      return
    }

    if (pathname !== '/api/status') {
      next()
      return
    }

    try {
      const payload: RobinServerStatus = {
        status: 'ok',
        primaryIp: getPrimaryIPv4(),
        addresses: getLocalIPv4Addresses(),
        rootCAAvailable: isRootCAAvailable(certificatePaths),
      }
      sendJson(response, 200, payload)
    } catch (error) {
      const payload: RobinServerError = { status: 'error', error: String(error) }
      sendJson(response, 503, payload)
    }
  }
}
