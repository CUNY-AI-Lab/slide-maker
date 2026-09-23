import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import { activateRelease } from './activate.mjs';
import { applicationDefinitions, replaceProcesses } from './processes.mjs';
import { paths, isWithin, processDefinitions, releaseIdentity, validateConfiguration } from './contract.mjs';
import { config, githubApi, verifyReleaseSource } from './verify-source.mjs';

function run(command, args, options = {}) {
  try { return execFileSync(command, args, { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], ...options }); }
  catch { throw new Error(`Host release command failed: ${command}. Its output is withheld because it may contain private configuration.`); }
}
function json(text) { try { return JSON.parse(text); } catch { throw new Error('Invalid release command response.'); } }
function privatePath(path, directory = true) {
  const info = lstatSync(path);
  if ((directory ? !info.isDirectory() : !info.isFile()) || info.uid !== process.getuid() || (info.mode & 0o077)) {
    throw new Error('Release directories and configuration must be owned by this user and accessible only to this user.');
  }
}
async function pause() { await new Promise(resolve => setTimeout(resolve, 1000)); }
export async function main() {
  process.umask(0o077);
  if (process.platform !== 'linux' || process.version !== 'v22.23.1') throw new Error('Release host requires Linux and Node 22.23.1.');
  const [sha, runId, attempt] = process.argv.slice(2);
  const id = releaseIdentity(sha, runId, attempt);
  const root = join(paths.releases, id);
  if (realpathSync(new URL('../..', import.meta.url)) !== root) throw new Error('Release source is outside its immutable directory.');
  for (const path of [paths.releases, paths.backups, paths.rehearsals, root]) privatePath(path);
  privatePath(paths.environment, false);
  const environment = parseEnv(readFileSync(paths.environment, 'utf8'));
  const storage = validateConfiguration(environment);
  for (const key of ['database', 'uploads']) {
    storage[key] = realpathSync(storage[key]);
    if ([paths.releases, paths.backups, paths.rehearsals].some(path => isWithin(path, storage[key]))) throw new Error('Live state resolves inside deployment storage.');
  }
  if (!statSync(storage.database).isFile() || !statSync(storage.uploads).isDirectory() || isWithin(storage.uploads, storage.database)) throw new Error('Existing live state is invalid.');
  const sourceToken = readFileSync(0, 'utf8'); // One ephemeral token, sent over verified SSH stdin only.
  if (sourceToken.length > 16384 || !/^[A-Za-z0-9_]+$/.test(sourceToken)) throw new Error('GitHub read token is missing or malformed.');
  const verifySource = () => verifyReleaseSource({ ...config, sha, environment: 'production', api: githubApi(sourceToken) });
  const baseEnv = { PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'C.UTF-8' };
  const appEnv = { ...baseEnv, ...environment, DATABASE_URL: `file:${storage.database}`, NODE_ENV: 'production', API_HOST: '127.0.0.1', API_PORT: '3004', RELEASE_SHA: sha };
  const command = (exe, args, options = {}) => run(exe, args, { cwd: root, env: baseEnv, ...options });
  if (command('pnpm', ['--version']).trim() !== '9.15.0') throw new Error('Release host requires pnpm 9.15.0.');
  if (command('pm2', ['--version']).trim() !== '7.0.4') throw new Error('Release host requires the tested PM2 CLI 7.0.4.');
  command('lsof', ['-v']);
  await verifySource();
  // Install output stays private. The temporary credential is never written or
  // included in PM2 environment; the only config file contains a placeholder.
  if (readFileSync(join(root, '.npmrc'), 'utf8').trim() !== '@cuny-ai-lab:registry=https://npm.pkg.github.com') throw new Error('Unexpected tracked npm configuration.');
  const npmrc = join(root, '.release-npmrc');
  writeFileSync(npmrc, '@cuny-ai-lab:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\n', { mode: 0o600, flag: 'wx' });
  try { command('pnpm', ['install', '--frozen-lockfile'], { timeout: 600000, env: { ...baseEnv, NODE_AUTH_TOKEN: sourceToken, NPM_CONFIG_USERCONFIG: npmrc } }); }
  finally { rmSync(npmrc, { force: true }); }
  command('pnpm', ['build'], { timeout: 600000, env: { ...baseEnv, NODE_ENV: 'production' } });
  const apiDir = join(root, 'apps/api');
  const node = (args, extraEnv = {}) => command(process.execPath, ['--import', 'tsx', ...args], { cwd: apiDir, env: { ...appEnv, ...extraEnv } });
  node(['--input-type=module', '-e', "import {loadIdentityConfigs} from './src/auth/identity.ts'; await loadIdentityConfigs();"]);
  if (existsSync(join(apiDir, 'uploads'))) throw new Error('Release source contains an unexpected uploads directory.');
  symlinkSync(storage.uploads, join(apiDir, 'uploads'));

  const current = join(paths.releases, 'current');
  let previousTarget;
  try {
    if (!lstatSync(current).isSymbolicLink()) throw new Error('Current release marker must be a symlink.');
    previousTarget = realpathSync(current);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const list = () => json(command('pm2', ['jlist'])); // Never print PM2 environments.
  const oldList = list();
  const oldApps = processDefinitions(oldList);
  // Confirm that the configured state is actually used by the running API,
  // including the legacy pnpm -> tsx child process chain. Never migrate a
  // guessed path that happens to contain another valid SQLite database.
  const apiPid = oldList.find(item => item.name === 'slide-maker-api').pid;
  const owners = command('lsof', ['-t', storage.database]).trim().split(/\s+/).map(Number);
  for (let owner of owners) {
    let matched = false;
    for (let depth = 0; depth < 32 && owner > 1; depth++) {
      if (owner === apiPid) { matched = true; break; }
      owner = Number(command('ps', ['-o', 'ppid=', '-p', String(owner)]).trim());
    }
    if (!matched) throw new Error('Configured database is not exclusively held by the existing API process tree.');
  }
  if (!owners.length || owners.some(pid => !Number.isSafeInteger(pid) || pid < 2)) throw new Error('Could not establish the existing API database.');
  const oldApiCwd = oldApps[0].cwd;
  const oldUploads = existsSync(join(oldApiCwd, 'apps/api/uploads')) ? join(oldApiCwd, 'apps/api/uploads') : join(oldApiCwd, 'uploads');
  if (realpathSync(oldUploads) !== storage.uploads) throw new Error('Configured uploads do not match the existing API storage.');
  const backupRoot = join(paths.backups, id);
  mkdirSync(backupRoot, { mode: 0o700 });
  const rollback = join(backupRoot, 'previous-processes.json');
  writeFileSync(rollback, JSON.stringify({ apps: oldApps }), { mode: 0o600, flag: 'wx' });
  const next = join(backupRoot, 'new-processes.json');
  const nextApps = applicationDefinitions(root, appEnv, baseEnv);
  writeFileSync(next, JSON.stringify({ apps: nextApps }), { mode: 0o600, flag: 'wx' });
  async function waitFor(check) {
    for (let i = 0; i < 30; i++) { try { await check(); return; } catch { await pause(); } }
    throw new Error('Release process or private readiness verification timed out.');
  }
  function mark(target) {
    const temporary = join(paths.releases, `.current-${id}`);
    symlinkSync(target, temporary);
    renameSync(temporary, current);
  }
  await activateRelease({
    verifySource,
    stopWriters: () => command('pm2', ['stop', 'slide-maker-api']),
    verifyWritersStopped: () => {
      const databaseFiles = [storage.database, `${storage.database}-wal`, `${storage.database}-shm`].filter(existsSync);
      try { execFileSync('lsof', ['-t', ...databaseFiles], { env: baseEnv, stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 }); }
      catch (error) { if (error.status === 1 && !error.stdout?.length && !error.stderr?.length) return; }
      throw new Error('A database process is still open or exclusive access could not be verified.');
    },
    backup: () => node(['scripts/state-snapshot.ts', 'backup', storage.database, storage.uploads, join(backupRoot, 'snapshot'), '--writers-stopped']),
    rehearseRestore: () => {
      const destination = join(paths.rehearsals, id);
      node(['scripts/state-snapshot.ts', 'restore-new', join(backupRoot, 'snapshot'), destination]);
      node(['scripts/migrate-identity.ts'], { DATABASE_URL: `file:${join(destination, 'database.sqlite')}` });
    },
    migrate: () => node(['scripts/migrate-identity.ts']),
    start: () => replaceProcesses(command, list, next),
    verify: () => waitFor(async () => {
      const definitions = processDefinitions(list());
      for (const [index, expected] of nextApps.entries()) {
        if (definitions[index].cwd !== expected.cwd || definitions[index].env.RELEASE_SHA !== sha) throw new Error('Unexpected active source.');
      }
      for (const port of [3004, 4173]) {
        const listeners = command('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fn']).split('\n').filter(line => line.startsWith('n'));
        if (listeners.length !== 1 || listeners[0] !== `n127.0.0.1:${port}`) throw new Error('Expected one loopback-only listener per component.');
      }
      const request = (url, headers) => fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(3000) });
      const denied = await request('http://127.0.0.1:3004/internal/ready');
      await denied.body?.cancel();
      if (denied.status !== 404) throw new Error('Readiness is not private.');
      const response = await request('http://127.0.0.1:3004/internal/ready', { Authorization: `Bearer ${environment.READINESS_TOKEN}` });
      const ready = await response.json();
      if (!response.ok || ready.status !== 'ready' || ready.release !== sha || ready.service !== 'slide-maker') throw new Error('Exact release is not ready.');
      const web = await request('http://127.0.0.1:4173/slide-maker/');
      await web.body?.cancel();
      if (!web.ok) throw new Error('Frontend is unavailable.');
    }),
    save: () => { command('pm2', ['save']); mark(root); },
    rollbackCode: async () => {
      replaceProcesses(command, list, rollback);
      await waitFor(() => {
        const restored = processDefinitions(list());
        if (restored.some((app, index) => app.cwd !== oldApps[index].cwd || app.script !== oldApps[index].script)) throw new Error('Prior processes did not recover.');
      });
      command('pm2', ['save']);
      if (previousTarget) mark(previousTarget);
      console.log('Recovered prior application processes. Live database and uploads were not restored.');
    },
  });
  console.log(`Verified release ${sha}, one loopback process per component, a state snapshot and restore rehearsal, and private readiness. Live signed-in acceptance remains separate.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
