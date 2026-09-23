import { createStateSnapshot, restoreStateSnapshot, verifyStateSnapshot } from '../src/db/state-snapshot.js'

const [action, ...args] = process.argv.slice(2)
if (action === 'backup' && args.length === 4 && args[3] === '--writers-stopped') {
  const result = await createStateSnapshot(args[0]!, args[1]!, args[2]!)
  console.log(`Verified snapshot created (${result.files} files).`)
} else if (action === 'verify' && args.length === 1) {
  await verifyStateSnapshot(args[0]!)
  console.log('Snapshot files and SQLite integrity verified.')
} else if (action === 'restore-new' && args.length === 2) {
  await restoreStateSnapshot(args[0]!, args[1]!)
  console.log('Snapshot restored and verified in a new directory. No running service was changed.')
} else {
  console.error('Usage: state-snapshot backup DATABASE UPLOADS NEW_DESTINATION --writers-stopped | verify SNAPSHOT | restore-new SNAPSHOT NEW_DESTINATION')
  process.exitCode = 2
}
