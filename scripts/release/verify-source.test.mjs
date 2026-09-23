import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyReleaseSource } from './verify-source.mjs';
const sha = 'a'.repeat(40);
const goodRun = { id: 10, head_sha: sha, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success' };
const base = { repository: 'CUNY-AI-Lab/example', sha, checks: { 'ci.yml': ['Source gate'] }, environment: 'production' };
function fixture(overrides = {}) {
  const visited = [];
  return { visited, api: async path => {
    visited.push(path);
    if (path.endsWith('/git/ref/heads/main')) return { object: { sha: overrides.head || sha } };
    if (path.includes('/workflows/')) return { workflow_runs: overrides.runs || [goodRun] };
    if (path.includes('/jobs?')) return { jobs: overrides.jobs || [{ name: 'Source gate', conclusion: 'success' }] };
    if (path.endsWith('/deployment-branch-policies')) return { branch_policies: overrides.branches || [{ name: 'main', type: 'branch' }] };
    if (path.endsWith('/environments/production')) return { deployment_branch_policy: { custom_branch_policies: overrides.protected !== false } };
    throw new Error('Unexpected API request');
  } };
}
test('release requires exact current main, successful main CI and a protected main-only environment', async () => {
  const f = fixture(); await verifyReleaseSource({ ...base, api: f.api }); assert.equal(f.visited.length, 5);
});
test('stale or malformed SHA stops before deployment prerequisites are accessed', async () => {
  for (const options of [{ ...base, sha: 'main' }, { ...base, sha: 'b'.repeat(40) }]) {
    const f = fixture(); await assert.rejects(verifyReleaseSource({ ...options, api: f.api })); assert.ok(f.visited.length <= 1);
  }
});
test('PR success, wrong source, pending checks and a newer failed run cannot authorize release', async () => {
  for (const runs of [
    [{ ...goodRun, event: 'pull_request' }], [{ ...goodRun, head_sha: 'b'.repeat(40) }],
    [{ ...goodRun, status: 'in_progress', conclusion: null }], [goodRun, { ...goodRun, id: 11, conclusion: 'failure' }],
  ]) await assert.rejects(verifyReleaseSource({ ...base, api: fixture({ runs }).api }));
});
test('missing, skipped, failed or ambiguous source jobs cannot authorize release', async () => {
  for (const jobs of [[], [{ name: 'Source gate', conclusion: 'skipped' }], [{ name: 'Source gate', conclusion: 'failure' }], [{ name: 'Source gate', conclusion: 'success' }, { name: 'Source gate', conclusion: 'success' }]]) {
    await assert.rejects(verifyReleaseSource({ ...base, api: fixture({ jobs }).api }));
  }
});
test('unprotected, wildcard or additional deployment branches are rejected', async () => {
  for (const options of [{ protected: false }, { branches: [{ name: '*', type: 'branch' }] }, { branches: [{ name: 'main', type: 'tag' }] }, { branches: [{ name: 'main', type: 'branch' }, { name: 'dev', type: 'branch' }] }]) {
    await assert.rejects(verifyReleaseSource({ ...base, api: fixture(options).api }));
  }
});
