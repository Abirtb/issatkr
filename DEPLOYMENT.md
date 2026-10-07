# ISSATKr — Production Deployment Guide

This guide takes the repository to a production server. The application stores student personal data, including CINs: follow every step, in order, and complete the security checklist (§17) before opening the service to users.

Placeholders, to replace with real values on the server only: `SERVER_IP`, `YOUR_DOMAIN`, `ADMIN_EMAIL`, `ADMIN_NAME`, `/opt/issatkr` (install path), `BACKUP_MOUNT` (off-server backup location). No value in this guide is a real credential.

## Status

| Item | State |
|---|---|
| Docker image, Compose stack, Nginx template, scripts, env templates | **READY** (in this repository) |
| Production build, migrations from an empty database, first-admin bootstrap, health check, backup and restore | **READY**: verified locally on a fresh database with the production build (the same commands the containers run) |
| Docker image build and container start | **NEEDS SERVER**: Docker was not available on the preparation machine, so the image has not been built yet |
| Server, domain, DNS, TLS certificate, firewall, SMTP, cron, backups | **NEEDS SERVER / DOMAIN / CREDENTIAL**: nothing is configured until you do it on the server |

## Architecture

```
Internet ──HTTPS :443──▶ Nginx (host)            TLS, HTTP→HTTPS redirect, login rate limit,
                           │                     12 MB body limit, blocks /api/cron/* from outside
                           │ http://127.0.0.1:3000   (loopback only, not reachable from outside)
                           ▼
                 ┌─────────────────────┐
                 │ app container        │  Next.js standalone server, user "node" (non-root):
                 │ (issatkr-app)        │  web pages + API in ONE service (no separate backend)
                 └─────────┬───────────┘
                           │ volume "issatkr-data" mounted at /data
                           ▼
           /data/issatkr.db      SQLite database (never exposed, not a network service)
           /data/uploads/        uploaded justificatifs (served only through the API, admin only)
           /data/backups/        local backups (copy them off the server, §13)

 migrate container (issatkr-tools, one-shot, non-root): prisma migrate deploy, first admin, backup/verify
 host crontab: scripts/cron-notifications.sh → POST 127.0.0.1:3000/api/cron/notifications (e-mail retries)
```

Why this design, derived from the repository:

- **Single service.** Pages and API are the same Next.js app (`src/app`, `src/app/api`), all same-origin. There is no separate frontend to configure, no API URL to set, and no CORS to open. The middleware already rejects cross-site writes.
- **SQLite.** The Prisma schema and all 8 migrations are SQLite. One school per instance and one app container suit SQLite: WAL mode is enabled at startup and backups are online and consistent (`VACUUM INTO`). There is no database server to secure or expose. Moving to PostgreSQL would mean new migrations and is a separate decision.
- **Single instance.** Login and search rate limits are kept in memory. Do not run several app replicas without moving the limits to Nginx or Redis first.

## 1. Server prerequisites

- 64-bit Linux server (commands below assume Ubuntu 22.04/24.04 or Debian 12), with SSH access and sudo.
- 2 vCPU, 2 GB RAM (the image build needs about 1.5 GB) and 20 GB disk.
- Packages: Docker Engine 24+ with the Compose v2 plugin, Nginx, certbot, git, curl, ufw.
- Outbound HTTPS **during image builds** to: `registry.npmjs.org`, `cdn.sheetjs.com` (spreadsheet library) and `binaries.prisma.sh` (database engine). This is not needed at runtime, except for SMTP.
- A DNS **A record** `YOUR_DOMAIN → SERVER_IP` (and AAAA if you use IPv6).
- SMTP credentials from the institution (account, host, port).

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git nginx certbot ufw
# Docker Engine + Compose plugin: follow https://docs.docker.com/engine/install/ for your distribution, then:
docker --version && docker compose version
```

## 2. Ports

| Port | Exposed to | Purpose |
|---|---|---|
| 22/tcp | Administrators (restrict by IP if possible) | SSH |
| 80/tcp | Internet | ACME challenge + redirect to HTTPS |
| 443/tcp | Internet | Application (Nginx) |
| 3000/tcp | **127.0.0.1 only** | App container, reached by Nginx and cron on the server. Never open it in the firewall. |

There is no database port: SQLite is a file inside the volume.

## 3. Environment variables

On the server, from the repository directory:

```bash
cp .env.production.example .env.production
chmod 600 .env.production
openssl rand -base64 48   # → AUTH_SECRET
openssl rand -hex 32      # → CRON_SECRET
nano .env.production      # fill in every value; never commit this file
```

| Variable | Required | Value |
|---|---|---|
| `DATABASE_URL` | yes | `file:/data/issatkr.db` (inside the volume). The app **refuses to start** with a development or test database (`dev.db`, `test`, `seed` in the path). |
| `UPLOAD_DIR` | yes | `/data/uploads` |
| `AUTH_SECRET` | yes | 32+ random characters. Placeholders are refused at startup. Changing it signs everyone out. |
| `CRON_SECRET` | recommended | 16+ random characters. Without it, failed e-mails are not retried. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | for e-mails | Institutional SMTP. Without them the app runs, but warning and elimination e-mails are not sent (a startup warning is logged). |
| `ATTENDANCE_TIME_ZONE` | no | Default `Africa/Tunis` (90-minute attendance window) |
| `APP_PORT` | no | Host loopback port (default 3000). Set it in the shell or in a `.env` file next to `compose.yaml` if 3000 is taken. |

Not used in production: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PROF_*`, `CHEF_*` and `DEMO_*` belong to the **development seed**, which refuses to run in production. `SMTP_TRANSPORT=json` is for development only.

At startup the app checks the configuration. Errors stop the server with exit code 1; `docker compose logs app` shows `[config] error: …` naming the variable, never its value.

## 4. Database creation

There is nothing to create by hand. The database file is created on first use by `prisma migrate deploy` (§5), inside the volume. **Never copy `prisma/dev.db` to the server**: it is a development database with test accounts, and the app refuses to start on it.

## 5. Prisma migrations

Migrations run in the one-shot `migrate` container. `scripts/deploy.sh` does this automatically, after a backup.

```bash
docker compose --profile jobs run --rm migrate                       # prisma migrate deploy
docker compose --profile jobs run --rm migrate node scripts/db-verify.mjs   # integrity, migrations, row counts
```

`npm run build` no longer touches any database. Migrating is always this explicit step.

## 6. Build and start (Docker)

First deployment:

The repository is **private** (`https://github.com/Abirtb/issatkr`). Give the server a **read-only deploy key**, not a personal account password or token:

```bash
ssh-keygen -t ed25519 -N "" -C "issatkr-server" -f ~/.ssh/issatkr_deploy
cat ~/.ssh/issatkr_deploy.pub
# GitHub → Abirtb/issatkr → Settings → Deploy keys → Add deploy key:
#   paste the public key, leave "Allow write access" UNCHECKED.
cat >> ~/.ssh/config <<'EOF'
Host github-issatkr
  HostName github.com
  User git
  IdentityFile ~/.ssh/issatkr_deploy
  IdentitiesOnly yes
EOF
ssh -T github-issatkr    # expect: "successfully authenticated … does not provide shell access"
```

```bash
sudo mkdir -p /opt/issatkr && sudo chown "$USER" /opt/issatkr
git clone github-issatkr:Abirtb/issatkr.git /opt/issatkr && cd /opt/issatkr
cp .env.production.example .env.production && chmod 600 .env.production   # then fill it in (§3)
bash scripts/deploy.sh
```

`scripts/deploy.sh` does the following:

1. Checks that `.env.production` exists with mode 600.
2. Tags the running images `:previous` (for rollback).
3. Builds the images.
4. Backs up the database, if one exists.
5. Runs `prisma migrate deploy`.
6. Starts the app and waits for `/health`.

Then create the first administrator. This is done once, on an empty database:

```bash
docker compose --profile jobs run --rm migrate node scripts/create-admin.mjs --email ADMIN_EMAIL --name "ADMIN_NAME"
```

- The password is typed twice and never shown or stored in a file. It needs at least 8 characters and at most 72 bytes.
- The script refuses to run if an active administrator already exists.
- Create every other account from **Utilisateurs** in the app. Users then change their own password from **Mon mot de passe**.

Equivalent manual commands:

```bash
docker compose --profile jobs build
docker compose --profile jobs run --rm migrate
docker compose up -d app
bash scripts/healthcheck.sh --wait
```

Images and containers:

- `issatkr-app`: runtime, user `node`, port 3000 bound to 127.0.0.1.
- `issatkr-tools`: migrations and backups, user `node`, run on demand only.
- Both run with `no-new-privileges` and all Linux capabilities dropped.
- No secret is in either image: `.dockerignore` excludes `.env*`, `*.db`, `uploads`; configuration arrives at run time via `env_file`.

## 7. Nginx

```bash
sudo cp deploy/nginx/issatkr-proxy.conf /etc/nginx/snippets/issatkr-proxy.conf
sudo cp deploy/nginx/issatkr.conf /etc/nginx/sites-available/issatkr.conf
sudo sed -i 's/YOUR_DOMAIN/your.real.domain/g' /etc/nginx/sites-available/issatkr.conf
sudo ln -s /etc/nginx/sites-available/issatkr.conf /etc/nginx/sites-enabled/issatkr.conf
sudo rm -f /etc/nginx/sites-enabled/default
```

Do not reload Nginx yet: the HTTPS block needs the certificate from §8.

The template:

- forwards the real `Host`;
- **overwrites** `X-Forwarded-For` (the app's per-IP login limit and the audit log rely on it);
- limits the body to 12 MB (the app's limit);
- rate-limits `/api/auth/login`;
- returns 404 for `/api/cron/notifications` from the Internet.

Security headers (CSP, HSTS, X-Frame-Options, …) come from the app; do not duplicate them.

## 8. HTTPS (TLS certificate)

The certificate is configured in **Nginx** (`ssl_certificate` / `ssl_certificate_key` in `/etc/nginx/sites-available/issatkr.conf`). The application itself never handles TLS.

With Let's Encrypt (requires the DNS record from §1 and port 80 open):

```bash
sudo mkdir -p /var/www/certbot
# 1) First issuance: the 443 block needs a certificate before Nginx can start,
#    so stop Nginx briefly and let certbot answer the challenge itself.
sudo systemctl stop nginx
sudo certbot certonly --standalone -d YOUR_DOMAIN --agree-tos -m CONTACT_EMAIL --no-eff-email
sudo nginx -t && sudo systemctl start nginx
# 2) Switch renewals to the running Nginx (webroot) and reload Nginx after each renewal.
#    Without this, renewals would try "standalone" again and fail while Nginx holds port 80.
sudo certbot certonly --webroot -w /var/www/certbot -d YOUR_DOMAIN --force-renewal \
  --deploy-hook "systemctl reload nginx"
sudo certbot renew --dry-run      # the certbot package's systemd timer then renews automatically
```

With a certificate supplied by the institution: copy it to the server (key readable by root only) and point `ssl_certificate` and `ssl_certificate_key` at it.

HTTPS is **mandatory**. In production the session cookie is `Secure`, so login does not work over plain HTTP, and HSTS is sent. There is deliberately no switch to disable this.

## 9. Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH          # ideally: sudo ufw allow from ADMIN_IP to any port 22
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Check from **another machine** that only 22, 80 and 443 answer (`nmap -Pn SERVER_IP`), and that `http://SERVER_IP:3000` does not respond.

Note that Docker manipulates iptables directly and can bypass ufw for published ports. This stack publishes only on `127.0.0.1`, which is not reachable from outside; keep it that way.

## 10. Health check

| Check | Command | Expected |
|---|---|---|
| On the server | `bash scripts/healthcheck.sh` | `healthy: http://127.0.0.1:3000/health` |
| Through Nginx | `bash scripts/healthcheck.sh https://YOUR_DOMAIN/health` | `healthy` |
| Container | `docker compose ps` | `app … (healthy)` |

`GET /health` (or `/api/health`) answers `{"status":"ok"}`, or `503 {"status":"unavailable"}` if the database is unreachable. It reveals no version, configuration or data and needs no login. The Docker `HEALTHCHECK` calls it every 30 s.

## 11. Logs

```bash
docker compose logs -f --tail=200 app                 # application (rotated: 5 × 10 MB)
sudo tail -f /var/log/nginx/issatkr.access.log /var/log/nginx/issatkr.error.log
```

- Application logs never contain passwords, tokens, cookies, CINs or student records. Server errors go through a redacting logger: database errors keep only error codes and field names.
- Failed logins are logged with the staff e-mail and IP.
- **Audit trail** (who did what, when, from which IP; never the sensitive values) is in the `AuditLog` table. The app has no screen for it yet. Query it read-only with:

```bash
docker compose --profile jobs run --rm migrate node -e "
const {PrismaClient}=require('@prisma/client');new PrismaClient().auditLog.findMany({orderBy:{createdAt:'desc'},take:50})
.then(r=>console.table(r.map(({createdAt,action,actorRole,targetType,ip})=>({createdAt,action,actorRole,targetType,ip}))))"
```

## 12. Restart

```bash
docker compose restart app        # restart the application
docker compose up -d app          # (re)create it with the current image and configuration
sudo systemctl reload nginx       # after changing the Nginx configuration
```

The app container restarts automatically (`restart: unless-stopped`), including after a server reboot, provided Docker is enabled: `sudo systemctl enable docker`.

## 13. Backup

**What to back up:**

| Data | Location | Method |
|---|---|---|
| Database | `/data/issatkr.db` in volume `issatkr_issatkr-data` | `scripts/backup.sh` → `VACUUM INTO` online copy + integrity check |
| Uploaded justificatifs | `/data/uploads` in the same volume | `scripts/backup.sh` → `uploads-<date>.tar.gz` |
| Configuration | `/opt/issatkr/.env.production` | Copy it **separately**, encrypted (it holds secrets) |
| Nginx configuration and certificate | `/etc/nginx/sites-available/issatkr.conf`, `/etc/letsencrypt` | Server backup (Let's Encrypt can re-issue certificates) |

**Run a backup** (safe while the app runs):

```bash
BACKUP_EXPORT_DIR=BACKUP_MOUNT/issatkr bash scripts/backup.sh
```

- Backups land in `/data/backups` inside the volume. The newest 30 are kept (`BACKUP_KEEP`).
- `BACKUP_EXPORT_DIR` copies them to an off-server location (NAS, second disk, encrypted remote). **A backup kept only on the same server does not protect against losing that server.**

**Schedule it** (READY TO CONFIGURE, not yet configured), via `crontab -e` for the deploying user:

```
30 2 * * * cd /opt/issatkr && BACKUP_EXPORT_DIR=BACKUP_MOUNT/issatkr bash scripts/backup.sh >> /var/log/issatkr-backup.log 2>&1
*/15 * * * * cd /opt/issatkr && bash scripts/cron-notifications.sh >> /var/log/issatkr-cron.log 2>&1
```

Retention recommendations:

- Keep daily backups for 30 days, plus one per month for the school year.
- Store the off-server copies encrypted, because they contain CINs.
- Restrict who can read them.

**Verify a backup:**

- Each backup is integrity-checked when it is made.
- Monthly, check one again, then do a restore drill (§14) on a non-production machine:

```bash
docker compose --profile jobs run --rm migrate node scripts/db-verify.mjs /data/backups/issatkr-YYYYMMDD-HHMMSS.db
```

`db-verify` prints the integrity status, the number of applied migrations and row **counts** only, never data.

## 14. Restore

```bash
docker compose exec app ls -1t /data/backups | head      # pick a backup
bash scripts/restore.sh issatkr-YYYYMMDD-HHMMSS.db [uploads-YYYYMMDD-HHMMSS.tar.gz]
```

`restore.sh` does the following:

1. Verifies the backup.
2. Asks you to type `RESTORE`.
3. Takes a safety backup of the current database.
4. Stops the app and copies the backup in (the previous uploads are kept as `uploads.before-restore`).
5. Runs `migrate deploy`, in case the backup predates the code.
6. Restarts the app and checks health.

To restore a file kept off-server, first copy it in with `docker compose cp ./issatkr-…db app:/data/backups/`.

Verified locally: an online backup was taken while the server ran, data was changed, the backup was restored, and the server came back with the backed-up state and logins working.

## 15. Update procedure

```bash
cd /opt/issatkr
git fetch && git log --oneline HEAD..origin/main     # review what is coming
git pull --ff-only
bash scripts/deploy.sh                                # backup → migrate → restart → health
```

Read new migrations (`prisma/migrations/*`) before deploying them. Migrations only move forward.

## 16. Rollback

```bash
bash scripts/rollback.sh
```

This switches back to the images tagged `:previous` by the last deploy, without rebuilding, and checks health.

If the failed release had applied a migration the previous code cannot use, also restore the backup `deploy.sh` took just before migrating:

```bash
bash scripts/restore.sh issatkr-YYYYMMDD-HHMMSS.db
```

Then return the code to the matching commit (`git checkout <previous-commit>`) so the next deploy does not re-apply the faulty release.

## 17. Security checklist (before opening to users)

- [ ] `.env.production`: mode 600, owned by the deploying user, real random `AUTH_SECRET` and `CRON_SECRET`, not committed (`git status` clean).
- [ ] The database was created by `migrate deploy` (never a copy of `prisma/dev.db`). The first admin was created with `create-admin.mjs`. No demo accounts exist (`db-verify` counts and the Utilisateurs page).
- [ ] HTTPS works (`https://YOUR_DOMAIN`). HTTP redirects to it. Grade the TLS configuration (for example SSL Labs).
- [ ] Only 22/80/443 are reachable from outside. `SERVER_IP:3000` does not answer. SSH is restricted (keys only, ideally limited by IP).
- [ ] `https://YOUR_DOMAIN/api/cron/notifications` returns 404 from outside. `scripts/cron-notifications.sh` works on the server.
- [ ] `docker compose exec app id` shows `uid=1000(node)`, not root.
- [ ] A test login, logout, and a student-data page work. A teacher account cannot open an admin page.
- [ ] Backups: the cron is installed, one export reached `BACKUP_MOUNT`, and a restore drill was done once.
- [ ] Host: automatic security updates (`unattended-upgrades`), Docker enabled at boot, server time synchronized (NTP; the attendance window depends on it).
- [ ] Repository history: `prisma/dev.db` (test data, password hashes) removed with `scripts/purge-dev-db-from-history.sh` (prepares a rewritten mirror; the force-push is a manual, explicit step).
- [ ] Decisions recorded for the open items in `SECURITY_AUDIT_REPORT.md`: two-factor authentication for admins, encryption of the disk and backups, and audit log retention.
