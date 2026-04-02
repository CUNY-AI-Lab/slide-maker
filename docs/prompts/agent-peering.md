# Agent Peering: Make Agents On Two Machines Talk

This guide explains how to let agents running on your machine communicate with agents on a colleague’s machine. It presents two connection options and a minimal HTTP “Agent Bus” you can add to exchange events safely.

Use this to coordinate actions such as relaying debug events, broadcasting chat mutations, or building higher‑level multi‑agent workflows across machines.

## Overview

- Two APIs (yours and your colleague’s) exchange JSON events over HTTPS.
- Each API exposes a tiny Agent Bus:
  - `POST /api/agent-bus/publish` — accepts events from a trusted peer.
  - `GET /api/agent-bus/stream` — local SSE for apps/tools to subscribe.
- Authentication: a shared peer token in `.env` (simple bearer scheme).
- Transport options:
  - A) Tunnels (ngrok / Cloudflare Tunnel) — quickest to try.
  - B) Private network (Tailscale) — recommended for stability/security.

You can implement only the endpoints you need (e.g., publish only) and evolve later.

---

## 1) Pick Connectivity Option

### Option A — Tunnels (ngrok or Cloudflare Tunnel)

- Pros: zero install on routers, works from any network.
- Cons: depends on a tunnel service; URL changes unless you reserve static URLs.

Steps (both machines):
1) Run the API: `pnpm dev` (API on `:3001`).
2) Start a tunnel to `localhost:3001` (choose one):
   - ngrok: `ngrok http 3001`
   - Cloudflare Tunnel: `cloudflared tunnel --url http://localhost:3001`
3) Share your tunnel URL with the peer, e.g., `https://abc123.ngrok.io`.

### Option B — Private Network (Tailscale)

- Pros: stable IP/hostname, private, low latency.
- Cons: requires installing Tailscale.

Steps (both machines):
1) Install Tailscale and join the same tailnet.
2) Find the peer’s IP or MagicDNS name (e.g., `http://peername.tailnet:3001`).

---

## 2) Configure Environment

Add these to `.env` on each machine (use your peer’s URL and a shared secret):

```
# Peer discovery / auth
AGENT_PEER_URL=https://<peer-public-or-tailscale-url>
AGENT_PEER_TOKEN=<a-long-random-shared-secret>

# Optional: multiple peers (comma‑separated entries of url|token)
# AGENT_PEERS=https://u1|tok1,https://u2|tok2
```

Notes
- Use distinct tokens per peer if you plan to expand to multi‑peer.
- Do not commit real tokens; share secrets out‑of‑band.

---

## 3) Minimal Agent Bus (HTTP)

Add two Hono routes to the API (sketch below). This keeps the surface small and safe while flexible enough to grow.

Contract
- Event payload:

```
{
  source: string,              // freeform agent ID or hostname
  type: string,                // e.g., "ping", "mutation", "debug.summary"
  payload: object,             // any JSON payload
  ts?: number                  // optional timestamp (ms)
}
```

- Security: `Authorization: Bearer <AGENT_PEER_TOKEN>` on publish.
- Behavior: publish validates, optionally persists, and fans out to local SSE.

Suggested endpoints
- `POST /api/agent-bus/publish` — accept a single event or an array of events.
- `GET /api/agent-bus/stream` — server‑sent events for local subscribers.

Implementation outline (TypeScript/Hono)

```ts
// apps/api/src/routes/agent-bus.ts (example)
import { Hono } from 'hono'

const bus = new Hono()
const peers = (process.env.AGENT_PEERS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
  .map(s => ({ url: s.split('|')[0], token: s.split('|')[1] }))
const peerUrl = process.env.AGENT_PEER_URL
const peerToken = process.env.AGENT_PEER_TOKEN

const streams = new Set<(data: any) => void>()

bus.post('/agent-bus/publish', async (c) => {
  const auth = c.req.header('authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
  const valid = [peerToken, ...peers.map(p => p.token)].filter(Boolean)
  if (!valid.includes(token)) return c.text('Unauthorized', 401)

  let events: any[]
  try {
    const body = await c.req.json()
    events = Array.isArray(body) ? body : [body]
  } catch {
    return c.text('Invalid JSON', 400)
  }

  // Fan‑out to local subscribers
  for (const ev of events) {
    for (const push of streams) push(ev)
  }

  return c.json({ ok: true, count: events.length })
})

bus.get('/agent-bus/stream', (c) => {
  return c.stream(async (stream) => {
    const push = (data: any) => stream.writeSSE({ event: 'event', data: JSON.stringify(data) })
    streams.add(push)
    // heartbeat
    const timer = setInterval(() => stream.writeSSE({ event: 'ping', data: Date.now().toString() }), 25000)
    await stream.onAbort
    clearInterval(timer)
    streams.delete(push)
  })
})

export default bus
```

Wire‑up: import and mount in the API server (e.g., `apps/api/src/server.ts`):

```ts
import agentBus from './routes/agent-bus'
app.route('/api', agentBus)
```

Keep it behind environment flags if desired.

---

## 4) Send & Receive Tests

After both APIs are reachable:

- Start local SSE listener (Machine B):

```
curl -N http://localhost:3001/api/agent-bus/stream
```

- From Machine A, publish to B using its public URL and shared token:

```
curl -X POST "$PEER/api/agent-bus/publish" \
  -H "Authorization: Bearer $AGENT_PEER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "source":"machine-a",
        "type":"ping",
        "payload":{"msg":"hello from A"}
      }'
```

You should see the event appear in B’s SSE stream.

---

## 5) Integrations (Examples)

- Relay Debug Summaries: subscribe to `/api/debug/stream`, summarize, publish to peer.
- Cross‑deck Mutations: send `{ type: "mutation", payload: { deckId, ... } }` to synchronize changes across collaborators.
- Multi‑Peer Fan‑Out: maintain a small peer list via `AGENT_PEERS` and forward selectively.

---

## 6) Security Notes

- Use long random tokens; rotate periodically.
- Prefer Tailscale for private, encrypted connectivity.
- If using tunnels, disable indexing and avoid exposing admin routes publicly.
- Rate‑limit `publish` or scope by IP if needed.
- Log and audit incoming event types; validate payload schemas for any actioned types.

---

## 7) Quick Checklist

- [ ] Choose connectivity: Tunnel or Tailscale
- [ ] Share a secret token
- [ ] Set `.env`: `AGENT_PEER_URL`, `AGENT_PEER_TOKEN` (and/or `AGENT_PEERS`)
- [ ] Add Agent Bus routes and mount them
- [ ] Test with curl (publish/stream)
- [ ] Integrate specific agent events (debug, mutations, etc.)

---

## Appendix: No‑Code Trial (Manual Publish)

If you don’t want to add routes yet, you can emulate a one‑way signal using existing endpoints and a shared webhook service (e.g., RequestBin) or by sending messages through a shared channel (Slack/webhooks). However, for reliable agent‑to‑agent exchanges, adding the minimal Agent Bus above is recommended.

