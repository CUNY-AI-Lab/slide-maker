import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

type FileRecord = { path: string; sha256: string; bytes: number }
type Manifest = { version: 1; files: FileRecord[] }

async function digest(path: string) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function filesAt(root: string, prefix = ''): Promise<FileRecord[]> {
  const result: FileRecord[] = []
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) result.push(...await filesAt(root, path))
    else if (entry.isFile()) result.push({ path, sha256: await digest(join(root, path)), bytes: (await stat(join(root, path))).size })
    else throw new Error('Snapshots require regular files and directories; symlinks are not copied')
  }
  return result.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
}

function checkDatabase(path: string) {
  const db = new Database(path, { readonly: true, fileMustExist: true })
  try {
    if (db.pragma('quick_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length !== 0) {
      throw new Error('Snapshot database integrity check failed')
    }
  } finally { db.close() }
}

async function copyFiles(source: string, destination: string, records: FileRecord[]) {
  for (const file of records) {
    const target = join(destination, file.path)
    await mkdir(dirname(target), { recursive: true })
    // Destination is newly created; exclusive copies refuse unexpected writes.
    await copyFile(join(source, file.path), target, 1)
  }
}

/** The caller must stop every API/upload writer until this promise settles. */
export async function createStateSnapshot(databasePath: string, uploadsPath: string, destination: string) {
  const source = await realpath(uploadsPath)
  const target = join(await realpath(dirname(resolve(destination))), basename(resolve(destination)))
  const withinSource = relative(source, target)
  if (withinSource === '' || (!withinSource.startsWith(`..${sep}`) && withinSource !== '..' && !isAbsolute(withinSource))) {
    throw new Error('Snapshot destination must be outside the uploads directory')
  }
  const originalFiles = await filesAt(source)
  await mkdir(target, { mode: 0o700 }) // Refuses existing destinations.
  const db = new Database(databasePath, { readonly: true, fileMustExist: true })
  try { await db.backup(join(target, 'database.sqlite')) } finally { db.close() }
  // Convert only the independent snapshot to a self-contained rollback journal;
  // verification must not create WAL/SHM sidecars inside an immutable snapshot.
  const snapshotDb = new Database(join(target, 'database.sqlite'))
  try { snapshotDb.pragma('journal_mode = DELETE') } finally { snapshotDb.close() }
  await mkdir(join(target, 'uploads'), { mode: 0o700 })
  await copyFiles(source, join(target, 'uploads'), originalFiles)
  if (JSON.stringify(originalFiles) !== JSON.stringify(await filesAt(source))) {
    throw new Error('Uploads changed during backup; keep writers stopped and take a new snapshot')
  }
  checkDatabase(join(target, 'database.sqlite'))
  const manifest: Manifest = { version: 1, files: await filesAt(target) }
  await writeFile(join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  await verifyStateSnapshot(target)
  return { files: manifest.files.length }
}

export async function verifyStateSnapshot(directory: string) {
  const raw = await readFile(join(directory, 'manifest.json'))
  if (raw.length > 16 * 1024 * 1024) throw new Error('Snapshot manifest is too large')
  const manifest = JSON.parse(raw.toString()) as Manifest
  if (manifest.version !== 1 || !Array.isArray(manifest.files) || !manifest.files.some(file => file.path === 'database.sqlite')) {
    throw new Error('Invalid snapshot manifest')
  }
  for (const file of manifest.files) {
    if (typeof file.path !== 'string' || file.path.includes('\\') || file.path.split('/').some(part => part === '..' || part === '.' || part === '')
      || (file.path !== 'database.sqlite' && !file.path.startsWith('uploads/'))
      || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes < 0) {
      throw new Error('Invalid snapshot file record')
    }
  }
  const actual = (await filesAt(directory)).filter(file => file.path !== 'manifest.json')
  if (JSON.stringify(actual) !== JSON.stringify(manifest.files)) throw new Error('Snapshot files do not match their manifest')
  checkDatabase(join(directory, 'database.sqlite'))
  return manifest
}

/** Restore only into a new directory; never replaces a live database or upload. */
export async function restoreStateSnapshot(directory: string, destination: string) {
  const manifest = await verifyStateSnapshot(directory)
  await mkdir(destination, { mode: 0o700 })
  await mkdir(join(destination, 'uploads'), { mode: 0o700 })
  await copyFiles(directory, destination, manifest.files)
  await copyFile(join(directory, 'manifest.json'), join(destination, 'manifest.json'), 1)
  await verifyStateSnapshot(destination)
}
