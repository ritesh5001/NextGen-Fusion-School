# NextGen Fusion School — VPS Deployment Guide

This document explains how to deploy the **single-institution, self-hosted** ERP on a VPS. One deployment = one school/college.

## Architecture

- **Frontend:** TanStack Start + React + Tailwind CSS
- **Backend:** Server functions (bundled with the frontend, no separate API server needed)
- **Database:** PostgreSQL 16
- **Runtime:** Bun inside Docker
- **Reverse proxy:** Caddy (recommended) or Nginx
- **SSL:** Automatic via Caddy + Let's Encrypt

## What you need

1. A VPS with at least **2 vCPU, 4 GB RAM, 40 GB SSD** (Ubuntu 22.04/24.04 recommended).
2. A domain name pointing to the VPS IP (A record: `@` and `www`).
3. A Resend account and API key for email delivery.
4. A signed license key issued by NextGen Fusion.

## Step-by-step deployment

### 1. Prepare the VPS

SSH into the server as root:

```bash
# Update the system
apt update && apt upgrade -y

# Install Docker & Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify
 docker --version
 docker compose version
```

### 2. Transfer the project

From your local machine:

```bash
# Option A: clone the repo (if you pushed it to Git)
# Option B: copy the source folder with rsync
rsync -avz --exclude node_modules --exclude .output --exclude .keys ./ nextgen@vps-ip:/opt/nextgen-fusion/
```

On the VPS:

```bash
ssh nextgen@vps-ip
sudo mkdir -p /opt/nextgen-fusion
sudo chown -R $USER:$USER /opt/nextgen-fusion
cd /opt/nextgen-fusion
```

### 3. Create the environment file

```bash
cp .env.example .env
nano .env
```

Fill in the values:

```env
# Postgres connection (Docker service name is 'db')
DATABASE_URL=postgres://nextgen:STRONG_DB_PASSWORD@db:5432/nextgen

# JWT secrets — generate 64+ random characters
JWT_ACCESS_SECRET=REPLACE_WITH_RANDOM_64_CHAR_STRING
JWT_REFRESH_SECRET=REPLACE_WITH_RANDOM_64_CHAR_STRING
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=1209600

# Super admin seeded on first run
SEED_SUPERADMIN_EMAIL=admin@yourschool.edu
SEED_SUPERADMIN_PASSWORD=STRONG_ADMIN_PASSWORD

# Public URL of the deployed app
APP_URL=https://yourschool.edu

# Email delivery via Resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx

# License verification public key issued by NextGen Fusion
LICENSE_PUBLIC_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Generate strong secrets:

```bash
openssl rand -hex 48
```

### 4. Configure the reverse proxy

#### Caddy (recommended — automatic HTTPS)

Install Caddy:

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy
```

Create `Caddyfile`:

```caddy
yourdomain.edu {
  encode gzip
  reverse_proxy localhost:8080
}

www.yourdomain.edu {
  redir https://yourdomain.edu{uri}
}
```

Reload Caddy:

```bash
sudo caddy fmt --overwrite
sudo systemctl reload caddy
```

### 5. Start the application

```bash
# Pull and build
docker compose pull
docker compose up -d --build

# Watch logs
 docker compose logs -f app
```

On first run the app will:

1. Run database migrations.
2. Seed the super admin if no users exist.

### 6. Finish setup in the browser

Open `https://yourdomain.edu/setup` and complete the first-time setup:

- School name and short identifier
- Owner (super admin) account
- License key issued by NextGen Fusion

After setup, the public website will be live at `/` and the admin login at `/auth/login`.

## License issuance (vendor-side only)

On your local machine (not the customer's server), run:

```bash
node scripts/issue-license.mjs \
  --institution "St. Xavier's High School" \
  --expires 2027-07-18 \
  --max-students 2000
```

First run generates a keypair in `.keys/`:

- `.keys/license-private.b64` — **keep secret, never commit or share**
- `.keys/license-public.b64` — paste this into the customer's `.env` as `LICENSE_PUBLIC_KEY`

Then copy the printed license key and paste it into the customer's setup form.

## Backups

A helper script is included at `scripts/backup.sh`. Run it manually or via cron:

```bash
# Add to crontab (daily at 2 AM)
0 2 * * * cd /opt/nextgen-fusion && ./scripts/backup.sh >> /var/log/nextgen-backup.log 2>&1
```

Backups are written to `/opt/nextgen-fusion/backups/`. The script keeps the 14 most recent dumps.

## Updates

To update the app after a new release:

```bash
cd /opt/nextgen-fusion
# Pull or copy the new source code
 docker compose down
 docker compose up -d --build
```

Database migrations run automatically on container start.

## Troubleshooting

| Problem | Check |
|--------|-------|
| Site not loading | `docker compose ps`, Caddy logs (`journalctl -u caddy`), DNS A record |
| Database connection error | `DATABASE_URL`, Postgres container health, `POSTGRES_PASSWORD` match |
| License invalid | `LICENSE_PUBLIC_KEY` in `.env`, key format, expiry date |
| Emails not sending | `RESEND_API_KEY`, verified domain in Resend, from-email settings |
| 502 Bad Gateway | App container running on port 8080, Caddy reverse proxy target |

## Security checklist

- [ ] Change all default passwords.
- [ ] Use strong JWT secrets.
- [ ] Keep `.keys/license-private.b64` offline / in a password manager.
- [ ] Enable UFW and only open ports 22, 80, 443.
- [ ] Set up daily backups.
- [ ] Enable automatic security updates (`unattended-upgrades`).
- [ ] Use a non-root user for deployment.
