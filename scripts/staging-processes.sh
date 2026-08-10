#!/usr/bin/env bash
set -euo pipefail

# Recreate both processes so PM2 cannot retain stale listener arguments from an
# earlier deployment.
APP_DIR="${SLIDE_MAKER_DIR:-/data/slide-maker}"
API_NAME="slide-maker-api"
WEB_NAME="slide-maker-web"
API_HOST="127.0.0.1"
API_PORT="3004"
WEB_PORT="4173"
VITE_ENTRY="$APP_DIR/apps/web/node_modules/vite/bin/vite.js"

command -v pm2 >/dev/null 2>&1 || {
  echo "pm2 is required" >&2
  exit 1
}

if [[ ! -f "$VITE_ENTRY" ]]; then
  echo "Vite entry is missing: $VITE_ENTRY" >&2
  exit 1
fi

pm2 delete "$API_NAME" >/dev/null 2>&1 || true
pm2 delete "$WEB_NAME" >/dev/null 2>&1 || true

NODE_ENV=production API_HOST="$API_HOST" API_PORT="$API_PORT" \
  pm2 start "pnpm --filter @slide-maker/api dev" \
  --name "$API_NAME" --cwd "$APP_DIR"

NODE_ENV=production pm2 start /usr/bin/node \
  --name "$WEB_NAME" --cwd "$APP_DIR/apps/web" -- \
  "$VITE_ENTRY" preview --host "$API_HOST" --port "$WEB_PORT"

pm2 jlist | node -e '
const [apiName, webName, apiHost, apiPort, webPort] = process.argv.slice(1)
const processes = JSON.parse(require("node:fs").readFileSync(0, "utf8"))
const byName = new Map(processes.map((process) => [process.name, process]))
const api = byName.get(apiName)
const web = byName.get(webName)
const apiEnv = api?.pm2_env?.env ?? {}
const webArgs = [web?.pm2_env?.pm_exec_path, ...(web?.pm2_env?.args ?? [])].join(" ")

if (
  api?.pm2_env?.status !== "online" ||
  apiEnv.NODE_ENV !== "production" ||
  apiEnv.API_HOST !== apiHost ||
  apiEnv.API_PORT !== apiPort ||
  web?.pm2_env?.status !== "online" ||
  !webArgs.includes(`--host ${apiHost}`) ||
  !webArgs.includes(`--port ${webPort}`)
) {
  console.error("Slide Maker process contract verification failed")
  process.exit(1)
}
' "$API_NAME" "$WEB_NAME" "$API_HOST" "$API_PORT" "$WEB_PORT"

pm2 save
