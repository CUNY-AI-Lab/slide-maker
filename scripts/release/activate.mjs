// Every callback is awaited. A failed backup or rehearsal cannot reach the live
// migration. Rollback restores process definitions only, never application data.
export async function activateRelease(steps) {
  await steps.verifySource();
  let stopped = false;
  try {
    stopped = true; // A partially failed stop still requires recovery.
    await steps.stopWriters();
    await steps.verifyWritersStopped();
    await steps.backup();
    await steps.rehearseRestore();
    await steps.verifySource(); // Main may have advanced during the rehearsal.
    await steps.migrate();
    await steps.start();
    await steps.verify();
    await steps.save();
  } catch (error) {
    if (stopped) {
      try { await steps.rollbackCode(); }
      catch { throw new Error('Release failed and process recovery failed. Keep the saved state and inspect the host; no data was restored.'); }
    }
    throw error;
  }
}
