import type Database from 'better-sqlite3'
import { isCailSubject } from '@cuny-ai-lab/cail-identity'

/** Additive migration: existing user IDs, ownership and local roles are untouched. */
export function migrateIdentityMapping(sqlite: Database.Database) {
  sqlite.transaction(() => {
    const columns = sqlite.prepare('PRAGMA table_info(users)').all() as { name: string }[]
    if (!columns.some((column) => column.name === 'canonical_subject')) {
      sqlite.exec('ALTER TABLE users ADD COLUMN canonical_subject TEXT')
    }
    sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_canonical_subject_unique ON users(canonical_subject)')
  })()
}

export function linkVerifiedIdentity(sqlite: Database.Database, userId: string, subject: string) {
  if (!isCailSubject(subject)) throw new Error('A verified canonical CAIL subject is required')
  const result = sqlite.prepare('UPDATE users SET canonical_subject = ? WHERE id = ? AND canonical_subject IS NULL').run(subject, userId)
  if (result.changes !== 1) throw new Error('User missing or already linked; refusing replacement')
}
