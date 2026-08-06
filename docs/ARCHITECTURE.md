# Architecture and data flow

Varsity Development Watch is a server-rendered dashboard with a small client-side exploration layer. It has no application database and currently requires no API key.

## Data flow

```text
config/dashboard.json
        |
        v
validation + URL construction + field mapping
        |
        +----> Calgary GeoJSON permit feed
        +----> Calgary dataset metadata
        +----> Calgary SDAB active-appeals page
        |
        v
normalized Permit records
        |
        v
server-rendered page -> client-side search, filters, map and charts
```

## Responsibilities by file

| File | Responsibility |
| --- | --- |
| `config/dashboard.json` | Community, feed, links, statuses and map configuration |
| `lib/dashboard-config.ts` | Runtime validation, Socrata URL construction and City-field normalization |
| `lib/permit.ts` | Stable internal permit type used by server and client code |
| `app/page.tsx` | Server-side fetching, data freshness and appeal-package enrichment |
| `app/dashboard.tsx` | Interactive search, filters, simplified coordinate overview, charts and record details |
| `app/permit-map.tsx` | MapLibre street basemap, permit marker layers, fit-to-results and map interaction |
| `app/layout.tsx` | Metadata derived from the site configuration |
| `tests/dashboard-config.test.mjs` | Configuration structure and integration-template checks |
| `tests/rendered-html.test.mjs` | Production worker and rendered-page checks |
| `docs/THIRD-PARTY-HOSTING.md` | Provider-neutral hosting, verification, monitoring and rollback guidance |

## Server-side data loading

`app/page.tsx` makes three independent requests:

1. **Permit feed:** the filtered City GeoJSON source.
2. **Dataset metadata:** supplies the City's `dataUpdatedAt` timestamp when available.
3. **Active appeals:** supplies exact-match links to public SDAB report packages.

The requests use separate refresh and timeout settings from the configuration. `Promise.allSettled` prevents an optional source from taking down the whole dashboard.

### Failure behaviour

| Failure | Dashboard behaviour |
| --- | --- |
| Permit feed fails | Shows the feed-unavailable notice and no permit records |
| Metadata fails | Permit data remains available; City update time shows as unavailable |
| Appeals page fails | Permit data remains available; public appeal-package buttons are omitted |
| A DMap permit URL cannot be formed | General permit details remain; the plans button is omitted |

This distinction matters: missing optional links are not evidence that no plans or appeal documents exist. They mean the dashboard could not establish a valid public link.

## Configuration adapter

The City schema is treated as an external contract that can change. The `fieldMap` translates City field names into the stable internal `Permit` model. The dashboard therefore reads `permitnum`, `statuscurrent` and other internal properties without knowing which external field supplied them.

The adapter also:

- validates HTTPS sources and Socrata identifiers;
- escapes the configured community value before building queries;
- creates the filtered GeoJSON and shareable JSON URLs;
- deduplicates selected fields;
- fills missing latitude and longitude from GeoJSON geometry; and
- exposes only browser-safe configuration to the client component.

## Server and client boundary

External City requests run on the server. The client receives normalized permit records and a limited public configuration object. Browser-side code handles only presentation and local interactions:

- text search;
- year and status filters;
- selected permit state;
- chart calculations and map selection; and
- show-more behaviour.

No user search or filter state is currently stored on the server.

## Street map

`app/permit-map.tsx` renders a client-side MapLibre map. The default configuration uses ordinary browser requests to OpenStreetMap raster tiles and displays the required attribution. It does not bulk-download or prefetch tiles.

Filtered permit coordinates appear in a simplified overview plot for cluster recognition and become GeoJSON point features in MapLibre for street-level context. Both visualizations render the same filtered point set and share one selected permit state. Selecting either type of marker highlights the corresponding point in both views and updates the shared permit-information panel. If a filter removes the selected permit, both views fall back to the first visible result. **Fit visible permits** returns the street-map viewport to the filtered results. If the filtered records have no valid coordinates, both views use the configured community bounds.

The City permit feed remains the source of marker positions. The basemap is contextual cartography and does not change or geocode City records.

## Public-document links

### Development plans

A permit-specific DMap URL is created only for permit numbers matching the expected `DPYYYY-number` form. DMap controls whether submitted plans remain publicly visible.

### SDAB appeal packages

The server looks for exact appeal numbers in Calgary's active-appeals page and accepts report links only from the configured HTTPS host. A package button is shown only when both the permit record and Calgary page supply a matching appeal number.

## Data interpretation boundary

The dashboard is an independent view of municipal open data, not an official notice. It intentionally keeps separate labels for:

- when the City says the dataset was updated; and
- when the dashboard last refreshed its own copy.

For comment periods, appeal deadlines and statutory decisions, users must verify the official City record.

## Deployment model

The project can run as:

- a Cloudflare-compatible worker through the hosted Sites deployment; or
- a separately configured Cloudflare-compatible Worker;
- a managed or containerized persistent Node.js service after compatibility testing; or
- a persistent Node.js service behind Caddy or Nginx on a Linux VPS.

Cloudflare Workers are Vinext's primary production target. The `vinext start` Node server is less complete and should be treated as a compatibility deployment, not an automatic equivalent.

All deployment modes read the same build-time JSON configuration. Configuration changes require a new build and deployment or a service restart using a newly built artifact. See the [third-party hosting guide](THIRD-PARTY-HOSTING.md) for requirements and acceptance checks.
