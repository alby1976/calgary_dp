# Using the dashboard

This guide explains the dashboard in plain language. The dashboard is an independent view of City of Calgary open data, not an official notice. Verify deadlines, decisions and public documents with the City.

## The coordinated workspace

On a desktop-sized screen, the main workspace keeps three areas together:

1. **Permit explorer — left:** search and filter the permit table, then choose a record.
2. **Two linked maps — centre:** the community activity pattern gives an overview; the street-level map gives granular geographic context.
3. **Linked selection — right:** shows the readable details, dates, City links and any recorded SDAB appeal for the selected permit.

Each area has its own scrolling region where needed, so you can compare the list, maps and details without repeatedly moving up and down the whole page. On screens narrower than 960 pixels, the workspace becomes one column for legibility.

## Select and follow a permit

Choose a permit in any of these ways:

- select its row in the permit explorer;
- select its point in the community activity pattern; or
- select its marker in the street-level map.

The same permit then becomes selected everywhere: its row is selected, both map points are highlighted, the street map centres on it, and the right-hand details update. Changing a filter may remove that permit; when this happens, the first visible result becomes the new shared selection.

Both maps represent every filtered record that has valid City-published coordinates. Each point corresponds to one permit record; the dashboard does not use numbered clusters. Points at the same or very close coordinates can overlap visually, so zoom in to separate nearby locations and use the permit explorer when records share an address.

The visible dots stay compact so the maps remain readable, but each point has a transparent 44×44 CSS-pixel pointer and touch target. Legend entries and map controls also provide at least a 44-pixel target. This larger interactive area does not represent a parcel, distance or development footprint; it only makes the underlying permit point easier to select.

Both maps report **X of Y permit points in this view**. **Y** is the total number of filtered permit records with valid coordinates. **X** is the number whose coordinates fall inside that map's current window. The count recalculates independently after you pan or zoom either map: zooming in normally reduces X and zooming out normally increases it. Use **Fit filtered permits** on either map to return to the full filtered result set. Map locations are not survey or parcel boundaries.

## Search and filters

- Search accepts an address, permit number, applicant or description.
- Year and status filters narrow the same record set used by the table and both maps.
- **Appealed to SDAB** shows only permits with an appeal number recorded in the City feed.
- **Clear filters** restores the full Varsity result set.

## Status colour guide

Hover over, focus or tap a legend colour to see its plain-language explanation. Select map points to open their permit records; use the permit explorer as the complete keyboard-selection path.

Ordinary instructions and explanations use 14–16-pixel text. Smaller text is limited to short supporting details such as dates, source labels and compact metadata. Browser zoom remains available when a larger reading size is needed.

- **Active / under review:** the City record indicates that review or processing is still underway.
- **Green — approved / released:** the City record indicates approval or release. This does not replace the permit conditions or official file.
- **Red — refused / cancelled:** the City record indicates refusal, cancellation, expiry or another configured closed outcome.
- **Grey — other status:** the City's wording did not match one of the configured groups. Read the exact status in the selected permit details.

## Development plans and appeals

The dashboard is designed as an early-warning signal. A permit may appear in Calgary Open Data before its application page or plans appear in Calgary's Development Map (DMap). In that situation, the permit tells you which file to watch; it does not mean DMap is ready or guarantee when Calgary will publish the page or plans.

Use **Try permit-specific DMap link** as a shortcut, then use **Double-check Calgary's official Development Map** to verify the permit number at [developmentmap.calgary.ca](https://developmentmap.calgary.ca/). The shortcut is only a convenience and may not resolve correctly. If DMap has not published the record yet, check again later. Calgary controls whether plans are public and how long they remain available.

Before relying on a record for comments, appeals, plans or deadlines, verify it on Calgary's official Development Map and, where necessary, with the assigned City planner or official notice.

For a permit with an SDAB appeal number, the details panel may include:

- a currently public Calgary appeal package;
- a readable decision record created from Calgary Open Data;
- the human-readable Calgary dataset page and the original JSON response for verification;
- a citation-specific CanLII decision link and a browse-all tribunal link; and
- optional CanLII catalogue metadata when the server has an authorized API key.

The citation-specific CanLII link uses a stable decision ID such as `2025 CGYSDAB 120`. It does not store CanLII's temporary `searchId`, which belongs to one browser search session and is unsuitable for a permanent dashboard link. CanLII metadata describes the catalogue record; it does not include the written decision text.

A missing plan, package or CanLII result does not prove that no document exists. Use the official Calgary source links or contact SDAB when the information is time-sensitive.

## Data dates and community scope

The header distinguishes two times:

- **City data updated:** the update time reported by Calgary's dataset metadata, when available.
- **Dashboard refreshed:** when this deployment most recently fetched its copy.

The default feed and shareable JSON query are filtered to the City community value `VARSITY`. A fork for another community must change `feed.filter.value` to the exact City value and rebuild the dashboard. See the [configuration guide](CONFIGURATION.md).
