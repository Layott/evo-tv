# Phase 1 exit test — 2026-04-22

End-to-end backend flow verified via curl on a localhost-only stack. Typecheck clean project-wide.

## Environment at test time

- Node 25.8.1, pnpm 10.33.1.
- Next.js 16 dev server on `http://localhost:3000`.
- SQLite `./data/evo.db` with Phases 0 + 2 + ( likes migration `0002_many_harry_osborn.sql`) applied and seeded.
- Docker, FFmpeg, OBS: **NOT required for this simulated run.** Worker gracefully produces a stub VOD when FFmpeg/source HLS are absent. For a real OBS round-trip, see the "Fully manual OBS run" section below.
- `PAYMENT_PROVIDER=mock` (offline-safe). For Paystack test mode, see Paystack section below.

## Simulated exit flow (all via curl, all green)

### 1. Admin creates a stream (one-time key reveal)

- Signup a user → promote via `pnpm tsx scripts/promote-admin.ts <email>`.
- `POST /api/auth/sign-in/email` → session cookie.
- `POST /api/admin/streams` with body `{title, description, gameId, streamerName, language, tags, isPremium}` → 200 + `{id, streamKey: "sk_live_<32 hex>", ingestUrl: "rtmp://localhost:1935/live", warning}`.
- Plaintext key is returned **once**. DB stores only `streamKeyHash` (HMAC-SHA256).

### 2. RTMP on-publish (simulated nginx callback)

`POST /api/rtmp/on-publish` with body `name=<streamKey>&app=live&addr=127.0.0.1` → `200 OK`.
Side effects verified via direct DB read:
- `streams.isLive = true`
- `streams.startedAt` set to `now`
- `streams.hlsPath` = `/hls/<streamKey>.m3u8`
- Bus emissions: `stream:<id>:status` + `stream:live-now`

### 3. On-publish-done + worker fires

`POST /api/rtmp/on-publish-done` with same body → `200 OK`.
- `streams.isLive = false`, `streams.endedAt` set.
- Bus emission `stream:enqueue-transcode` → transcode worker picks up.
- Worker probes `ffmpeg -version`. In this run FFmpeg was absent on PATH → worker writes a **stub VOD row** with `durationSec=0`, `hlsPath=""`, `title="<stream title> — VOD"`, `publishedAt=now`. This is the intended graceful fallback from Phase 1F.

Verified via `scripts/exit-test-verify.ts`:
```
vod_26cb4439fa56d3e1  stream=stream_e6f7a1b1956c74c8  title=Exit Test Tournament 2 — VOD  pub=2026-04-22T22:02:03.301Z
```

### 4. Viewer signs up + subscribes (MockProvider)

- Fresh signup → 200 + session.
- `POST /api/payments/init {plan:"premium"}` → MockProvider returns `redirectUrl` pointing at `/api/payments/verify/<ref>?mock=1`.
- `GET <redirectUrl>` → 307 → `/settings/billing?payment=success`.
- `GET /api/subscriptions/me` → `{subscription: {tier:"premium", status:"active", provider:"mock", priceNgn:4500, currentPeriodEnd: "…+30d"}}`.
- Side effects: `user.role = "premium"`, `notifications` row created (`type: "subscription"`).

## Fixes required mid-test (kept)

1. **Worker registration via instrumentation.ts was not firing under Turbopack dev.** Added module-level self-registration inside `workers/transcode.ts` (idempotent via the `registered` flag) plus a `import "@/workers/transcode"` side-effect in `app/api/rtmp/on-publish-done/route.ts` — guarantees the bus subscription exists before the emit.
2. **MockProvider state map was lost across HMR reloads + route-bundle isolation.** Persisted to `globalThis.__evo_mock_payment_state` in `lib/payments/mock.ts`. Now survives module reloads; `init` and `verify` always agree on the ref.

## Fully manual OBS run (when real video is wanted)

1. Install FFmpeg (`winget install Gyan.FFmpeg`) → confirm with `ffmpeg -version`.
2. `cd infra && docker compose up -d` — starts nginx-rtmp on `rtmp://localhost:1935/live` and mailhog on `http://localhost:8025`.
3. Run the admin stream-create flow above to capture a `sk_live_…` key.
4. In OBS: Server `rtmp://localhost:1935/live`, Stream Key `sk_live_…`. Start streaming.
5. nginx-rtmp POSTs to `http://host.docker.internal:3000/api/rtmp/on-publish` — route validates hash, flips `isLive`.
6. Playback: `http://localhost:3000/api/uploads/hls/<streamKey>.m3u8` (nginx-rtmp writes segments into the mounted `./uploads/hls/` directory).
7. Stop OBS → `on-publish-done` fires → worker runs FFmpeg 3-rung ladder (1080p/720p/360p) → writes `./uploads/vods/<vodId>/master.m3u8` → inserts a real VOD row with a computed duration.

## Paystack test mode (optional, non-local)

1. Set `PAYMENT_PROVIDER=paystack` + `PAYSTACK_PUBLIC_KEY=pk_test_…` + `PAYSTACK_SECRET_KEY=sk_test_…` in `.env.local`.
2. Tunnel the dev port publicly: `ngrok http 3000`.
3. Paystack dashboard → webhooks → `https://<ngrok>.ngrok.io/api/payments/paystack/webhook`.
4. `/api/payments/init` now returns the real `https://checkout.paystack.com/<accessCode>` URL. After card entry, Paystack POSTs back to the webhook (HMAC-SHA512 verified) → `upsertFromPayment` activates the sub.

## Known limitations in this simulated run

- No real video frames (FFmpeg not installed). Stub VODs only; player UI will show the "Demo video unavailable" fallback until a real `.m3u8`/`.mp4` exists.
- Stream page UI still pulls from `@/lib/mock` — so the freshly-created stream won't appear there until a later UI swap. Data exists in SQLite and is accessible at `GET /api/streams/<id>`.
- Web push end-to-end not verified — requires VAPID key generation + a real browser ServiceWorker registration. API returns 503 for `/api/push/vapid-public-key` until `VAPID_*` env are set.

## Phase 1 exit criteria — status

✅ Admin creates event + issues stream key (one-time reveal, hashed at rest).
✅ RTMP ingest callback validates key + flips live state.
✅ Viewer signs up + subscribes (Premium, MockProvider = offline; Paystack test also wired).
✅ Stream ends → VOD row created.
⚠️ "Watches live <5s latency" unverified without real OBS push. Pipeline wiring is in place.
⚠️ Real multi-bitrate HLS transcode unverified without FFmpeg. Worker is wired and idempotent; install FFmpeg + run the OBS flow above for a full run.
