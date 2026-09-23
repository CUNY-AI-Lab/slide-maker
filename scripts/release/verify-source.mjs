import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export async function verifyReleaseSource({ repository, sha, checks, api, environment }) {
  if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('Release requires a full lowercase commit SHA.');
  const ref = await api(`repos/${repository}/git/ref/heads/main`);
  if (ref.object?.sha !== sha) throw new Error('Release SHA is no longer current main.');
  for (const [workflow, names] of Object.entries(checks)) {
    const result = await api(`repos/${repository}/actions/workflows/${workflow}/runs?head_sha=${sha}&event=push&branch=main&per_page=20`);
    const run = result.workflow_runs?.filter(item => item.head_sha === sha && item.event === 'push' && item.head_branch === 'main')
      .sort((a, b) => b.id - a.id)[0];
    if (!run || run.status !== 'completed' || run.conclusion !== 'success') throw new Error(`Current-main ${workflow} has not passed.`);
    const jobs = await api(`repos/${repository}/actions/runs/${run.id}/jobs?per_page=100`);
    for (const name of names) {
      const matches = jobs.jobs?.filter(job => job.name === name) || [];
      if (matches.length !== 1 || matches[0].conclusion !== 'success') throw new Error(`Required release check has not passed: ${name}`);
    }
  }
  if (environment) {
    const config = await api(`repos/${repository}/environments/${environment}`);
    if (config.deployment_branch_policy?.custom_branch_policies !== true) throw new Error('Release environment must allow only main.');
    const rules = await api(`repos/${repository}/environments/${environment}/deployment-branch-policies`);
    if (rules.branch_policies?.length !== 1 || rules.branch_policies[0].name !== 'main' || rules.branch_policies[0].type !== 'branch') {
      throw new Error('Release environment must allow only the main branch.');
    }
  }
}

export function githubApi(token, transport = fetch) {
  if (!token) throw new Error('GitHub read token is required.');
  return async path => {
    const response = await transport(new URL(path, 'https://api.github.com/'), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`GitHub release verification failed (${response.status}).`);
    const text = await response.text();
    if (text.length > 2 * 1024 * 1024) throw new Error('GitHub release verification response is too large.');
    return JSON.parse(text);
  };
}

export async function verifyCurrentRelease(config) {
  if (process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || process.env.GITHUB_REF !== 'refs/heads/main' ||
      process.env.GITHUB_REPOSITORY !== config.repository) throw new Error('Release must be dispatched from canonical main.');
  const sha = process.env.RELEASE_SHA;
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== sha || execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) throw new Error('Release checkout must be clean at the requested SHA.');
  await verifyReleaseSource({ ...config, sha, api: githubApi(process.env.GITHUB_TOKEN), environment: 'production' });
  return sha;
}

export const config = {
  "repository": "CUNY-AI-Lab/slide-maker",
  "checks": {
    "ci.yml": [
      "Test and build"
    ],
    "release-checks.yml": [
      "Release safeguards"
    ]
  }
};
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyCurrentRelease(config).then(sha => console.log(`Release source verified: ${sha}`)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
