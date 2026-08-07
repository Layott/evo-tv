# deploy/

Everything needed to run EVO TV on a single DigitalOcean droplet.

Full context and reasoning: `../../EVOTV-app/docs/DIGITALOCEAN_MIGRATION.md`.

| File | Goes to | Purpose |
|---|---|---|
| `docker-compose.yml` | `/srv/evotv/docker-compose.yml` | two services: `api` + `caddy` |
| `Caddyfile` | `/srv/evotv/Caddyfile` | TLS, static sites, reverse proxy, SSE handling |
| `cron.sh` | `/srv/evotv/cron.sh` | replaces Vercel Cron, 6 jobs |
| `deploy.sh` | `/srv/evotv/deploy.sh` | pull, build, migrate, restart, health check |
| `../Dockerfile` | stays in repo | built by compose |

## First-time server setup

Droplet: `s-2vcpu-4gb-amd`, Ubuntu 24.04, FRA1 or LON1, SSH key at create time, Monitoring + IPv6 + weekly backups on. Attach a Reserved IP and point DNS at that.

```bash
# --- base ---
apt update && apt -y full-upgrade
timedatectl set-timezone Africa/Lagos
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
curl -fsSL https://get.docker.com | sh
apt -y install unattended-upgrades

# --- ssh: keys only ---
cat >/etc/ssh/sshd_config.d/99-evotv.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
MaxAuthTries 3
EOF
sshd -t && systemctl restart ssh

# --- layout ---
mkdir -p /srv/evotv && cd /srv/evotv
git clone https://github.com/<you>/EVOTV.git api
mkdir -p web app
cp api/deploy/docker-compose.yml api/deploy/Caddyfile api/deploy/cron.sh api/deploy/deploy.sh .
chmod +x cron.sh deploy.sh
```

Then a **DO Cloud Firewall**: inbound TCP 22, 80, 443 only. That is the firewall; no `ufw` on top.

## Environment

On your laptop, in the backend repo:

```bash
vercel env pull .env.production
scp .env.production evotv:/srv/evotv/.env
ssh evotv 'chmod 600 /srv/evotv/.env'
```

Then edit two values on the box:

```ini
BETTER_AUTH_URL=https://api.evotv.tv
ALLOWED_ORIGINS=https://app.evotv.tv,https://evotv.tv,https://www.evotv.tv
```

Leave `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `AUTH_SECRET`, and especially `PLAYOUT_SECRET` exactly as they are. Changing `PLAYOUT_SECRET` breaks the office media agent and the schedule page file browser.

Do not shell-source `.env`. Values like `SMTP_FROM=EVO TV <noreply@evotv.tv>` are unquoted, which Docker reads literally but bash parses as a redirect. `cron.sh` extracts the one value it needs with `sed` for this reason.

## Start

DNS must resolve to the droplet **before** this, or Caddy's certificate issuance fails and backs off.

```bash
cd /srv/evotv
docker compose up -d --build
docker compose logs -f
```

## Static sites

Built on the laptop, copied up:

```powershell
pnpm --dir "...\EVOTV-WEBSITE" build
scp -r "...\EVOTV-WEBSITE\dist\*" evotv:/srv/evotv/web/

pnpm --dir "...\EVOTV-app" expo export --platform web
scp -r "...\EVOTV-app\dist\*" evotv:/srv/evotv/app/
```

## Crons

```bash
crontab -e
```

```cron
0    2 * * *   /srv/evotv/cron.sh analytics
0    3 * * 0   /srv/evotv/cron.sh payouts
0    4 * * 0   /srv/evotv/cron.sh gdpr-purge
0    5 * * *   /srv/evotv/cron.sh fantasy-score
*/5  * * * *   /srv/evotv/cron.sh viewer-count
*/15 * * * *   /srv/evotv/cron.sh reminders
```

Box time is Africa/Lagos. Vercel Cron ran UTC, so these fire an hour earlier in absolute terms.

## Day to day

```bash
ssh evotv /srv/evotv/deploy.sh        # deploy main
docker compose logs -f api            # tail app
docker compose ps                     # status
docker compose restart api            # bounce
```

## Rules

- **One `api` container. Ever.** `lib/sse/bus.ts` is an in-process EventEmitter feeding `/api/sse/*`. A second container cannot see the first's events, which silently breaks live chat, notifications, and watch parties. Fix the bus (Redis pub/sub) before scaling.
- **`api` stays DNS-only on Cloudflare** (grey cloud). The free tier drops idle proxied connections at ~100s, which would kill every SSE stream on a loop.
- **Never delete the `caddy_data` volume.** It holds the certificates.
- Database and uploads live off-box (Neon, Vercel Blob). The droplet holds no data, so `.env` is the only thing on it worth backing up.
