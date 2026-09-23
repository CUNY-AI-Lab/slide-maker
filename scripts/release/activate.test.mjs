import test from 'node:test';
import assert from 'node:assert/strict';
import { activateRelease } from './activate.mjs';

function fixture(failure, rollbackFails = false) {
  const events = [];
  let verifies = 0;
  const steps = Object.fromEntries(['verifySource', 'stopWriters', 'verifyWritersStopped', 'backup', 'rehearseRestore', 'migrate', 'start', 'verify', 'save', 'rollbackCode'].map(name => [name, async () => {
    events.push(name);
    if (name === 'verifySource') verifies++;
    if (failure === name || (failure === 'staleAfterBackup' && name === 'verifySource' && verifies === 2) || (name === 'rollbackCode' && rollbackFails)) throw new Error(`Failed ${name}`);
  }]));
  return { steps, events };
}
test('release verifies source, stops writers, rehearses restoration, and verifies new code before saving', async () => {
  const f = fixture(); await activateRelease(f.steps);
  assert.deepEqual(f.events, ['verifySource', 'stopWriters', 'verifyWritersStopped', 'backup', 'rehearseRestore', 'verifySource', 'migrate', 'start', 'verify', 'save']);
});
test('initial source refusal cannot stop the application', async () => {
  const f = fixture('verifySource'); await assert.rejects(activateRelease(f.steps));
  assert.deepEqual(f.events, ['verifySource']);
});
test('failed stop, exclusive-access check, backup, rehearsal or superseded SHA cannot migrate live data', async () => {
  for (const failure of ['stopWriters', 'verifyWritersStopped', 'backup', 'rehearseRestore', 'staleAfterBackup']) {
    const f = fixture(failure); await assert.rejects(activateRelease(f.steps));
    assert.equal(f.events.at(-1), 'rollbackCode');
    for (const name of ['migrate', 'start', 'verify', 'save']) assert.ok(!f.events.includes(name), `${failure} reached ${name}`);
  }
});
test('migration, start, readiness and persistence failures recover code without restoring live data', async () => {
  for (const failure of ['migrate', 'start', 'verify', 'save']) {
    const f = fixture(failure); await assert.rejects(activateRelease(f.steps));
    assert.equal(f.events.at(-1), 'rollbackCode');
    assert.equal(f.events.filter(name => name === 'rehearseRestore').length, 1);
    if (failure !== 'save') assert.ok(!f.events.includes('save'));
  }
});
test('a failed code recovery is explicit and cannot report release success', async () => {
  const f = fixture('verify', true);
  await assert.rejects(activateRelease(f.steps), /process recovery failed/);
  assert.ok(!f.events.includes('save'));
});
