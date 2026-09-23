import { sqlite } from '../src/db/index.js'
import { migrateIdentityMapping, linkVerifiedIdentity } from '../src/db/identity-mapping.js'

const [userId, subject, verification] = process.argv.slice(2)
if (!userId || !subject || verification !== '--operator-verified') {
  throw new Error('Usage: bun apps/api/scripts/link-identity.ts <existing-user-id> <canonical-subject> --operator-verified; verify account ownership independently first, never by email alone')
}
migrateIdentityMapping(sqlite)
linkVerifiedIdentity(sqlite, userId, subject)
console.log('Verified identity linked; existing ownership and local role preserved')
sqlite.close()
