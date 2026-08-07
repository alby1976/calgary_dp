# Troubleshooting

Start with the symptom below. Avoid changing several settings at once; that tends to turn one useful error into three mysterious ones.

## Quick checks

From the project directory:

```bash
npm ci
npm test
```

For a self-hosted service:

```bash
sudo systemctl status calgary-dp
journalctl -u calgary-dp -n 100 --no-pager
```

## The build reports a configuration error

Read the setting name in the error and inspect [`config/dashboard.json`](../config/dashboard.json).

Common causes:

- missing comma, extra trailing comma or invalid JSON quotes;
- non-HTTPS URL;
- misspelled or missing `fieldMap` key;
- invalid Socrata field name;
- zero, negative or non-integer limit/timeout/refresh value;
- sort direction other than `ASC` or `DESC`; or
- missing `{permitNumber}` in the DMap template;
- missing `{z}`, `{x}` or `{y}` in the map tile template; or
- an invalid map zoom range.

After correcting the JSON, rerun `npm test`.

## The page says the City feed is unavailable

Check:

1. `feed.baseUrl` is `https://data.calgary.ca` unless the official source has changed.
2. `resourceDatasetId` still identifies a GeoJSON-accessible dataset.
3. Every field in `selectFields` still exists.
4. Every `fieldMap` value still exists in the City schema.
5. The host server can make outbound HTTPS requests to `data.calgary.ca`.
6. `requestTimeoutMilliseconds` is reasonable for the server's connection.

Do not remove the community filter merely to make the request return data. That can turn a community dashboard into a citywide feed without making the change obvious to readers.

## The dashboard loads but shows zero permits

The feed may be working while the filter matches nothing.

Check:

- `feed.filter.field` is the City's community field;
- `feed.filter.value` exactly matches Calgary's published community value;
- the shareable filtered JSON-query link on the dashboard returns records; and
- the configured dataset actually contains the selected community.

Display capitalization is controlled separately by `site.communityDisplayName`.

## The City update time says unavailable

Permit records and metadata are separate requests. If permits appear normally, the metadata endpoint may be unavailable or may no longer provide `dataUpdatedAt`.

Confirm `resourceDatasetId`, then inspect the server log. Do not replace the City timestamp with the dashboard refresh time; they describe different events.

## Development plans link is missing

The permit-specific link appears only when the permit number matches `DPYYYY-number`, such as `DP2025-05349`.

If the button appears but DMap has no plans, Calgary may not currently publish them. The dashboard cannot make a non-public document public.

## Public SDAB appeal package is missing

The package button requires all of the following:

- the permit feed includes an appeal number;
- the number matches the expected `YYYY-number` form;
- Calgary's configured active-appeals page lists the same number;
- that listing has a public report link; and
- the report link uses HTTPS and the configured `appealReportsHost`.

Calgary removes concluded appeals from the Active Appeals page, so an appeal can retain a decision and appeal number after its package link disappears. The dashboard always renders a readable card for a permit with an appeal number. It prefers Calgary's matching SDAB Decisions JSON record; if that lookup returns no match, it uses the appeal fields already present in the Development Permits feed. The source line above the card identifies which source was used. Use **View original Calgary JSON source** to inspect the unformatted response, and expand the plain-language guide to understand each label and the `Not reported` or `—` markers. The SDAB contact link remains available when the public package is missing. A missing package link does not prove that no document exists or ever existed.

## A CanLII decision search returns no result

CanLII publication can follow Calgary's initial outcome record. Confirm that the dashboard derived the expected citation—for example, appeal `2025-0118` becomes `2025 CGYSDAB 118`—then inspect `links.canliiDecisionSearchUrlTemplate`.

The template should contain `type=decision`, `id={citation}`, `origType=decision` and `origCcId=absdab`. Remove any copied `searchId`: it is session-specific and can expire or point to another browser's search context. Do not change the stable `id=` lookup back to a free-text `text=` search. Then try **Browse all Calgary SDAB decisions on CanLII**. If the decision is still absent, use Calgary Open Data and contact SDAB. The dashboard deliberately does not scrape CanLII as a fallback because CanLII prohibits systematic downloading.

## The CanLII metadata card says the key is not installed

The authorized metadata flow is optional. Add `CANLII_API_KEY` through the host's protected production-secret control and redeploy. Do not place it in `config/dashboard.json`, GitHub, a public environment variable or browser JavaScript.

If the key is installed but metadata remains unavailable, check:

- the production deployment received the secret after the most recent redeploy;
- the `DB` D1 binding and migration are active;
- outbound HTTPS to `api.canlii.org` is allowed;
- the appeal number matches `YYYY-NNNN`; and
- the configured database remains `cgysdab`.

`Not found` means the API returned no exact case at the expected identifier; it does not prove that no decision exists. `Rate limited` means the dashboard stopped before exceeding the configured rolling allowance. Existing cached metadata and public search links remain available in either case.

## The street map is blank but permit details load

Check the browser developer console and network panel for failed tile requests. Confirm:

- `map.tileUrlTemplate` is a valid HTTPS template containing `{z}`, `{x}` and `{y}`;
- the visitor's network can reach the configured tile host;
- the tile provider allows requests from the dashboard's public domain; and
- attribution remains visible and complies with the provider's terms.

The default OpenStreetMap service is intended for normal interactive use, not bulk tile downloading. Review its [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) if traffic or usage patterns change.

## Permit points look misplaced or are missing

Confirm that the configured latitude and longitude mappings are correct. Then adjust `map.fallbackBounds` for the selected community.

Both the overview and street map only plot records with valid coordinates from the City feed. They do not geocode records with missing coordinates. The overview is intentionally simplified; use the street map for granular context. A marker position should not be used for lot-line or parcel-level conclusions; verify the address and official City file.

## The two visualizations show different selections

They are designed to share one selected permit. Selecting a permit row or a point in either view should enlarge or outline the matching point in both maps, centre the street map and update the right-hand details. If a filter removes that permit, all views select the first remaining visible result. Refresh the page if an older cached script leaves the views out of sync.

## The workspace is stacked instead of three columns

This is expected below the 960-pixel responsive breakpoint. The explorer, linked maps and selected details move into one column so controls and text remain usable on a narrow screen. On desktop, check the browser window width and zoom level before treating the stacked layout as a deployment problem. No hosting environment variable controls this behaviour.

## Status totals look wrong

Compare the exact City status wording with the fragments under `statuses.active`, `statuses.approved` and `statuses.closed`.

Matching is case-insensitive and the first group wins. Use specific fragments when a broad word could match several meanings.

## A configuration change does not appear

The JSON file is build-time configuration. A running production process will not automatically reread it.

For local development, restart the development server if hot reload did not detect the change. For production:

```bash
npm test
sudo systemctl restart calgary-dp
```

For a hosted worker, create and publish a new deployment.

## Self-hosted page is unreachable

Check in this order:

1. `systemctl status calgary-dp` reports the Node.js service as running.
2. `curl http://127.0.0.1:3000` works on the server.
3. `HOST=127.0.0.1` and `PORT=3000` match the reverse-proxy target.
4. The reverse-proxy configuration passes its syntax check.
5. DNS points to the correct server.
6. Ports 80 and 443 are allowed through the firewall.
7. The HTTPS certificate is valid for the dashboard hostname.

Keep port 3000 bound to loopback when Caddy or Nginx is the public entry point.

## A managed host reports a failed health check or 502 error

Check:

1. the service type is a persistent web service rather than a static deployment;
2. the start command is `npm run start`;
3. `HOST` is `0.0.0.0`;
4. the application uses the `PORT` assigned by the provider;
5. the provider uses Node.js 22.13 or newer on Linux;
6. the build command completed `npm ci` and `npm test`; and
7. the health-check path is `/`.

If the process starts but server-rendered behaviour fails, treat it as a Node/Vinext compatibility issue. The Worker runtime is the primary production target. See the [third-party hosting guide](THIRD-PARTY-HOSTING.md).

## A third-party deployment loads but has no City data

Confirm the provider allows outbound DNS and HTTPS connections to `data.calgary.ca`. Then check request timeouts, the configured dataset identifiers and the exact community filter.

Do not accept an empty dashboard as proof that deployment succeeded. Use the [third-party acceptance checks](THIRD-PARTY-HOSTING.md#acceptance-checks).

## Safe recovery after an update

If new source fails validation, do not restart the working production service. Keep the last working process running, correct the source, rerun `npm test`, and restart only after validation passes.
