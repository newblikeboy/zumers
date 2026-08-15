# Zumers Droplet Deployment

This deploys the Vite frontend as static files and the Go backend as a systemd service behind Nginx.

## 1. Server Packages

Run on the droplet:

```bash
sudo apt update
sudo apt install -y nginx git curl build-essential nodejs npm
```

Install Go 1.25 or newer, then confirm:

```bash
go version
```

## 2. Copy Project

Clone or copy this repository to:

```bash
/opt/zumers
```

Create the service user:

```bash
sudo useradd --system --home /opt/zumers --shell /usr/sbin/nologin zumers || true
sudo mkdir -p /opt/zumers /var/www/zumers /etc/zumers
sudo chown -R "$USER":"$USER" /opt/zumers
```

## 3. Backend Environment

Create the production backend environment:

```bash
sudo cp /opt/zumers/deploy/backend.env.example /etc/zumers/backend.env
sudo nano /etc/zumers/backend.env
sudo chmod 600 /etc/zumers/backend.env
```

Set:

- `APP_BASE_URL` to `https://your-domain.com` or `http://your-droplet-ip`
- `FRONTEND_URL` to the same public frontend origin
- `POSTGRES_URL` to your PostgreSQL URI
- both JWT secrets to long random values
- Cloudinary values

Generate JWT secrets:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

## 4. Build Backend And Run Migrations

```bash
cd /opt/zumers/backend
go mod download
mkdir -p bin
go build -o bin/zumers-api ./cmd/api
go build -o bin/zumers-migrate ./cmd/migrate

sudo chown -R zumers:zumers /opt/zumers/backend
set -a; source /etc/zumers/backend.env; set +a; cd /opt/zumers/backend && ./bin/zumers-migrate up
```

## 5. Build Frontend

For a domain with HTTPS:

```bash
cd /opt/zumers/frontend
cat > .env.production <<'EOF'
VITE_API_BASE_URL=/api/v1
VITE_WS_BASE_URL=wss://your-domain.com
VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
EOF
npm ci
npm run build
sudo rsync -a --delete dist/ /var/www/zumers/
```

For IP-only HTTP testing, use:

```env
VITE_WS_BASE_URL=ws://your-droplet-ip
```

## 6. Start API Service

```bash
sudo cp /opt/zumers/deploy/zumers-api.service /etc/systemd/system/zumers-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now zumers-api
sudo systemctl status zumers-api --no-pager
```

## 7. Configure Nginx

```bash
sudo cp /opt/zumers/deploy/nginx-zumers.conf /etc/nginx/sites-available/zumers
sudo nano /etc/nginx/sites-available/zumers
sudo ln -sf /etc/nginx/sites-available/zumers /etc/nginx/sites-enabled/zumers
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Replace `YOUR_DOMAIN_OR_IP` in the Nginx file.

## 8. HTTPS

If you have a domain pointed to the droplet:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

After HTTPS is enabled, make sure:

- `/etc/zumers/backend.env` uses `https://your-domain.com`
- `frontend/.env.production` uses `VITE_WS_BASE_URL=wss://your-domain.com`
- rebuild the frontend and restart the API

```bash
sudo systemctl restart zumers-api
```

## 9. Verify

```bash
curl http://127.0.0.1:8080/healthz
curl http://YOUR_DOMAIN_OR_IP/healthz
sudo journalctl -u zumers-api -f
```

Open:

```text
http://YOUR_DOMAIN_OR_IP
```

or:

```text
https://your-domain.com
```
