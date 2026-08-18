# Architecture and data flow

Varsity Development Watch is a server-rendered dashboard with a small client-side exploration layer. Calgary data needs no key. Optional authorized CanLII metadata uses a server-side key and a small D1 database for caching and rate-limit coordination.

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
server-rendered page -> client-side coordinated workspace
                         |       |             |
                      explorer  two maps  selected details
                         +------- shared selection -------+
                                      |
                                      +----> selected appeal -> server-only CanLII endpoint
                                                                  |
                                                                  +----> D1 cache and request queue
```

## Responsibilities by file

| File | Responsibility |
| --- | --- |
| `config/dashboard.json` | Community, feed, links, statuses and map configuration |
| `lib/dashboard-config.ts` | Runtime validation, Socrata URL construction and City-field normalization |
| `lib/permit.ts` | Stable internal permit type used by server and client code |
| `lib/canlii.ts` | Appeal-to-case mapping and strict CanLII metadata normalization |
| `app/page.tsx` | Server-side fetching, data freshness and appeal-package enrichment |
| `app/dashboard.tsx` | Coordinated explorer, linked map pair, shared selection, charts and record details |
| `app/permit-map.tsx` | MapLibre overview and street views, individual canvas point and hit layers, fit-to-results and map interaction |
| `app/layout.tsx` | Metadata derived from the site configuration |
| `worker/index.ts` | Server-only CanLII endpoint, durable cache and global rate-limit coordination |
| `db/schema.ts` | D1 cache, lease and rolling request-log tables |
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
| Appeals page fails or a concluded appeal is removed | Permit data remains available; exact decision-record and SDAB-contact fallbacks replace the package button |
| A Calgary Development Map (DMap) permit URL cannot be formed | General permit details remain; the plans button is omitted |

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
- multi-select exclusions for year, permit status, land-use district, permitted/discretionary and appeal status;
- selected permit state;
- chart calculations and map selection; and
- show-more behaviour.

No user search or filter state is stored on the server. When a user chooses **Set current as default**, the dashboard writes a versioned JSON snapshot to that browser's `localStorage`. A guarded client-side effect validates and restores the snapshot after hydration. The saved value remains device- and browser-local until it is replaced, removed in the dashboard or deleted with the site's browser data.

## Coordinated workspace

The desktop interface is a three-pane workspace: the permit explorer is on the left, both linked maps are in the centre, and selected-permit details are on the right. The list and details panes scroll independently. This keeps the comparison context visible and reduces full-page navigation.

One client-side selection coordinates the permit row, both MapLibre point layers and the details panel. Before a user makes an explicit selection, the effective selected permit is the first record in the date-sorted filtered results. The street map receives that effective permit as both its highlighted and focused record, so it centres correctly after MapLibre finishes loading instead of waiting for a second click. A selection event from any of the three entry points updates all four presentations. The same filtered array drives the explorer and both maps, preventing one visualization from silently showing a different subset. Below the 960-pixel breakpoint, CSS changes the workspace to a one-column document flow while preserving the same selection state and source order.

## Street map

`app/permit-map.tsx` renders a client-side MapLibre map. The default configuration uses ordinary browser requests to OpenStreetMap raster tiles and displays the required attribution. It does not bulk-download or prefetch tiles.

Every filtered permit with valid City coordinates is supplied to both MapLibre visualizations; neither view truncates or clusters the data. `featureCollection()` creates exactly one GeoJSON point feature for each permit record. Both maps render that same collection as individual status-coloured circles, while a separate outline layer identifies the shared selected permit.

Each record also participates in a transparent hit layer with a 22-pixel radius, producing a 44×44 CSS-pixel pointer and touch target around the smaller visual circle. The enlarged hit area is an interaction aid only: it does not encode parcel size, uncertainty or development extent. Legend entries, MapLibre controls and the fit-to-results action use the same 44-pixel minimum target. Ordinary explanatory copy is 14–16 pixels; smaller typography is restricted to concise secondary metadata.

The legend identifies the shared status colours and opens a plain-language guide on hover, focus or tap. The permit explorer remains the complete keyboard-selection path so the canvas does not add hundreds of map stops to the tab sequence. Both visualizations share one selected permit state. Selecting a point highlights the corresponding record in both views, centres the overview at zoom 13 and centres the street map at the closer of its current zoom or a property-context target capped at zoom 18. This rule never zooms out a street view the user has already enlarged. The shared permit-information panel updates at the same time. If a filter removes the selected permit, both views fall back to the first visible result and the street map centres on that replacement.

Every categorical filter starts fully selected and stores only exclusions. Year, land-use-district and permitted/discretionary options are generated from the loaded records; blank district and classification values use an internal sentinel displayed as **Not reported**. Permit-status options use the four dashboard status groups, and appeal status distinguishes records with and without a recorded SDAB number. A permit is hidden when its year, grouped status, permitted/discretionary value or appeal status is excluded, or when any value in its semicolon-separated district field is excluded. The year chart and status cards read and change the same exclusion state as their checkbox menus. All filters combine and reset through **Clear filters**.

The selected-permit panel keeps field help on the main page. `PERMIT_FIELD_DEFINITIONS` supplies one plain-language definition for every displayed permit field. The land-use value glossary is derived from the loaded `landusedistrict` and `landusedistrictdescription` pairs. The permitted/discretionary and current-status glossaries combine distinct loaded values with cautious explanations and fallbacks for future unknown values. Each 44-pixel **?** button opens the native `<details>` guide, expands any matching value glossary and moves focus to the definition. The guide's local search matches both field definitions and individual values. The full details article is not a live region. A separate concise status message announces the newly selected permit so opening or searching the guide does not cause assistive technology to reread the entire record.

Each map independently counts the permit coordinates inside its current MapLibre bounds on load and after every pan or zoom. Both labels report **permit points in view / total filtered permit points**. Zooming in normally reduces the numerator; zooming out normally increases it. **Fit filtered permits** returns either viewport to the complete filtered result set. If the filtered records have no valid coordinates, both views use the configured community bounds.

The City permit feed remains the source of marker positions. The basemap is contextual cartography and does not change or geocode City records.

## Public-document links

### Development plans

A permit-specific DMap URL is created only for permit numbers matching the expected `DPYYYY-number` form. It is presented as a convenience link, alongside the general [Calgary Development Map](https://developmentmap.calgary.ca/) for authoritative manual verification. The Open Data record can precede publication of the corresponding DMap page or plans, so neither the generated URL nor the dashboard proves that material is already available. DMap controls whether submitted plans become or remain publicly visible.

### SDAB appeal packages

The server looks for exact appeal numbers in Calgary's active-appeals page and accepts report links only from the configured HTTPS host. It also fetches the matching Calgary Open Data JSON decision record, maps the municipal field names into a typed appeal record, and sends that normalized record to the dashboard. The dashboard renders a readable decision card for every permit with an appeal number. When the separate SDAB JSON record is unavailable, the card fails softly to the appeal fields already present in the Development Permits feed and identifies that source. The collapsible field guide explains every displayed value and missing-value marker. Links to both Calgary's human-readable dataset page and the original JSON response remain available for verification. Calgary may remove concluded appeals from the active page; the permit-feed fallback and SDAB contact link remain available.

For past written reasons, the client converts an appeal number such as `2025-0118` into the CanLII citation `2025 CGYSDAB 118`. The citation-specific link puts that value in CanLII's stable `id=` decision parameter, alongside `type=decision`, `origType=decision` and `origCcId=absdab`. It deliberately omits session-generated `searchId` values. The application also provides the Calgary SDAB database link. It does not request, scrape, cache or reproduce CanLII decision documents: CanLII's terms prohibit systematic downloading and direct users seeking automated retrieval to originating bodies or authorized channels.

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

MapLibre's browser worker is split across `maplibre-gl-worker.mjs` and
`maplibre-gl-shared.mjs`. The first module imports the second from the same
`/assets/` directory. `scripts/build-verified.sh` copies both dependency-owned
files into `dist/client/assets`, and `scripts/validate-artifact.sh` rejects an
incomplete artifact. Packaging only the entry worker produces a browser 404 for
the shared module and prevents both maps from rendering permit points even when
the City feed and coordinates are valid.

All deployment modes read the same build-time JSON configuration. Configuration changes require a new build and deployment or a service restart using a newly built artifact. See the [third-party hosting guide](THIRD-PARTY-HOSTING.md) for requirements and acceptance checks.
## CanLII metadata flow

CanLII enrichment is deliberately separate from the Calgary feed:

1. The browser detects that the selected permit has a normalized `YYYY-NNNN` SDAB number.
2. It calls the same-origin `/api/canlii-metadata` endpoint; the API key never enters browser code.
3. The Worker checks the durable D1 cache before considering an outbound request.
4. A shared D1 lease allows only one CanLII request at a time and enforces at least 500 milliseconds between request starts.
5. A rolling 24-hour request log stops new calls at 5,000 queries.
6. Successful metadata is cached for 24 hours, a missing decision for 6 hours, and temporary failures for 5 minutes.
7. The dashboard renders the catalogue fields and the official CanLII URL. It never downloads, stores or republishes the written decision.

The cache and rate-state tables contain only decision metadata, appeal identifiers, timestamps and request counts. They do not contain the CanLII API key or decision text. When the key is absent, the endpoint reports `not_configured` and the existing citation-search link remains available.
