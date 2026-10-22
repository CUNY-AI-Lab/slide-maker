#!/bin/sh
set -eu

unit='pm2-smorello.adm@gc.cuny.edu.service'
dropin_dir="/etc/systemd/system/${unit}.d"
dropin="$dropin_dir/10-node-runtime.conf"
prior_state="$dropin_dir/10-node-runtime.prior"
target_bin='/data/home-moved/smorello.adm/node-runtimes/node-v24.22.1-linux-x64/bin'
target_node="$target_bin/node"
pm2_home='/home/smorello.adm/.pm2'
pm2_cli='/usr/lib/node_modules/pm2/bin/pm2'
service_user='smorello.adm@gc.cuny.edu'

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo 'Run this script through sudo.' >&2
    exit 1
  fi
}

verify_common() {
  expected_exe=$1
  expected_version=$2
  systemctl is-active --quiet "$unit"
  main_pid=$(systemctl show "$unit" -p MainPID --value)
  test -n "$main_pid"
  test "$main_pid" -gt 1
  main_exe=$(readlink -f "/proc/$main_pid/exe")
  main_version=$($main_exe --version)
  test "$main_exe" = "$expected_exe"
  test "$main_version" = "$expected_version"
  printf 'pm2_unit=active main_pid=%s executable=%s version=%s\n' \
    "$main_pid" "$main_exe" "$main_version"
  runuser -u "$service_user" -- env PM2_HOME="$pm2_home" \
    "$target_node" "$pm2_cli" jlist |
    python3 -c 'import json,sys
items=json.load(sys.stdin)
expected={"agent-studio","hm-review","site-studio","slide-maker-api","slide-maker-web"}
actual={p.get("name") for p in items}
assert actual == expected, "unexpected PM2 app set"
for p in items:
 e=p.get("pm2_env") or {}
 assert e.get("status") == "online", "{} is not online".format(p.get("name"))
 assert isinstance(p.get("pid"),int) and p["pid"] > 1, "{} has no live pid".format(p.get("name"))
 print("name={} status={} pid={}".format(p.get("name"),e.get("status"),p.get("pid")))'
}

verify_target() {
  verify_common "$target_node" 'v24.22.1'
}

install_dropin() {
  test -x "$target_node"
  test "$($target_node --version)" = 'v24.22.1'
  test -x "$pm2_cli"
  if [ -e "$dropin" ]; then
    echo "Refusing to overwrite existing drop-in: $dropin" >&2
    exit 1
  fi

  systemctl is-active --quiet "$unit"
  prior_pid=$(systemctl show "$unit" -p MainPID --value)
  test "$prior_pid" -gt 1
  prior_exe=$(readlink -f "/proc/$prior_pid/exe")
  prior_version=$($prior_exe --version)

  current_path=$(systemctl show "$unit" -p Environment --value |
    python3 -c 'import shlex,sys
parts=shlex.split(sys.stdin.read())
print(next((x[5:] for x in parts if x.startswith("PATH=")), ""))')
  test -n "$current_path"
  case "$current_path" in
    *'"'*|*"'"*|*"
"*) echo 'Existing systemd PATH contains unsupported quoting.' >&2; exit 1 ;;
  esac
  new_path=$(python3 - "$current_path" "$target_bin" <<'PY'
import sys
path,target=sys.argv[1:]
print(target+":"+":".join(part for part in path.split(":") if part != target))
PY
  )

  mkdir -p "$dropin_dir"
  state_temp=$(mktemp "$dropin_dir/.10-node-runtime.prior.XXXXXX")
  printf '%s\n%s\n' "$prior_exe" "$prior_version" > "$state_temp"
  chmod 0600 "$state_temp"
  chown root:root "$state_temp"
  mv "$state_temp" "$prior_state"
  temp=$(mktemp "$dropin_dir/.10-node-runtime.conf.XXXXXX")
  trap 'rm -f "$temp"' EXIT HUP INT TERM
  printf '[Service]\nEnvironment="PATH=%s"\n' "$new_path" > "$temp"
  chmod 0644 "$temp"
  chown root:root "$temp"
  mv "$temp" "$dropin"
  trap - EXIT HUP INT TERM
  systemctl daemon-reload
  systemctl restart "$unit"
  verify_target
}

rollback_dropin() {
  test -f "$prior_state"
  prior_exe=$(sed -n '1p' "$prior_state")
  prior_version=$(sed -n '2p' "$prior_state")
  test -n "$prior_exe"
  test -n "$prior_version"
  if [ ! -e "$dropin" ]; then
    echo "Drop-in is already absent: $dropin"
  else
    rm -f "$dropin"
  fi
  systemctl daemon-reload
  systemctl restart "$unit"
  verify_common "$prior_exe" "$prior_version"
  rm -f "$prior_state"
  rmdir "$dropin_dir" 2>/dev/null || true
}

require_root
case "${1:-}" in
  install) install_dropin ;;
  verify) verify_target ;;
  rollback) rollback_dropin ;;
  *) echo "Usage: $0 {install|verify|rollback}" >&2; exit 2 ;;
esac
