import { loadIdentityVerifierConfig, readIdentityKeyring, verifyIdentityJwt, verifyKeyringGatewayJwt, type IdentityVerifierConfig } from '@cuny-ai-lab/cail-identity'

export async function loadIdentityConfigs() {
  const input = { jwks: process.env.CAIL_IDENTITY_JWKS, issuer: process.env.CAIL_IDENTITY_ISSUER }
  const [app, gateway] = await Promise.all([
    loadIdentityVerifierConfig({ ...input, expectedAudience: 'cail:slide-maker' }),
    loadIdentityVerifierConfig({ ...input, expectedAudience: 'cail:gateway' }),
  ])
  if (!app.ok || !gateway.ok) throw new Error('Invalid CAIL identity verifier configuration')
  return { app: app.config, gateway: gateway.config }
}

export async function verifyRequestIdentity(headers: Headers, configs: { app: IdentityVerifierConfig; gateway: IdentityVerifierConfig }) {
  const keyring = readIdentityKeyring(headers)
  if (!keyring) return null
  const app = await verifyIdentityJwt(keyring.appJwt, configs.app)
  if (!app) return null
  if (keyring.gatewayJwt && !await verifyKeyringGatewayJwt(keyring, configs.gateway, app.subject)) return null
  return { subject: app.subject, gatewayToken: keyring.gatewayJwt }
}
