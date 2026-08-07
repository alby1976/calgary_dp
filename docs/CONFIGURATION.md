# Configuration guide

The dashboard is configured through [`config/dashboard.json`](../config/dashboard.json). Community identity, City feed details, field mappings, refresh behaviour, external links, status categories and map settings can all be changed without editing the React components.

Configuration is read and validated when the application starts or builds. It is not a live administration screen: after changing the JSON file, rebuild and restart or redeploy the application.

## Safe change workflow

1. Copy or back up the current configuration.
2. Change one logical section at a time.
3. Keep the file valid JSON. JSON does not allow comments or trailing commas.
4. Run `npm test`.
5. Review the dashboard title, total count, map, status totals and filtered-query link.
6. Deploy only after the checks pass.

## Configuration reference

### `site`

| Setting | Purpose | Varsity value |
| --- | --- | --- |
| `name` | Browser title, header and footer name | `Varsity Development Watch` |
| `brandMark` | Short mark in the header badge | `V` |
| `eyebrow` | Small header description | `Community planning intelligence` |
| `communityDisplayName` | Human-readable community name used throughout the page | `Varsity` |
| `wardLabel` | Ward displayed in the hero area | `Ward 1` |
| `cityName` | Municipality displayed in the hero area | `Calgary` |
| `heroHeading` | First line of the main heading | `See what is changing.` |
| `heroEmphasis` | Emphasized second line of the main heading | Current project wording |
| `description` | Introductory description and metadata source | Current project description |

### `feed`

| Setting | Purpose |
| --- | --- |
| `baseUrl` | HTTPS origin of the Socrata open-data service |
| `resourceDatasetId` | Resource identifier used by the GeoJSON feed and metadata endpoint |
| `queryViewId` | API v3 view identifier used for the shareable JSON-query URL |
| `datasetPageUrl` | Official human-readable dataset page |
| `filter.field` | City field used to restrict the feed, normally `communityname` |
| `filter.value` | Exact City value for the selected community |
| `order.field` | City field used to sort records |
| `order.direction` | `ASC` or `DESC` |
| `limit` | Maximum number of records requested |
| `refreshSeconds` | Cache/revalidation interval for permit and metadata requests |
| `requestTimeoutMilliseconds` | Maximum wait for each permit or metadata request |
| `selectFields` | City fields requested from the feed and included in the public JSON query |
| `fieldMap` | Maps stable dashboard concepts to current City field names |

`resourceDatasetId` and `queryViewId` are separate because Calgary exposes the current feed and the API v3 query through different identifiers. Do not assume they are interchangeable.

### `fieldMap`

The left side of each mapping is an internal dashboard concept. The right side is the field published by the City.

For example:

```json
{
  "fieldMap": {
    "permitNumber": "permitnum",
    "status": "statuscurrent",
    "appliedDate": "applieddate"
  }
}
```

Do not rename the keys on the left. If Calgary changes a field name, update only the corresponding value on the right and add the new City field to `selectFields`.

Every configured mapping is automatically added to the actual GeoJSON and JSON query field selection, even if it was accidentally omitted from `selectFields`. Keeping both lists aligned still makes the configuration easier to audit.

### `links`

| Setting | Purpose |
| --- | --- |
| `developmentMapUrl` | General Calgary Development Map link |
| `developmentApplicationUrlTemplate` | Permit-specific DMap template; must contain `{permitNumber}` |
| `activeAppealsUrl` | Calgary SDAB active-appeals page inspected for public packages |
| `appealReportsHost` | Only this HTTPS host is accepted for public appeal-package links |
| `decisionRecordUrlTemplate` | Human-readable Calgary Open Data dataset-page template filtered by appeal number; must contain `{appealNumber}` |
| `appealContactUrl` | Official SDAB contact page used when a report package is not currently linked |
| `appealRefreshSeconds` | Cache/revalidation interval for the appeals page |
| `appealRequestTimeoutMilliseconds` | Maximum wait for the appeals page |

The allowed appeal host is deliberately configured separately. It prevents a changed or malformed City page from silently inserting an unrelated external link.

### `statuses`

Each list contains case-insensitive words or fragments used to classify City status text:

- `active`: active or under-review records
- `approved`: approved or released records
- `closed`: refused, cancelled or expired records

The first matching group wins. A status matching none of the lists appears under **Other status**.

### `map`

| Setting | Purpose |
| --- | --- |
| `tileUrlTemplate` | HTTPS raster-tile template; it must contain `{z}`, `{x}` and `{y}` |
| `attributionLabel` | Visible credit shown on the map |
| `attributionUrl` | HTTPS link explaining the map-data attribution |
| `issueUrl` | HTTPS link for reporting a basemap problem |
| `minZoom` | Furthest-out zoom allowed |
| `maxZoom` | Closest-in zoom allowed; must be greater than `minZoom` and no more than 22 |
| `overviewLabels` | Contextual road labels on the simplified overview; each uses `text` and a supported `className` from `road-one` through `road-three` |
| `fallbackBounds` | Minimum and maximum latitude and longitude used when no visible permit has coordinates |

The default uses the standard OpenStreetMap tile service. Keep its visible attribution, do not bulk-download or prefetch tiles, and review the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/) before operating a high-traffic or commercial deployment. A custom provider must allow browser use from the dashboard's public domain.

Both geographic views use the latitude and longitude published in the City feed. The simplified overview helps reveal clusters; the street map supplies granular location context. Neither is a parcel or survey map. Addresses and official City records remain authoritative.

## Change to another Calgary community

At minimum, update:

```json
{
  "site": {
    "name": "Example Development Watch",
    "brandMark": "E",
    "communityDisplayName": "Example",
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

Then update the map fallback bounds and overview labels. Use the exact `communityname` value published by Calgary Open Data; the display name may use normal capitalization.

The application automatically generates:

- the filtered GeoJSON request used by the dashboard;
- the metadata request used for the City update timestamp; and
- the shareable API v3 JSON query shown in the scope disclaimer.

## Respond to a City feed change

### A field was renamed

1. Identify the replacement City field.
2. Change the corresponding `fieldMap` value.
3. Add the replacement field to `selectFields`.
4. Remove the retired field from `selectFields` only after confirming nothing else uses it.
5. Run `npm test` and inspect representative permits.

### The dataset or API view changed

1. Confirm the new IDs on the official Calgary dataset page.
2. Update `resourceDatasetId` and/or `queryViewId` as applicable.
3. Update `datasetPageUrl`.
4. Compare the new schema with every `fieldMap` value.
5. Confirm the filter still uses the intended field and exact community value.
6. Run `npm test` and inspect the generated filtered-query link.

### The City feed is slow

Increase `requestTimeoutMilliseconds` cautiously. A very long timeout can make a failed upstream service appear to freeze the dashboard. The current behaviour intentionally falls back to an unavailable-feed notice instead of waiting forever.

## Validation rules

The application rejects configuration when:

- a configured URL is not valid HTTPS;
- a Socrata field name contains invalid characters;
- a limit, refresh interval or timeout is not a positive integer;
- sort direction is not `ASC` or `DESC`;
- the DMap template lacks `{permitNumber}`;
- the map tile template lacks `{z}`, `{x}` or `{y}`;
- a map URL is not valid HTTPS;
- map zoom values are invalid; or
- a required field mapping is missing.

Configuration validation catches structural errors. It cannot prove that Calgary still publishes a particular dataset, field, community value or public document. Those require a live-data check.
