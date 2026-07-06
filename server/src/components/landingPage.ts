import type { StatusBadgeState } from '../models/landingPage'
import type { RobinServerStatus } from '../models/serverStatus'

function getElement<T extends Element>(selector: string) {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Landing page element was not found: ${selector}`)
  return element
}

const addressElement = getElement<HTMLElement>('#server-address')
const addressList = getElement<HTMLElement>('#address-list')
const serverStatus = getElement<HTMLElement>('#server-status')
const caStatus = getElement<HTMLElement>('#ca-status')
const trustStatus = getElement<HTMLElement>('#trust-status')
const copyHint = getElement<HTMLElement>('#copy-hint')
const qrDialog = getElement<HTMLDialogElement>('#qr-dialog')
let primaryIp = window.location.hostname

function setBadge(element: HTMLElement, text: string, state: StatusBadgeState) {
  element.textContent = text
  element.className = `badge ${state}`
}

function updateTrustStatus() {
  const trusted = window.location.protocol === 'https:' && window.isSecureContext
  setBadge(
    trustStatus,
    trusted ? 'HTTPS trusted by this browser' : 'HTTPS is not trusted yet',
    trusted ? 'good' : 'warn',
  )
}

async function fetchServerStatus() {
  const response = await fetch(`/api/status?time=${Date.now()}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<RobinServerStatus>
}

async function refreshStatus() {
  updateTrustStatus()
  try {
    const status = await fetchServerStatus()
    primaryIp = status.primaryIp
    addressElement.textContent = primaryIp
    setBadge(serverStatus, 'Server reachable', 'good')
    setBadge(
      caStatus,
      status.rootCAAvailable ? 'Root CA ready' : 'Root CA missing',
      status.rootCAAvailable ? 'good' : 'warn',
    )
    addressList.replaceChildren(...status.addresses.map((address) => {
      const code = document.createElement('code')
      code.textContent = address
      return code
    }))
  } catch (error) {
    addressElement.textContent = primaryIp
    setBadge(serverStatus, 'Status check failed', 'warn')
    setBadge(caStatus, 'Root CA status unknown', 'warn')
    console.error(error)
  }
}

getElement<HTMLButtonElement>('#copy-ip').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(primaryIp)
    copyHint.textContent = 'Copied! Paste this address into Robin Settings.'
  } catch {
    copyHint.textContent = `Copy this address: ${primaryIp}`
  }
})

getElement<HTMLButtonElement>('#show-qr').addEventListener('click', () => qrDialog.showModal())
getElement<HTMLButtonElement>('#close-qr').addEventListener('click', () => qrDialog.close())
getElement<HTMLButtonElement>('#recheck').addEventListener('click', refreshStatus)
qrDialog.addEventListener('click', (event) => {
  if (event.target === qrDialog) qrDialog.close()
})

void refreshStatus()
