# Runbook: putting self-hosted live on the droplet

Exact sequence. Each step says what it does and how to tell it worked.

Droplet is `138.68.126.199`, app lives at `/srv/evotv`, repo checkout at
`/srv/evotv/api`.

---

## 0. Before anything

```bash
ssh evotv 'cd /srv/evotv && docker compose ps && git -C api rev-parse --short HEAD'
```

Note the SHA. That is what you roll back to if the day goes badly.

---

## 1. Push the branch

From the laptop:

```bash
cd backend
git push origin feat/digitalocean
```

Nothing deploys yet. `deploy.sh` has to be run, or `autodeploy.sh` installed
first, and neither has happened.

---

## 2. Set the new environment values

On the droplet, edit `/srv/evotv/.env` and add:

```
LIVE_INGEST=rtmp
RTMP_INGEST_URL=rtmp://138.68.126.199:1935/live
RTMP_HLS_BASE_URL=https://api.evotv.co/hls
DEFAULT_CHANNEL_ID=
```

`DEFAULT_CHANNEL_ID` can stay empty: it falls back to the oldest channel, which
is what a single-channel deployment wants. Set it only if you want new streams
attached to a specific one.

`CRON_SECRET` should already be there. If it is not, generate one, because the
reconcile job needs it:

```bash
openssl rand -hex 32
```

**No Cloudflare values.** With `LIVE_INGEST=rtmp` they are not read, and adding
a token later cannot silently move new streams onto Cloudflare.

---

## 3. Deploy once, by hand

Do the first one manually so you see the output.

```bash
ssh evotv '/srv/evotv/deploy.sh feat/digitalocean'
```

This pulls, syncs the deploy files to `$ROOT`, builds the image, **runs the
migrations** (0032 game_id nullable, 0033 cf_live_input), then restarts the two
api containers one at a time, waiting for each to report healthy.

Watch for:

```
==> running migrations
==> restarting api-1
    api-1 healthy
==> restarting api-2
    api-2 healthy
==> checking loopback
==> deployed <sha>
```

If a container never reports healthy the script stops and the other one is
still serving the old build. Read `docker compose logs api-1` and fix forward.

Confirm the schema landed:

```bash
ssh evotv 'cd /srv/evotv && docker compose exec -T api-1 node -e "
  const p=require(\"postgres\");const s=p(process.env.DATABASE_URL,{max:1});
  s\`select column_name,is_nullable from information_schema.columns
     where table_name=(\$\$streams\$\$) and column_name in (\$\$game_id\$\$,\$\$cf_live_input_uid\$\$,\$\$ingest_kind\$\$)\`
   .then(r=>{console.log(r);return s.end()})"'
```

`game_id` should be `YES` for nullable, and `ingest_kind` should exist.

---

## 4. Import the EPG

Production has no `epg_slots` rows, so `/schedule` shows only dated entries
until this runs.

```bash
ssh evotv 'cd /srv/evotv && docker compose run --rm --no-deps api-1 pnpm tsx scripts/import-epg.ts'
```

Then check:

```bash
curl -s https://api.evotv.co/api/schedule | head -c 300
```

---

## 5. Open port 1935

No fixed broadcast IP, so this is open to everything. See the note at the
bottom about what that costs.

Control panel: **Networking, Firewalls**, the droplet's firewall, **Inbound
Rules**, **New rule**: Custom, TCP, port `1935`, Sources **All IPv4** and
**All IPv6**. Save.

Or:

```bash
doctl compute firewall list
doctl compute firewall add-rules <FIREWALL_ID> \
  --inbound-rules "protocol:tcp,ports:1935,address:0.0.0.0/0,address:::/0"
```

---

## 6. Start the RTMP container

```bash
ssh evotv 'cd /srv/evotv && docker compose --profile rtmp up -d nginx-rtmp'
ssh evotv 'cd /srv/evotv && docker compose ps nginx-rtmp'
```

From the laptop, confirm the port answers:

```bash
nc -vz 138.68.126.199 1935
```

---

## 7. Schedule the cron jobs

`crontab -e` on the droplet:

```cron
0    2 * * *   /srv/evotv/cron.sh analytics
0    3 * * 0   /srv/evotv/cron.sh payouts
0    4 * * 0   /srv/evotv/cron.sh gdpr-purge
0    5 * * *   /srv/evotv/cron.sh fantasy-score
*/2  * * * *   /srv/evotv/cron.sh reconcile-live
*/15 * * * *   /srv/evotv/cron.sh reminders
```

**Remove any `viewer-count` line.** That endpoint is gone; viewer counts are
derived at read time now, and a stale entry 404s every five minutes.

`reconcile-live` is what ends a broadcast when the encoder vanished without
nginx's callback arriving.

---

## 8. Turn on auto-deploy

Only after a manual deploy has worked once.

```cron
*/2 * * * * DEPLOY_BRANCH=feat/digitalocean /srv/evotv/autodeploy.sh
```

From then on, `git push` is the deploy. It polls the branch, and when the SHA
moves it runs the same `deploy.sh` you just ran by hand, migrations included.

Watch it:

```bash
ssh evotv 'journalctl -t evotv-autodeploy -f'
```

Switch the branch it tracks by editing `DEPLOY_BRANCH` in the crontab. When
`feat/digitalocean` merges to `main`, change it to `main` on the same line.

---

## 9. Go live

1. `https://app.evotv.co/admin/streams`, create a stream.
2. Copy **Server** and **Stream Key** from the dialog into OBS.
3. Output: 1280x720, 30fps, CBR 2500 kbps, **keyframe interval 2**.
4. Start Streaming.
5. Open `https://evotv.co` as a signed-out visitor. It should be on the home
   hero, on `/channel`, and in `/schedule` as a dated row.

---

## What "open to everything on 1935" actually costs

Anyone can reach the ingest port. They still cannot publish without a stream
key, which is 32 hex characters, so guessing is not the threat.

The real exposure is that **RTMP is plaintext**: the key crosses the network in
the clear on every broadcast. Someone positioned on the path, a hostile public
wifi being the realistic case, can read it and then publish as you. What they
would get is their content appearing on your channel.

Given no fixed IP, the mitigations are operational rather than architectural:

- **Do not broadcast over public wifi.** This is the whole attack.
- **Regenerate the key after any broadcast from a network you do not control.**
  Admin, Streams, the stream, Regenerate key. Instant, costs one re-paste.
- **If something you did not send appears on air:** Admin, Streams, force-end,
  regenerate the key, start again. The attacker's encoder is rejected the
  moment the old key stops authenticating.
- **Watch for it.** A stream going live that nobody on the team started is the
  signal. `reconcile-live` will not catch this, because from the server's point
  of view someone published with a valid key.

Path B removes the whole category: the encoder pushes to Cloudflare over RTMPS,
which is encrypted, and no port on the droplet opens at all. Worth revisiting
if you ever broadcast from venues.

---

## Rolling back

```bash
ssh evotv 'cd /srv/evotv/api && git reset --hard <OLD_SHA> && cd /srv/evotv && ./deploy.sh'
```

Comment out the autodeploy crontab line first, or it will pull the branch
forward again within two minutes.

**Migrations do not roll back.** 0032 and 0033 are both additive, a widened
column and two new ones, so an older build runs against the newer schema
without noticing. That is why they were written that way.
