# Varsity Development Watch

An interactive, community-first view of City of Calgary development permits in Varsity.

**Live site:** https://varsity-development-watch.albert-leung.chatgpt.site

## Purpose

The dashboard makes Calgary's development-permit open data easier for residents and community association members to explore. It brings status, location, timing, decisions, development-plan links and public appeal information into one searchable view.

## Features

- Live City of Calgary open-data connection
- City dataset update timestamp, when available
- Permit status summary, approximate geographic plot and applications-by-year chart
- Search by address, permit number, applicant or description
- Filters by year and status
- Application, decision, release and SDAB appeal details
- Links to development plans and public SDAB appeal packages when the City publishes them
- Configuration-driven community, feed, field mappings, refresh timing, status categories and map labels
- Clear data-freshness, community-scope and official-verification warnings

## Configure the dashboard and City feed

All settings that normally change between communities or City data feeds are in:

```text
config/dashboard.json
```

The application validates this file when it starts or builds. Invalid URLs, field names, refresh intervals, ordering or missing mappings fail early instead of silently producing a misleading dashboard.

### Change to another Calgary community

Update these values in `config/dashboard.json`:

```json
{
  "site": {
    "name": "Your Community Development Watch",
    "brandMark": "Y",
    "communityDisplayName": "Your Community",
    "wardLabel": "Ward X"
  },
  "feed": {
    "filter": {
      "field": "communityname",
      "value": "EXACT CITY COMMUNITY NAME"
    }
  }
}
```

Use the exact `communityname` value published by Calgary Open Data. The code automatically rebuilds both the live GeoJSON request and the shareable filtered JSON-query link. You do not need to edit `app/page.tsx`, `app/dashboard.tsx` or `app/layout.tsx`.

Also update `map.fallbackBounds` and `map.roadLabels` so the approximate activity plot suits the new community.

### Change the City dataset or API fields

The `feed` section controls:

- `baseUrl`: Calgary Open Data host
- `resourceDatasetId`: Socrata resource ID used by the GeoJSON feed and metadata endpoint
- `queryViewId`: API v3 view ID used for the shareable JSON query
- `datasetPageUrl`: official dataset information page
- `filter`: field and community value
- `order`: sort field and direction
- `limit`: maximum records returned
- `refreshSeconds`: feed and metadata refresh interval
- `requestTimeoutMilliseconds`: maximum wait for a City feed response
- `selectFields`: City fields requested from the feed
- `fieldMap`: translation from dashboard concepts to City field names

If the City renames a source field, update the relevant value under `fieldMap` and make sure the source field is present in `selectFields`. The UI continues to use stable internal names.

The `links` section controls the Calgary Development Map and SDAB sources, including the appeal-page refresh and request timeout. The development-application template must keep the `{permitNumber}` placeholder.

The `statuses` section controls which words place a City status into the active, approved or closed dashboard group.

After any configuration change, run:

```bash
npm test
```

## Data source and disclaimer

Development Permits — City of Calgary Open Data:
https://data.calgary.ca/Business-and-Economic-Activity/Development-Permits/6933-unw5

The default configuration is filtered to the City community name `VARSITY`. Every count, map, chart and permit list therefore describes Varsity only. A fork for another community must use the corresponding exact `communityname` value in `config/dashboard.json`.

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
- A non-root Linux account to run the dashboard
- A domain or subdomain whose DNS points to the server
- A reverse proxy such as Caddy or Nginx
- Outbound HTTPS access to `data.calgary.ca`
- Inbound ports 80 and 443 open for the reverse proxy

Visitors must be able to reach `calgary.ca` and `publicaccess.calgary.ca` to open linked City, DMap and SDAB records.

### 2. Clone, configure and build

```bash
git clone https://github.com/alby1976/calgary_dp.git /srv/calgary_dp
cd /srv/calgary_dp
npm ci
# Edit config/dashboard.json if you are not hosting the Varsity dashboard.
npm test
```

Make the directory readable and writable by the non-root account that will run the service.

Test the production server manually:

```bash
HOST=127.0.0.1 PORT=3000 npm run start
```

Open `http://127.0.0.1:3000` on the server, or run `curl http://127.0.0.1:3000`. Press Ctrl+C when the check is complete.

### 3. Keep it running with systemd

Find npm's absolute path with `command -v npm`. Create `/etc/systemd/system/calgary-dp.service`, replacing the user, directory, npm path and domain where needed:

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

Enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now calgary-dp
sudo systemctl status calgary-dp
```

View logs with `journalctl -u calgary-dp -f`.

The Node.js service deliberately listens only on `127.0.0.1:3000`. Do not expose port 3000 publicly when using a reverse proxy.

### 4. Add HTTPS with a reverse proxy

Use either Caddy or Nginx. Replace `dashboard.example.ca` with the real domain.

Caddy example:

```caddyfile
dashboard.example.ca {
    reverse_proxy 127.0.0.1:3000
}
```

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

Check and reload the reverse proxy, then configure an HTTPS certificate using your normal certificate manager. Once HTTPS works, redirect HTTP to HTTPS.

### 5. Update the deployment

```bash
cd /srv/calgary_dp
git pull --ff-only
npm ci
npm test
sudo systemctl restart calgary-dp
sudo systemctl status calgary-dp
```

Check the public page after every update. If validation fails, do not restart the running service until the problem is fixed.

### Hosting notes

- No API key or secret is currently required.
- `PORT` defaults to `3000`; the example overrides `HOST` to keep the app private behind the reverse proxy.
- Set `VINEXT_TRUSTED_HOSTS` to the public dashboard hostname when forwarding host and protocol headers.
- The City can change its APIs or public document systems. Monitor the dashboard and logs, and verify important records against official City sources.
- Back up local configuration changes before pulling future upstream updates.

## Licence and attribution

This project is **source-available**, not OSI-approved open-source software.

The code is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). Noncommercial use, modification and redistribution are permitted under its terms. Commercial use requires a separate written licence from the copyright holder.

Municipal data is not covered by the software licence and remains subject to the Open Government Licence — City of Calgary.
