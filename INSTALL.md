# NextGen Fusion School — Installation Guide

This is a **single-institution** school ERP. One deployment serves one school.
Deploy it on your own server (or your school's server), point it at your own
Postgres database, and you're done — no external SaaS, no subscription.

---

## Option A — Docker (recommended, 5 minutes)

Requirements: a Linux server with `docker` and `docker compose` installed.

1. **Copy the project onto the server** (via `git clone` or a zip).

2. **Create your `.env` file** in the project root:

   ```env
   POSTGRES_PASSWORD=<pick a strong password>
   JWT_ACCESS_SECRET=<32+ random chars>
   JWT_REFRESH_SECRET=<32+ random chars>
   APP_URL=https://school.yourdomain.com
   # Optional — paste the LICENSE_PUBLIC_KEY the vendor gave you:
   LICENSE_PUBLIC_KEY=
   ```

   Generate secrets quickly:
   ```bash
   openssl rand -hex 32
   ```

3. **Start everything**:

   ```bash
   docker compose up -d
   ```

4. **Open the app** at `http://<server-ip>:8080` and complete the first-run
   setup wizard: school name, admin email, admin password. Done.

5. **(Optional) Put it behind a real domain** with Caddy/Nginx + HTTPS.

---

## Option B — Managed Postgres (Neon, Supabase, RDS)

Use this if you don't want to run Postgres yourself.

1. Create a Postgres database and copy its connection string.
2. Set env vars on your host (Render, Railway, Fly, Cloudflare, VPS):

   ```env
   DATABASE_URL=postgres://user:pass@host/db?sslmode=require
   JWT_ACCESS_SECRET=<32+ random chars>
   JWT_REFRESH_SECRET=<32+ random chars>
   APP_URL=https://school.yourdomain.com
   LICENSE_PUBLIC_KEY=<optional>
   ```

3. Deploy the app. On boot it runs `scripts/db-setup.ts` which applies
   migrations and seeds default roles + permissions.
4. Open the URL and complete the setup wizard.

---

## Backups

The Postgres volume holds everything. Back it up nightly:

```bash
docker exec <db-container> pg_dump -U nextgen nextgen | gzip > backup-$(date +%F).sql.gz
```

Or use your managed Postgres provider's built-in backups (Neon and Supabase
both offer point-in-time restore).

---

## Updates

To upgrade to a newer release:

```bash
git pull
docker compose build --no-cache app
docker compose up -d
```

The app applies any new migrations automatically on start.

---

## Licensing (optional)

If the vendor issued you a license key, paste it in the app under
**Settings → License**. Without one, the app still runs — you'll just see an
"Unlicensed" indicator in the sidebar.
