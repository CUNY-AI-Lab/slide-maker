import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
const Database = createRequire(new URL('../apps/api/package.json', import.meta.url))('better-sqlite3')
import { migrateIdentityMapping, linkVerifiedIdentity } from '../apps/api/src/db/identity-mapping'

describe('operator identity mapping', () => {
  it('preserves IDs and roles, permits unlinked users, refuses collisions and replacement', () => {
    const sqlite = new Database(':memory:')
    sqlite.exec("CREATE TABLE users (id TEXT PRIMARY KEY, role TEXT); INSERT INTO users VALUES ('a','admin'),('b','viewer')")
    migrateIdentityMapping(sqlite)
    migrateIdentityMapping(sqlite)
    const subject = `cail-${'a'.repeat(32)}`
    expect(() => linkVerifiedIdentity(sqlite, 'a', 'email@example.edu')).toThrow()
    // Valid subject format is defined by the shared identity contract.
    expect(sqlite.prepare('SELECT id, role, canonical_subject FROM users').all()).toEqual([
      { id: 'a', role: 'admin', canonical_subject: null }, { id: 'b', role: 'viewer', canonical_subject: null },
    ])
    linkVerifiedIdentity(sqlite, 'a', subject)
    expect(() => linkVerifiedIdentity(sqlite, 'b', subject)).toThrow()
    expect(() => linkVerifiedIdentity(sqlite, 'a', `cail-${'b'.repeat(32)}`)).toThrow()
    expect(sqlite.prepare('SELECT id, role FROM users WHERE canonical_subject = ?').get(subject)).toEqual({ id: 'a', role: 'admin' })
    sqlite.close()
  })
})
