import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { paths, releaseIdentity } from './contract.mjs';
import { config, verifyCurrentRelease } from './verify-source.mjs';

const host = '100.111.252.53';
function run(command, args, options = {}) {
  try { return execFileSync(command, args, { encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], ...options }); }
  catch { throw new Error(`Private release command failed: ${command}. Inspect the host before retrying; no automatic upload or activation retry was made.`); }
}
// Values passed to the remote shell are generated IDs, digests or fixed paths.
function quote(value) { return `'${value.replaceAll("'", "'\\''")}'`; }
async function main() {
  const sha = await verifyCurrentRelease(config);
  const id = releaseIdentity(sha, process.env.GITHUB_RUN_ID, process.env.GITHUB_RUN_ATTEMPT);
  const username = process.env.SLIDE_SSH_USER;
  if (!/^[a-zA-Z0-9._@-]+$/.test(username || '') || !process.env.SLIDE_SSH_KEY || !process.env.SLIDE_SSH_KNOWN_HOSTS) throw new Error('Private SSH user, key and verified known-host entries are required.');
  const temporary = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), 'slide-release-'));
  try {
    const key = join(temporary, 'key');
    const hosts = join(temporary, 'known_hosts');
    writeFileSync(key, `${process.env.SLIDE_SSH_KEY.trim()}\n`, { mode: 0o600 });
    writeFileSync(hosts, `${process.env.SLIDE_SSH_KNOWN_HOSTS.trim()}\n`, { mode: 0o600 });
    run('ssh-keygen', ['-F', host, '-f', hosts]);
    const options = ['-o', `User=${username}`, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'IdentitiesOnly=yes', '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3', '-o', `UserKnownHostsFile=${hosts}`, '-i', key];
    const archive = join(temporary, 'source.tar');
    run('git', ['archive', '--format=tar', '--output', archive, sha]);
    const digest = createHash('sha256').update(readFileSync(archive)).digest('hex');
    const incoming = join(paths.releases, 'incoming', `${id}.tar`);
    const root = join(paths.releases, id);
    // Pre-provisioned, private directories; never overwrite an incoming release.
    run('ssh', [...options, host, `test ! -e ${quote(incoming)} && test ! -e ${quote(root)}`]);
    run('scp', [...options, archive, `${host}:${incoming}`], { timeout: 120000 });
    await verifyCurrentRelease(config);
    const command = [
      'set -eu', 'umask 077',
      `exec 9>${quote(join(paths.releases, 'release.lock'))}`, 'flock -n 9',
      `test "$(sha256sum ${quote(incoming)} | cut -d ' ' -f 1)" = ${quote(digest)}`,
      `mkdir ${quote(root)}`, `tar -xf ${quote(incoming)} -C ${quote(root)}`,
      `node ${quote(join(root, 'scripts/release/host.mjs'))} ${quote(sha)} ${quote(process.env.GITHUB_RUN_ID)} ${quote(process.env.GITHUB_RUN_ATTEMPT)}`,
    ].join('\n');
    const result = run('ssh', [...options, host, command], { input: process.env.GITHUB_TOKEN, timeout: 25 * 60 * 1000 });
    console.log(result.trim());
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
