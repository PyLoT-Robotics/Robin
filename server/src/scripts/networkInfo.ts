import { getLocalIPv4Addresses, getPrimaryIPv4 } from '../infra/network/network'

const primaryIp = getPrimaryIPv4()
if (process.argv.includes('--primary')) {
  console.log(primaryIp)
} else {
  console.log(JSON.stringify({ primaryIp, addresses: getLocalIPv4Addresses() }))
}
