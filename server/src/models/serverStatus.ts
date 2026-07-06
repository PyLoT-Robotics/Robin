export type RobinServerStatus = {
  status: 'ok'
  primaryIp: string
  addresses: string[]
  rootCAAvailable: boolean
}

export type RobinServerError = {
  status: 'error'
  error: string
}
