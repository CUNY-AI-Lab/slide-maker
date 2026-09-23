import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStateSnapshot, restoreStateSnapshot, verifyStateSnapshot } from '../apps/api/src/db/state-snapshot'
import { migrateIdentityMapping } from '../apps/api/src/db/identity-mapping'
const Database = createRequire(new URL('../apps/api/package.json', import.meta.url))('better-sqlite3')
const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'slide-snapshot-')); roots.push(root)
  const database = join(root, 'source.sqlite'), uploads = join(root, 'uploads')
  await mkdir(join(uploads, 'existing-deck'), { recursive: true })
  await writeFile(join(uploads, 'existing-deck', 'existing.txt'), 'Preserved upload and sidecar bytes')
  const db = new Database(database)
  db.pragma('journal_mode = WAL')
  db.exec("CREATE TABLE users(id TEXT PRIMARY KEY, role TEXT); CREATE TABLE decks(id TEXT PRIMARY KEY, owner TEXT REFERENCES users(id)); INSERT INTO users VALUES('existing-user','admin'); INSERT INTO decks VALUES('existing-deck','existing-user')")
  return { root, database, uploads, db }
}

describe('release state snapshot and restoration', () => {
  it('preserves WAL-backed ownership and upload bytes across restore and repeated additive migration', async () => {
    const f = await fixture()
    try {
      const snapshot = join(f.root, 'snapshot'), restored = join(f.root, 'restored')
      await createStateSnapshot(f.database, f.uploads, snapshot)
      await restoreStateSnapshot(snapshot, restored)
      const db = new Database(join(restored, 'database.sqlite'))
      try {
        migrateIdentityMapping(db); migrateIdentityMapping(db)
        expect(db.prepare('SELECT * FROM decks').all()).toEqual([{ id: 'existing-deck', owner: 'existing-user' }])
        expect(db.prepare('SELECT * FROM users').all()).toEqual([{ id: 'existing-user', role: 'admin', canonical_subject: null }])
      } finally { db.close() }
      expect(await readFile(join(restored, 'uploads/existing-deck/existing.txt'), 'utf8')).toBe('Preserved upload and sidecar bytes')
      expect(f.db.prepare('PRAGMA table_info(users)').all().map((row: { name: string }) => row.name)).toEqual(['id', 'role'])
      await expect(restoreStateSnapshot(snapshot, restored)).rejects.toThrow()
      await writeFile(join(snapshot, 'uploads/existing-deck/existing.txt'), 'changed')
      await expect(verifyStateSnapshot(snapshot)).rejects.toThrow('do not match')
    } finally { f.db.close() }
  })
  it('refuses recursive destinations and upload symlinks before copying unrelated data', async () => {
    const f = await fixture()
    try {
      await expect(createStateSnapshot(f.database, f.uploads, join(f.uploads, 'snapshot'))).rejects.toThrow('outside')
      await symlink(f.database, join(f.uploads, 'linked.sqlite'))
      await expect(createStateSnapshot(f.database, f.uploads, join(f.root, 'snapshot'))).rejects.toThrow('symlinks')
    } finally { f.db.close() }
  })
})
