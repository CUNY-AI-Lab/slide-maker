import { isAbsolute, resolve, sep } from 'node:path';

export const paths = Object.freeze({
  releases: '/data/slide-maker-releases',
  backups: '/data/slide-maker-backups',
  rehearsals: '/data/slide-maker-rehearsals',
  environment: '/data/slide-maker-config/production.env',
});
export function releaseIdentity(sha, run, attempt) {
  if (!/^[a-f0-9]{40}$/.test(sha || '') || !/^[1-9][0-9]*$/.test(run || '') || !/^[1-9][0-9]*$/.test(attempt || '')) {
    throw new Error('An immutable SHA and GitHub run identity are required.');
  }
  return `${sha}-${run}-${attempt}`;
}
export function isWithin(root, path) { return path === root || path.startsWith(`${root}${sep}`); }
export function validateConfiguration(env) {
  for (const key of ['SESSION_SECRET', 'READINESS_TOKEN', 'CAIL_IDENTITY_JWKS']) {
    if (typeof env[key] !== 'string' || !env[key].trim()) throw new Error(`Production configuration is missing ${key}.`);
  }
  if (env.CAIL_IDENTITY_ISSUER !== 'https://tools.ailab.gc.cuny.edu/cail-sso' ||
      env.CAIL_GATEWAY_URL !== 'https://tools.ailab.gc.cuny.edu' ||
      env.PUBLIC_URL !== 'https://tools.ailab.gc.cuny.edu/slide-maker') throw new Error('Production identity, Gateway or public URL is not canonical.');
  for (const key of ['NODE_OPTIONS', 'NODE_PATH', 'NODE_AUTH_TOKEN', 'GITHUB_TOKEN', 'NPM_CONFIG_USERCONFIG', 'PM2_HOME']) {
    if (env[key]) throw new Error(`Remove deployment-only or runtime-override setting ${key} from the application environment.`);
  }
  const database = env.DATABASE_URL?.startsWith('file:') ? env.DATABASE_URL.slice(5) : '';
  const uploads = env.SLIDE_UPLOADS_PATH;
  for (const value of [database, uploads]) {
    if (!value || !isAbsolute(value) || resolve(value) !== value || value === '/' || /[\r\n\0]/.test(value)) throw new Error('Existing database and uploads must have explicit absolute paths.');
    if ([paths.releases, paths.backups, paths.rehearsals].some(root => isWithin(root, value))) throw new Error('Live state must remain outside release, backup and rehearsal directories.');
  }
  if (isWithin(uploads, database)) throw new Error('Database and uploads must be separate.');
  return { database, uploads };
}
export function processDefinitions(list) {
  return ['slide-maker-api', 'slide-maker-web'].map(name => {
    const matches = list.filter(item => item.name === name);
    if (matches.length !== 1 || matches[0].pm2_env?.status !== 'online' || matches[0].pm2_env?.exec_mode !== 'fork_mode') {
      throw new Error('Exactly one online fork process is required for each existing application component.');
    }
    const current = matches[0].pm2_env;
    if (!isAbsolute(current.pm_exec_path || '') || !isAbsolute(current.pm_cwd || '')) throw new Error('Existing process paths are invalid.');
    return { name, script: current.pm_exec_path, cwd: current.pm_cwd,
      interpreter: current.exec_interpreter, args: current.args || [], node_args: current.node_args || [],
      env: current.env || {}, exec_mode: 'fork', instances: 1, autorestart: true };
  });
}
