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

When the dashboard first opens, the first permit in the latest-results list is already selected and the street map centres on it as soon as the map is ready. The same permit then becomes selected everywhere: its row is selected, both map points are highlighted, the street map centres on it and zooms to close property-level context, and the right-hand details update. If a map-selected permit is older than the explorer's latest 12 records, the dashboard pins that permit above the latest 12 and scrolls its highlighted row into view without changing your filters. Changing a filter may remove that permit; when this happens, the first visible result becomes the new shared selection and the street map centres on that replacement.

Both maps represent every filtered record that has valid City-published coordinates. Each point corresponds to one permit record; the dashboard does not use numbered clusters. Points at the same or very close coordinates can overlap visually, so zoom in to separate nearby locations and use the permit explorer when records share an address.

The visible dots stay compact so the maps remain readable, but each point has a transparent 44×44 CSS-pixel pointer and touch target. Legend entries and map controls also provide at least a 44-pixel target. This larger interactive area does not represent a parcel, distance or development footprint; it only makes the underlying permit point easier to select.

Both maps report **X of Y permit points in this view**. **Y** is the total number of filtered permit records with valid coordinates. **X** is the number whose coordinates fall inside that map's current window. The count recalculates independently after you pan or zoom either map: zooming in normally reduces X and zooming out normally increases it. Use **Fit filtered permits** on either map to return to the full filtered result set. Map locations are not survey or parcel boundaries.

## Search and filters

- Search accepts an address, permit number, applicant, description, proposed use, land-use district, decision or SDAB information.
- **Years**, **Permit statuses**, **Land-use districts**, **Permitted / discretionary** and **Appeal statuses** are all multi-select menus. Every value starts selected. Open a menu and uncheck as many values as you do not want to see; its selected-count summary updates immediately. **Select all** restores every value in that menu, while **Deselect all** removes every listed value.
- The year bars and status-summary cards use the same selections as their menus. Clicking one hides or restores that value. If a permit lists several semicolon-separated districts, deselecting any one of those districts hides the permit. **Not reported** is selectable where the City feed contains blank values.
- **Set current as default** saves the search text and all five filter selections in this browser. The saved default is automatically restored on the next visit in the same browser. It is not sent to the server or shared with other browsers or devices. Use **Restore saved default** after temporary changes, **Forget saved default** to remove it immediately, or clear the site's cookies and browser data.
- **Clear filters** restores the full Varsity result set for the current view. It does not erase a saved default.

The linked details panel displays the City-published proposed use, permitted/discretionary classification, land-use district, concurrent land-use redesignation number, current status, application and decision dates, release and commencement dates, and SDAB number and decision. **Not reported** means the City feed did not provide a value; it does not automatically mean “none.”

Open **What do these permit fields mean?** to see the searchable field guide without leaving the dashboard. The **Land-use district** entry lists the district codes found in the loaded Varsity records beside the descriptions published in the City feed. It also explains common `d`, `f` and `h` modifiers and flags Direct Control districts as site-specific. The **Permitted / discretionary** entry explains each loaded classification, including permitted with a relaxation and unspecified values. The **Current status** entry gives a cautious plain-language meaning for every status found in those records. These lists update as City values change; an unfamiliar future value remains visible with advice to check the official application.

Select the **?** control beside any field to open its definition without leaving the dashboard. The expandable **What do these permit fields mean?** guide also includes a search box for browsing all definitions. Each help control has a 44×44 CSS-pixel target and moves keyboard focus to the matching definition. The explanations are plain-language summaries; official City and SDAB records remain authoritative.

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
