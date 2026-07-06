import { execFileSync } from 'node:child_process'
import { networkInterfaces } from 'node:os'

function isIPv4(value: string) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)
}

export function getLocalIPv4Addresses() {
  const addresses = new Set<string>()

  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.add(entry.address)
    }
  }

  return [...addresses]
}

function getDefaultRouteIPv4() {
  if (process.platform !== 'linux') return ''

  try {
    const output = execFileSync('ip', ['-4', 'route', 'get', '1.1.1.1'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return output.match(/\bsrc\s+(\d+(?:\.\d+){3})\b/)?.[1] ?? ''
  } catch {
    return ''
  }
}

export function getPrimaryIPv4() {
  const override = process.env.ROBIN_SERVER_HOST?.trim() ?? ''
  if (isIPv4(override)) return override

  const addresses = getLocalIPv4Addresses()
  const routeAddress = getDefaultRouteIPv4()
  if (routeAddress && addresses.includes(routeAddress)) return routeAddress
  if (addresses[0]) return addresses[0]

  throw new Error(
    'No non-loopback IPv4 address was found. Connect the robot to a network or set ROBIN_SERVER_HOST.',
  )
}
