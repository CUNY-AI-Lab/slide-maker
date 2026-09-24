import { join } from 'node:path';

export function applicationDefinitions(root, appEnv, baseEnv, node = process.execPath) {
  return [
    { name: 'slide-maker-api', script: node, args: ['--import', 'tsx', 'src/index.ts'], cwd: join(root, 'apps/api'), interpreter: 'none', env: appEnv, exec_mode: 'fork', instances: 1 },
    { name: 'slide-maker-web', script: node, args: [join(root, 'apps/web/node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], cwd: join(root, 'apps/web'), interpreter: 'none', env: { ...baseEnv, NODE_ENV: 'production', RELEASE_SHA: appEnv.RELEASE_SHA }, exec_mode: 'fork', instances: 1 },
  ];
}
export function replaceProcesses(command, list, file) {
  for (const name of ['slide-maker-api', 'slide-maker-web']) {
    if (list().some(item => item.name === name)) command('pm2', ['delete', name]);
  }
  command('pm2', ['start', file]);
}
