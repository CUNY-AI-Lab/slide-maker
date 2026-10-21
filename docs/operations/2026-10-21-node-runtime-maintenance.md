# October 21 Node runtime maintenance

The [October 21, 2026 Node.js security releases](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
fixed the high-severity Brotli decoder remote-code-execution flaw and other
affected runtime behavior. This maintenance updated the NML applications in
place without changing application source, user records, application data,
package-manager versions or the shared system Node installation.

## Completed application runtime work

The October 21 maintenance receipt records these active application runtimes:

- `slide-maker-api`: private Node 22.23.4 runtime.
- `slide-maker-web`: Node 24.22.1 runtime.
- `site-studio`: Node 24.22.1 runtime.
- `agent-studio`: Node 24.22.1 runtime.
- `hm-review`: unchanged Python application included in the shared PM2 process
  inventory.

The four Node applications were restarted against those runtimes, their existing
application probes passed, and the five-app PM2 inventory was saved. Their
source, application settings, non-runtime environment, data and package-manager
versions were preserved.

## Remaining boot-persistence step

Status at the October 21 handoff cutoff: administrator action pending.

The root-owned `pm2-smorello.adm@gc.cuny.edu.service` still starts the shared PM2
daemon with Node 24.19.0 after a reboot. The application service account cannot
change its systemd definition. An administrator must install the reviewed
drop-in with the helper already staged on the host:

```sh
helper=/data/home-moved/smorello.adm/runtime-maintenance/20261021T155347Z-node-security-update/install-pm2-node24-systemd-dropin.sh
test "$(sha256sum "$helper" | awk '{print $1}')" = d4417b741c0e6128c8be463dd23d53726ea2062b19a65013ce9a1372fef70a4f
sudo "$helper" install
sudo "$helper" verify
```

The reviewed repository copy is
[`scripts/install-pm2-node24-systemd-dropin.sh`](../../scripts/install-pm2-node24-systemd-dropin.sh)
with the same SHA-256. The helper refuses an existing drop-in, verifies the
installed Node 24.22.1 binary and active unit, records the prior daemon executable
and version in a root-only file, prepends the side-by-side runtime to the unit's
`PATH`, and restarts that unit once. It succeeds only if the PM2 daemon uses the
exact Node 24.22.1 executable and all five expected PM2 apps are online.

This step does not install Node, alter `/usr/bin/node`, deploy source, rewrite a
PM2 application definition, change package-manager versions, or touch user or
application data. Running the PR or merging it does not execute the helper.

If installation fails after the drop-in is written, restore the captured daemon
runtime with:

```sh
sudo "$helper" rollback
```

Rollback removes only this helper's drop-in, reloads and restarts the systemd
unit once, then requires the captured prior executable and version and the same
five online PM2 apps. Do not use rollback to undo the already completed
per-application runtime updates.
