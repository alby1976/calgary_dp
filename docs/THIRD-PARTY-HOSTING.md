# Hosting on third-party infrastructure

This guide covers hosting Varsity Development Watch somewhere other than its current ChatGPT Sites deployment.

## Choose the hosting model

| Hosting model | Suitability | Important limitation |
| --- | --- | --- |
| Cloudflare-compatible Worker platform | Best architectural match | Requires an independently configured Worker project and deployment workflow |
| Managed Node.js application host | Reasonable for a tested community deployment | `vinext start` is less complete than the Worker runtime and must be tested with this application |
| Linux virtual private server | Most control | You manage security updates, the process supervisor, reverse proxy, TLS, monitoring and backups |
| Container application platform | Reasonable when it supports a persistent HTTP service | The image must include the Linux tools required by the build scripts |
| Static website host | Not supported | The dashboard performs server-side fetching and rendering |
| Traditional shared PHP/cPanel hosting | Usually unsuitable | It must explicitly support a persistent Node.js 22 service and a configurable port |

The current public dashboard remains hosted at:

https://varsity-development-watch.albert-leung.chatgpt.site

Moving a copy to another provider does not automatically move or redirect that address.

## Runtime support warning

The project uses Vinext. Its primary production target is Cloudflare Workers. Vinext provides `vinext start` as a Node.js production server, but its own documentation describes that path as less complete than Workers deployment.

For this dashboard, a Node host must be treated as a compatibility deployment:

1. build and run the exact repository version;
2. verify the home page, City feed, filters, DMap links and any public SDAB package link;
3. check server logs under normal traffic; and
4. keep the previous working deployment available until the new host passes those checks.

Do not market a Node deployment as fully equivalent to the Worker deployment without testing it.

## Requirements shared by every provider

The host must provide:

- Linux;
- Node.js 22.13 or newer;
- npm;
- `curl`, `flock` and GNU `timeout` during installation and building;
- a persistent HTTP service or compatible Worker runtime;
- outbound DNS and HTTPS access to `data.calgary.ca`;
- enough request time for the configured City and SDAB timeouts; and
- HTTPS for the public dashboard address.

Visitors also need browser access to `tile.openstreetmap.org` for the default street basemap and to `calgary.ca`, `dmap.calgary.ca` and `publicaccess.calgary.ca` for official links. If you configure another tile provider, allow its hostname instead and follow its attribution, access and billing terms.

No Calgary API key or application secret is currently required.

## Option 1: managed Node.js application host

Use a provider that accepts a Git repository plus custom install, build and start commands.

### Provider settings

| Provider field | Value |
| --- | --- |
| Repository | `https://github.com/alby1976/calgary_dp.git` or your fork |
| Branch | `main`, unless you maintain a deployment branch |
| Runtime | Node.js 22.13 or newer on Linux |
| Install command | `npm ci` |
| Build and validation command | `npm test` |
| Start command | `npm run start` |
| Health-check path | `/` |
| Application type | Persistent web service, not static site |

If the provider offers only one build field, use:

```bash
npm ci && npm test
```

### Environment variables

Set:

```text
NODE_ENV=production
HOST=0.0.0.0
VINEXT_TRUSTED_HOSTS=dashboard.example.ca
```

Replace `dashboard.example.ca` with the exact public hostname. For multiple public hostnames, use the comma-separated format supported by the runtime.

Most managed hosts supply `PORT` automatically. Let the provider supply it unless its documentation explicitly requires a fixed value. If no port is injected, set:

```text
PORT=3000
```

Do not set `HOST=127.0.0.1` on a managed application platform; its routing layer normally needs the service to listen on `0.0.0.0`.

Do not set `VINEXT_TRUST_PROXY=1` merely to make an error disappear. It trusts forwarded proxy information broadly. Prefer `VINEXT_TRUSTED_HOSTS` unless the entire proxy path is controlled and understood.

### Deployment sequence

1. Fork the repository if you need different community settings.
2. Edit `config/dashboard.json` and run `npm test` locally.
3. Connect the repository to the provider.
4. enter the settings above;
5. deploy;
6. open the provider URL and perform the acceptance checks below; and
7. attach a custom domain only after the provider URL works.

## Option 2: Linux VPS or dedicated server

Use the [self-hosting instructions in the README](../README.md#self-hosting-on-a-linux-vps). They cover:

- cloning and validating the repository;
- running the Node service with systemd;
- binding the application to loopback;
- placing Caddy or Nginx in front;
- enabling HTTPS; and
- updating the deployment safely.

On a VPS, use:

```text
HOST=127.0.0.1
PORT=3000
```

when the reverse proxy runs on the same server. The public firewall should expose only ports 80 and 443, not the Node port.

## Option 3: container application platform

A container platform must run a persistent HTTP service and allow outbound HTTPS.

The build image needs:

- Node.js 22.13 or newer;
- npm;
- `curl`;
- `flock`, normally supplied by the Linux `util-linux` package; and
- GNU `timeout`, normally supplied by the Linux `coreutils` package.

The container workflow should:

1. copy `package.json` and `package-lock.json`;
2. install the required Linux tools;
3. run `npm ci`;
4. copy the project source;
5. run `npm test` during the image build;
6. start with `npm run start`; and
7. listen on `0.0.0.0` using the provider's assigned port.

The application does not require persistent disk storage. Configuration is compiled into the deployed build, so changing `config/dashboard.json` requires a new image.

Do not use an unreviewed community Docker image merely because its name looks relevant. Build from this repository or a controlled fork so the source and licence are auditable.

## Option 4: independent Cloudflare Worker deployment

This is the closest match to the application's primary runtime. The production build emits an ESM Worker entry point with a default `fetch` handler.

The repository's `.openai/hosting.json` belongs to the current Sites deployment. It is not a substitute for an independently configured Cloudflare account, Worker name, routes, domains or provider credentials.

An independent Worker deployment therefore requires:

1. your own Cloudflare account and Worker project;
2. a reviewed Worker configuration for the generated `dist` artifact;
3. the provider's current authentication and deployment procedure;
4. any required asset bindings; and
5. a separate custom-domain and rollback plan.

Use the current [Vinext documentation](https://github.com/cloudflare/vinext) and Cloudflare's official Worker deployment documentation when creating that provider-specific configuration. Do not copy credentials or account identifiers into the repository.

## Acceptance checks

Before directing users to the third-party deployment, verify:

- the page loads over HTTPS;
- the header reports **City feed connected**;
- the permit total is not unexpectedly zero;
- the City data-updated and dashboard-refreshed labels remain distinct;
- address and permit search work;
- year and status filters work;
- Calgary streets and the configured map attribution are visible;
- **Fit visible permits** frames the filtered results;
- a map point can select a permit;
- the official dataset link opens the configured dataset;
- a known `DPYYYY-number` record produces a DMap link;
- an appeal-package button appears only for a known public exact match;
- the community-scope disclaimer names the configured community and filter; and
- mobile-width content remains readable.

An apparent success page with an empty feed is not a successful deployment.

## Custom domain and HTTPS

1. Make the provider-generated address work first.
2. Add the custom domain through the provider.
3. create the DNS record the provider specifies;
4. wait for the provider to issue or validate the TLS certificate;
5. set `VINEXT_TRUSTED_HOSTS` to the final public hostname; and
6. retest official links and server-rendered pages over HTTPS.

Do not disable TLS verification to work around a certificate problem.

## Updating a third-party deployment

Use immutable commits and keep a known-good version available for rollback.

Recommended sequence:

1. update the repository or fork;
2. review changes to `config/dashboard.json`;
3. run `npm test`;
4. deploy the new commit;
5. perform the acceptance checks; and
6. roll back to the previous commit if the feed or rendering fails.

Avoid configuring production to redeploy every unreviewed commit automatically. Documentation-only changes are low risk; feed, dependency and runtime changes are not.

## Monitoring and operations

Monitor at least:

- HTTP availability of `/`;
- application errors and restarts;
- response time;
- the **City feed unavailable** state;
- unexpected zero-record responses; and
- certificate expiry when the provider does not manage renewal automatically.

The dashboard's City timestamps help readers assess freshness, but they are not a substitute for external uptime monitoring.

## Cost, data and licence considerations

- Review bandwidth, build-minute, request and log-retention charges before selecting a provider.
- Confirm the provider permits outbound requests to all configured public City sources.
- Do not send City data to an additional analytics or logging service without reviewing its privacy and retention settings.
- The software uses the PolyForm Noncommercial License 1.0.0. Noncommercial hosting, modification and redistribution are permitted only under its terms; commercial use requires separate written permission.
- City of Calgary data remains subject to the Open Government Licence – City of Calgary.
