# Varsity Development Watch

An interactive, community-first view of City of Calgary development permits in Varsity.

**Live site:** https://varsity-development-watch.albert-leung.chatgpt.site

## Purpose

The dashboard makes Calgary's development-permit open data easier for residents and community association members to explore. It brings status, location, timing, decisions, development-plan links and public appeal information into one searchable view.

## Features

- Live City of Calgary open-data connection
- City dataset update timestamp, when available
- Permit status summary
- Approximate geographic activity plot
- Applications-by-year chart
- Search by address, permit number, applicant or description
- Filters by year and status
- Application, decision, release and SDAB appeal details
- Links to development plans and public SDAB appeal packages when the City publishes them
- Clear data-freshness, Varsity-only scope and official-verification warnings

## Data source

Development Permits — City of Calgary Open Data:
https://data.calgary.ca/Business-and-Economic-Activity/Development-Permits/6933-unw5

The included query is filtered to the City community name `VARSITY`. Every count, map, chart and permit list therefore describes Varsity only. A fork for another community must use a corresponding Calgary Open Data JSON query with that community's exact `communityname` value.

The dashboard is an independent public-interest interpretation of municipal open data. It is not an official City notice. For comment periods, appeal deadlines or other time-sensitive decisions, verify the file with the City of Calgary.

## Technology

- React 19
- Next.js-compatible Vinext runtime
- TypeScript
- Tailwind CSS
- Cloudflare-compatible worker deployment
- Self-hostable Node.js production server

## Local development

Requirements: Node.js 22.13 or newer, Linux, curl, flock and GNU timeout.

```bash
npm ci
npm run dev
```

Production validation:

```bash
npm test
```

## Self-hosting on your own server

The dashboard is server-rendered. It needs a running Node.js process; uploading only the repository or `dist` directory to a static file host is not sufficient.

### 1. Prepare the server

Use a Linux server with:

- Node.js 22.13 or newer and npm
- Git, curl, flock and GNU `timeout`
- A non-root Linux account that will run the dashboard
- A domain or subdomain whose DNS points to the server
- A reverse proxy such as Caddy or Nginx
- Outbound HTTPS access to `data.calgary.ca`
- Inbound ports 80 and 443 open for the reverse proxy

The City, DMap and SDAB links are public web links. Visitors must be able to reach `calgary.ca` and `publicaccess.calgary.ca` to open those records.

### 2. Clone and install

The example below uses `/srv/calgary_dp`. Choose another path if preferred, but use the same path in the service configuration.

```bash
git clone https://github.com/alby1976/calgary_dp.git /srv/calgary_dp
cd /srv/calgary_dp
npm ci
```

Make the directory readable and writable by the non-root account that will run the service.

### 3. Use Varsity or customize another community

No change is needed to host the Varsity dashboard.

For another Calgary community, find all community-specific text and query filters:

```bash
cd /srv/calgary_dp
rg -n 'VARSITY|Varsity' app
```

Edit:

- `app/page.tsx`: replace the `VARSITY` Open Data filters with the exact City `communityname` value.
- `app/dashboard.tsx`: update the dashboard title, community labels, accessibility text and scope disclaimer.
- `app/layout.tsx`: update the page title and description.

The variable names in `app/page.tsx` may also be renamed for clarity, but that is optional. Do not remove the community filter unless you intentionally want a city-wide feed. Rebuild after every change.

### 4. Validate and build

```bash
cd /srv/calgary_dp
npm test
```

This creates the production build and runs the rendered-HTML checks. Fix any failure before starting or restarting the public service.

To test the production server manually:

```bash
HOST=127.0.0.1 PORT=3000 npm run start
```

Open `http://127.0.0.1:3000` on the server, or run `curl http://127.0.0.1:3000`. Press Ctrl+C when the check is complete.

### 5. Keep it running with systemd

First find npm's absolute path:

```bash
command -v npm
```

Create `/etc/systemd/system/calgary-dp.service` with the following content. Replace `YOUR_LINUX_USER`, the working directory, npm path and domain where needed.

```ini
[Unit]
Description=Calgary Development Permit Dashboard
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=YOUR_LINUX_USER
WorkingDirectory=/srv/calgary_dp
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3000
Environment=VINEXT_TRUSTED_HOSTS=dashboard.example.ca
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now calgary-dp
sudo systemctl status calgary-dp
```

View service logs with:

```bash
journalctl -u calgary-dp -f
```

The Node.js service deliberately listens only on `127.0.0.1:3000`. Do not expose port 3000 publicly when using a reverse proxy.

### 6. Add HTTPS with a reverse proxy

Use either Caddy or Nginx, not both. Replace `dashboard.example.ca` with the real domain.

Caddy example:

```caddyfile
dashboard.example.ca {
    reverse_proxy 127.0.0.1:3000
}
```

Place that site block in your Caddy configuration and reload Caddy. With working DNS and public access to ports 80 and 443, Caddy can manage the HTTPS certificate.

Nginx example:

```nginx
server {
    listen 80;
    server_name dashboard.example.ca;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable the Nginx site, check the configuration with `sudo nginx -t`, reload Nginx and configure an HTTPS certificate using your normal certificate manager. Once HTTPS works, redirect HTTP to HTTPS.

### 7. Update the deployment

```bash
cd /srv/calgary_dp
git pull --ff-only
npm ci
npm test
sudo systemctl restart calgary-dp
sudo systemctl status calgary-dp
```

Check the public page after every update. If a release fails validation, do not restart the running service until the problem is fixed.

### Hosting notes

- No API key or secret is currently required.
- `PORT` defaults to `3000` and `HOST` defaults to `0.0.0.0`; the examples override `HOST` to keep the app private behind the reverse proxy.
- Set `VINEXT_TRUSTED_HOSTS` to the public dashboard hostname when forwarding host and protocol headers.
- The City can change its APIs or public document systems. Monitor the dashboard and server logs, and verify important records against official City sources.
- Back up local customizations before pulling future upstream changes.

## Licence and attribution

This project is **source-available**, not OSI-approved open-source software.

The code is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). Noncommercial use, modification and redistribution are permitted under its terms. Commercial use requires a separate written licence from the copyright holder.

Municipal data is not covered by the software licence and remains subject to the Open Government Licence — City of Calgary.
