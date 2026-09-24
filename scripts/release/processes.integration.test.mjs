import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { applicationDefinitions, replaceProcesses } from './processes.mjs';
import { processDefinitions } from './contract.mjs';

const pm2 = process.env.CAIL_RELEASE_PM2;
test('real isolated PM2 starts the deployed runtime profile and restores captured processes and environment', { skip: !pm2, timeout: 60000 }, async () => {
  const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'slide-pm2-test-')));
  const baseEnv = { PATH: process.env.PATH, HOME: process.env.HOME, PM2_HOME: join(temporary, 'pm2'), LANG: 'C.UTF-8' };
  const command = (_, args) => execFileSync(process.execPath, [pm2, ...args], { env: baseEnv, encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] });
  const list = () => JSON.parse(command('pm2', ['jlist']));
  const typescriptModules = dirname(dirname(dirname(pm2)));
  async function ready(root, sha) {
    let failure;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const definitions = processDefinitions(list());
        assert.equal(definitions[0].cwd, join(root, 'apps/api'));
        for (const [index, name] of ['api', 'web'].entries()) {
          const url = readFileSync(join(root, `${name}.url`), 'utf8');
          const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
          const body = await response.json();
          assert.equal(body.release, sha);
          assert.equal(body.cwd, definitions[index].cwd);
          assert.equal(body.ciToken, undefined);
          assert.equal(body.applicationSecret, index === 0 ? 'preserved-fixture-secret' : undefined);
        }
        return;
      } catch (error) { failure = error; await new Promise(resolve => setTimeout(resolve, 150)); }
    }
    const diagnostic = list().map(item => ({ name: item.name, status: item.pm2_env?.status, cwd: item.pm2_env?.pm_cwd, error: readFileSync(item.pm2_env.pm_err_log_path, 'utf8').slice(-1500) }));
    assert.fail(`Disposable PM2 release did not become ready: ${failure?.message}; ${JSON.stringify(diagnostic)}`);
  }
  function stage(label, sha) {
    const root = join(temporary, label);
    for (const path of ['apps/api/src', 'apps/web/node_modules/vite/bin']) mkdirSync(join(root, path), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{"type":"module"}');
    writeFileSync(join(root, 'apps/web/node_modules/vite/package.json'), '{"type":"module"}');
    symlinkSync(typescriptModules, join(root, 'apps/api/node_modules'));
    const server = name => `import {createServer} from 'node:http'; import {writeFileSync} from 'node:fs';\nconst server=createServer((q,r)=>r.end(JSON.stringify({release:process.env.RELEASE_SHA,cwd:process.cwd(),applicationSecret:process.env.SESSION_SECRET,ciToken:process.env.GITHUB_TOKEN})));\nserver.listen(0,'127.0.0.1',()=>writeFileSync(${JSON.stringify(join(root, `${name}.url`))},'http://127.0.0.1:'+server.address().port));`;
    writeFileSync(join(root, 'apps/api/src/index.ts'), server('api'));
    writeFileSync(join(root, 'apps/web/node_modules/vite/bin/vite.js'), server('web'));
    const apps = applicationDefinitions(root, { ...baseEnv, RELEASE_SHA: sha, SESSION_SECRET: 'preserved-fixture-secret' }, baseEnv);
    const file = join(root, 'ecosystem.json');
    writeFileSync(file, JSON.stringify({ apps }));
    return { root, file };
  }
  try {
    const old = stage('old', 'a'.repeat(40));
    command('pm2', ['start', old.file]);
    await ready(old.root, 'a'.repeat(40));
    const original = processDefinitions(list());
    const rollback = join(temporary, 'rollback.json');
    writeFileSync(rollback, JSON.stringify({ apps: original }));
    const next = stage('new', 'b'.repeat(40));
    replaceProcesses(command, list, next.file);
    await ready(next.root, 'b'.repeat(40));
    command('pm2', ['save']);
    replaceProcesses(command, list, rollback);
    await ready(old.root, 'a'.repeat(40));
    command('pm2', ['save']);
    assert.equal(list().length, 2);
  } finally {
    try { command('pm2', ['kill']); } finally { rmSync(temporary, { recursive: true, force: true }); }
  }
});
