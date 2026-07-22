#!/usr/bin/env bash
# NextGen Fusion School — quick VPS install helper (Ubuntu 22.04/24.04).
# Run as root on a fresh VPS.
set -euo pipefail

echo "=== NextGen Fusion School VPS installer ==="

# Update system
apt update && apt upgrade -y

# Install Docker
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Install Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy

# Enable services
systemctl enable docker
systemctl enable caddy

# Project should already be copied to /opt/nextgen-fusion before running this script
PROJECT_DIR="/opt/nextgen-fusion"
if [[ ! -d "$PROJECT_DIR" ]]; then
  echo "ERROR: Project directory $PROJECT_DIR not found."
  echo "Copy the project source to /opt/nextgen-fusion first, then re-run this script."
  exit 1
fi

cd "$PROJECT_DIR"

# Remind about .env and Caddyfile
if [[ ! -f .env ]]; then
  echo ""
  echo "WARNING: .env file not found. Copy .env.example to .env and fill it in before starting."
fi

echo ""
echo "=== Base packages installed ==="
echo "Next steps:"
echo "1. Edit $PROJECT_DIR/.env with your database, JWT, Resend, and license keys."
echo "2. Edit $PROJECT_DIR/Caddyfile with your domain."
echo "3. Run: cd $PROJECT_DIR && docker compose up -d --build"
echo "4. Open https://your-domain.edu/setup in your browser."
