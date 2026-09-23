import test from 'node:test';
import assert from 'node:assert/strict';
import { processDefinitions, releaseIdentity, validateConfiguration } from './contract.mjs';

const environment = {
  SESSION_SECRET: 'fixture', READINESS_TOKEN: 'fixture', CAIL_IDENTITY_JWKS: 'public-fixture',
  CAIL_IDENTITY_ISSUER: 'https://tools.ailab.gc.cuny.edu/cail-sso',
  CAIL_GATEWAY_URL: 'https://tools.ailab.gc.cuny.edu', PUBLIC_URL: 'https://tools.ailab.gc.cuny.edu/slide-maker',
  DATABASE_URL: 'file:/data/existing/database.sqlite', SLIDE_UPLOADS_PATH: '/data/existing/uploads',
};
test('release identity cannot contain a ref, path or shell expression', () => {
  assert.equal(releaseIdentity('a'.repeat(40), '12', '1'), `${'a'.repeat(40)}-12-1`);
  for (const values of [['main', '12', '1'], ['a'.repeat(40), '../12', '1'], ['a'.repeat(40), '12', '$(whoami)']]) assert.throws(() => releaseIdentity(...values));
});
test('state paths must be explicit, separate and outside deployment storage', () => {
  assert.deepEqual(validateConfiguration(environment), { database: '/data/existing/database.sqlite', uploads: '/data/existing/uploads' });
  for (const patch of [
    { DATABASE_URL: 'file:./data/app.db' }, { SLIDE_UPLOADS_PATH: '' }, { SLIDE_UPLOADS_PATH: '/' },
    { DATABASE_URL: 'file:/data/slide-maker-releases/old/db' }, { SLIDE_UPLOADS_PATH: '/data/slide-maker-backups/new' },
    { DATABASE_URL: 'file:/data/existing/uploads/database.sqlite' }, { SLIDE_UPLOADS_PATH: '/data/existing/../uploads' },
  ]) assert.throws(() => validateConfiguration({ ...environment, ...patch }));
});
test('application configuration cannot silently replace fleet endpoints or retain CI credentials', () => {
  for (const patch of [
    { CAIL_GATEWAY_URL: 'https://tools.ailab.gc.cuny.edu/v1' }, { CAIL_IDENTITY_ISSUER: 'https://wrong.test' },
    { PUBLIC_URL: 'http://localhost:4173' }, { READINESS_TOKEN: '' }, { GITHUB_TOKEN: 'fixture' }, { NODE_AUTH_TOKEN: 'fixture' }, { NODE_OPTIONS: '--inspect=0.0.0.0' },
  ]) assert.throws(() => validateConfiguration({ ...environment, ...patch }));
});
test('rollback captures exactly one online process per component and preserves existing arguments and environment', () => {
  const list = ['slide-maker-api', 'slide-maker-web'].map(name => ({ name, pm2_env: { status: 'online', exec_mode: 'fork_mode', pm_exec_path: '/usr/bin/node', pm_cwd: '/data/old', args: ['server.js'], env: { DATABASE_URL: environment.DATABASE_URL } } }));
  assert.equal(processDefinitions(list)[0].env.DATABASE_URL, environment.DATABASE_URL);
  assert.deepEqual(processDefinitions(list)[0].args, ['server.js']);
  assert.throws(() => processDefinitions([list[0]]));
  assert.throws(() => processDefinitions([...list, list[0]]));
  assert.throws(() => processDefinitions([{ ...list[0], pm2_env: { ...list[0].pm2_env, status: 'stopped' } }, list[1]]));
});
