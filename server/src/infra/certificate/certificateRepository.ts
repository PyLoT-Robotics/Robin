import fs from 'node:fs'
import type { CertificatePaths } from '../../models/certificate'

export function loadHttpsOptions(paths: CertificatePaths) {
  if (!fs.existsSync(paths.certificate) || !fs.existsSync(paths.privateKey)) {
    throw new Error(
      `Robin server certificates were not found. Run "bun run create_certificate" first.\n` +
      `Expected certificate: ${paths.certificate}\nExpected key: ${paths.privateKey}`,
    )
  }

  return {
    cert: fs.readFileSync(paths.certificate),
    key: fs.readFileSync(paths.privateKey),
  }
}

export function isRootCAAvailable(paths: CertificatePaths) {
  return paths.rootCAFiles.some((candidate) => fs.existsSync(candidate))
}
