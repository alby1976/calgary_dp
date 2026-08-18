# HCI usability findings

**Initial evaluation:** August 7, 2026

**Previous retest:** August 12, 2026

**Previous production retest:** August 15, 2026

**Latest retest:** August 16, 2026

**Evaluated source commit:** `afb49dc5502b460a81ba5f92e30e64f93971746e`

**Production URL:** https://varsity-development-watch.albert-leung.workers.dev/

**Live dataset observed:** 1,243 Varsity development permits

**City data timestamp observed:** August 15, 2026, 3:10 p.m. MDT

**Dashboard refresh timestamp observed:** August 16, 2026, 7:24 a.m. MDT

**Audience:** Varsity residents, friends and Varsity Community Association civic-committee members

**Implementation follow-up:** August 16, 2026 — the map-to-explorer linked-selection correction passed production retesting in both compatibility maps.

**Post-retest implementation update:** August 17, 2026 — production added the permitted/discretionary filter, property-context street-map zoom and initial centring on the first selected permit. A later August 17 implementation added an on-page searchable permit-field guide, field-level help controls and a concise selection live region in place of the atomic details announcement. These additions have not yet received a new hands-on usability retest and are not counted as August 16 task evidence.

**Design intent:** The dashboard is a proactive early-warning tool. A permit appearing in Calgary Open Data can alert users to watch Calgary's Development Map (DMap) even when the corresponding DMap application page or public plans are not available yet. The dashboard must not imply that a DMap record already exists, predict when Calgary will publish it or replace verification through Calgary's official Development Map.

## Overall assessment

The August 16 production retest confirms that the linked-selection correction works in the no-WebGL compatibility path. Selecting an older permit from either map pins its selected row above the latest 12 permits, keeps both map highlights and details synchronized, and preserves active filters. Expanding the full explorer scrolls the selected row into view.

The dashboard is suitable for continued public preview. It is **not ready for full accessibility sign-off** because the compatibility-map pointer targets are substantially smaller than the intended 44-by-44-pixel minimum and several previously reported screen-reader, filter-label and selected-state issues remain.

## Scope and method

This report combines:

- an expert heuristic evaluation and cognitive walkthrough;
- hands-on interaction with the live production dashboard at a 1,363-by-936-pixel desktop viewport;
- keyboard navigation through the primary workflow;
- a real permit-number search using `DP2025-05349`;
- appeal filtering and inspection of a live appealed record;
- pointer selection from the coordinate-based compatibility maps;
- inspection of rendered labels, ARIA state, live regions, focus presentation and target dimensions;
- inspection of live console errors and map counters;
- source review of responsive rules, selection state and fallback behavior; and
- the 35-test production validation result recorded for the merged linked-selection change.

The cloud test browser did not provide WebGL2. This deliberately exercised the failure path affecting unsupported graphics hardware, disabled hardware acceleration, remote-desktop sessions and similar environments. It prevented hands-on pan, zoom and point-selection testing in the normal MapLibre tile view.

The August 17 first-load centring and property-context zoom changes affect the normal MapLibre path. Their automated regression coverage verifies the data flow and target zoom, but a WebGL2-capable browser must still confirm the visible movement, timing and user experience.

Narrow-screen behavior was source-verified through the 960-pixel and 680-pixel responsive rules, but it was not interactively tested on a resized phone viewport or physical touch device. This remains an expert evaluation, not a moderated study with community participants or a complete screen-reader conformance audit.

## Tasks tested

1. Find a development permit by address or permit number.
2. Filter the feed to permits with a recorded SDAB appeal.
3. Select a permit and follow it across the explorer, overview, street map and details.
4. Interpret the four permit-status groups.
5. Open City, appeal, DMap and CanLII source records.
6. Confirm data freshness, early-warning purpose and Varsity-only scope.
7. Continue using the dashboard when WebGL2 is unavailable.
8. Change the filtered result set from all records to one, zero, 33, 36 and 50 records.
9. Invalidate an existing selection with a filter and verify the replacement selection.
10. Navigate the primary workflow by keyboard.

## Task results

| User task | Result | Evidence |
| --- | --- | --- |
| Find a permit by number | Pass | Searching `DP2025-05349` returned one correct record at 132 Varsity Estates Place NW and updated the details. |
| Understand freshness, scope and purpose | Pass | The City timestamp, dashboard refresh timestamp, Varsity scope, unofficial-data warning and early-warning purpose are clear. |
| Verify information through DMap | Pass | The permit-specific shortcut and Calgary's official Development Map are separate actions with an explicit verification warning. |
| Find appealed permits | Pass | The appeal filter returned 36 records. `DP2025-06986` displayed the Calgary decision fields, CanLII state and official fallback links. |
| Use maps without WebGL2 | Pass | Both maps switched to compatibility plots showing all 1,243 valid-coordinate records. Search, filters, selection, details and official links remained usable. |
| Keep map totals honest | Pass | Both compatibility maps reported matching totals at 1, 33, 36, 50 and 1,243 filtered points. A zero-result state reported zero rather than a stale or impossible count. |
| Synchronize selection after filtering | Pass | Filtering a selected 2025 record out with the 2026 filter selected `DP2026-04685` consistently in the explorer and details, with both maps reporting 33 points. |
| Select a permit from a map | Pass in compatibility mode | Selecting older permits `DP2023-06743` from the overview and `DP1998-1874` from the street-level plot pinned a visibly selected explorer row above the latest 12, synchronized both map highlights and details, and preserved all active filters. **Show all** scrolled the selected row into the explorer viewport. Normal MapLibre selection remains untested because WebGL2 was unavailable. |
| Navigate by keyboard | Partial pass | The initial order is logical and limits the explorer to 12 permit rows. Focus is visible, but summary and chart filters do not expose their selected state programmatically. |
| Use enlarged targets and readable text | Partial | Main controls, legend buttons and interactive MapLibre markers meet or approach the intended target size. Compatibility-map hit targets measured only about 18 by 18 CSS pixels. |
| Use a narrow/mobile layout | Source-verified only | CSS changes the workspace to one column below 960 pixels and removes the sticky header below 680 pixels. Physical touch and interactive reflow were not tested. |

## Priority findings

| Priority | Finding | User impact | Recommended correction | Acceptance criterion |
| --- | --- | --- | --- | --- |
| High | Compatibility-map point hit targets measure about 18 by 18 CSS pixels, not the intended 44 by 44 pixels. The transparent SVG circles use a fixed view-box radius that shrinks with the rendered map; one tested target was also covered by the map-credits link. | Users with tremor, low vision or an imprecise pointer receive the smallest targets precisely when their browser cannot use the normal interactive map. Dense, overlapping or overlaid points become difficult or impossible to select directly. | Give every fallback point a scale-independent minimum 44-by-44 CSS-pixel hit area and ensure panel overlays do not cover selectable points. One option is a transparent non-scaling SVG stroke used only for pointer hit testing; another is a resize-aware overlay. Add rendered-size and obstruction regression tests at desktop and mobile widths. | Every fallback point has a measured pointer target of at least 44 by 44 CSS pixels at supported viewport widths, and no map chrome blocks its target, without changing the visual dot size or implying parcel extent. |
| Medium | Search, year, permit-status and appeal-status labels remain visually hidden with `.sr-only`. | Sighted users must infer a control's purpose from its placeholder or current option. A selected value such as “2025” no longer states that it represents the permit year. | Add persistent visible labels: **Search**, **Year**, **Permit status** and **Appeal status**. | Every filter retains a visible name before and after its value changes at desktop, mobile and enlarged-text layouts. |
| Medium | The complete selected-permit article used `aria-live="polite"` and `aria-atomic="true"`; the new pinned-selection note also used `role="status"`. An August 17 implementation replaced the atomic article announcement with one concise selection status, but it has not received a screen-reader retest. | Before the correction, selecting an older permit could produce both a concise pin message and a long announcement of dates, metadata, explanations and links. | Retest the new dedicated message with NVDA, JAWS and VoiceOver, including selection changes and field-guide interaction. | One concise announcement occurs per selection; opening, searching and closing the field guide does not reread the entire permit article. |
| Medium | Status-summary and year-chart buttons use visual selected classes without `aria-pressed`. Year-chart buttons also expose concatenated names such as `502025` instead of a clear year-and-count label. | Keyboard and screen-reader users receive weak or ambiguous feedback about the selected filters and chart values. | Add `aria-pressed`, explicit accessible names such as “2025: 50 permits,” and a visible `:focus-visible` treatment to both control groups. | Focus and selection are visually and programmatically determinable, and every year button announces its year and permit count in a natural order. |
| Medium | Activating **Explore permits** places the workspace at the top of the viewport underneath the 88-pixel sticky header. The explorer and map headings are obscured. | The dashboard's primary call to action lands users in a workspace whose context labels are hidden, making the transition feel abrupt and incomplete. | Add an appropriate `scroll-margin-top` to the workspace target or move the anchor to a target that clears the sticky header. | After activating **Explore permits**, the explorer heading and both map-panel headings begin below the sticky header. |
| Low | The introductory hero occupies almost the entire initial desktop viewport. | Returning users must scroll or activate the primary action before reaching current permit information. | Add a conventional skip-to-workspace link or a compact returning-user path while preserving the project explanation for first-time visitors. | A returning keyboard or pointer user can reach permit search in one clear action without losing the workspace heading. |

## Investigation item

A recoverable React production error 418 appeared on each observed reload. React identifies this as a server/client hydration mismatch and regenerates the affected tree on the client. The testing browser also runs an automation extension that produced its own errors and could alter the DOM, so this is **not yet confirmed as an application defect**.

Reproduce the reload in a clean local production browser with extensions disabled. If the error remains, compare server and client text output—especially locale-formatted dates and counts—and add a production hydration regression test. Acceptance requires no application-origin hydration mismatch during a clean reload. See https://react.dev/errors/418.

## Resolved findings to preserve

| Earlier finding | Resolution observed | Regression criterion |
| --- | --- | --- |
| Selecting a map point outside the latest 12 could update both maps and details while leaving no selected explorer row visible. | On August 16, older selections from both compatibility maps were pinned above the latest 12 with a selected row inside the explorer viewport. **Show all** scrolled the selected row into view, and active filters remained unchanged. | After selecting any map point, the matching explorer row is rendered, visibly selected and inside the explorer viewport without manual searching; expanding and collapsing the explorer preserves that context. |
| MapLibre construction or cleanup failure could blank the dashboard. | Both map regions now fail independently into coordinate plots; the rest of the dashboard survives repeated filtering and selection. | With WebGL2 disabled or construction forced to throw, search, filters, rows, details and links remain usable with no blank page. |
| Failed maps could report an impossible count such as 1,242 of 1. | Compatibility maps report the current filtered coordinate total and reached valid states at zero, one, 33, 36, 50 and 1,243 points. | Every displayed count is non-negative and never exceeds the filtered valid-coordinate total. |
| Filter-driven fallback selection could disagree across the explorer and details. | Filtering a selected record out consistently selected the first remaining result in the explorer and details. | The selected row, map highlights and details heading refer to the same permit after every search or filter change. |
| Each map showed at most 500 records. | Both compatibility maps displayed all 1,243 valid-coordinate records and no record cap was observed. | One point corresponds to one valid-coordinate record; no silent truncation is introduced. |
| Hundreds of map markers created excessive keyboard stops. | The keyboard path uses the permit explorer, initially limited to 12 rows. Compatibility-map SVG points are not added to the tab order. | Keyboard users can reach every permit through the explorer without traversing the entire map collection. |
| Production omitted a required MapLibre worker module. | The merged build packages and validates both `maplibre-gl-worker.mjs` and `maplibre-gl-shared.mjs`; the production build and all 35 tests passed before the latest retest. | Production validation fails if either worker module is absent or empty. |
| Ordinary explanatory text was frequently 9 to 12 pixels. | Core map guidance, appeal explanations and source-verification warnings render at approximately 14 to 16 pixels; smaller sizes are reserved mainly for concise metadata. | Core instructions and warnings remain readable and reflow without clipping. |

## Strengths to preserve

- The three-pane desktop workspace keeps the explorer, both maps and details together.
- Search and filters drive one shared result set.
- Map-originated selections outside the latest 12 remain visibly represented in the explorer without discarding the compact default list.
- The no-WebGL compatibility path preserves all coordinate records instead of hiding the maps or the dashboard.
- Status is communicated with words as well as colour.
- The early-warning purpose is explicit without claiming that Open Data replaces DMap.
- The generated DMap shortcut is clearly distinguished from Calgary's official Development Map.
- City update time and dashboard refresh time are presented separately.
- Varsity-only scope, unofficial interpretation and official-verification warnings are prominent.
- Public Calgary, SDAB and CanLII fallbacks are extensive and written in plain language.
- The initial keyboard sequence is logical and limits the permit list to 12 rows.
- Responsive one-column rules and reduced-motion support are present.
- Clean filter reset, appealed-permit discovery and selection invalidation all behaved correctly in the final retest.

## Recommended implementation order

1. Enlarge compatibility-map hit targets to a measured 44-by-44 CSS-pixel minimum.
2. Add persistent visible filter labels.
3. Replace the atomic details live region with one concise selection announcement.
4. Add programmatic pressed states and clear accessible names to summary and year controls.
5. Correct the sticky-header anchor offset.
6. Reproduce and diagnose the hydration warning in a clean browser.
7. Run a moderated test with five Varsity residents or civic-committee members using desktop, mobile, touch, keyboard and a screen reader.

## Next retest requirements

Repeat all task scenarios after corrections. Include:

- WebGL2 unavailable before initial render;
- MapLibre construction throwing synchronously;
- successful WebGL2 initialization with real pan, zoom and map-point selection;
- first visit with the first explorer record already selected, confirming that the street map centres on it as soon as the map is ready;
- row, overview-point and street-point selection at zoom levels below and above 18, confirming that selection reaches property context without zooming out a closer user view;
- permitted/discretionary filtering alone and in combination with land-use district, year, status, appeal and search, including **Clear filters**;
- tile or worker requests failing after construction begins;
- result sets changing from all records to one, zero and back to all;
- regression coverage for map selection outside the latest 12, including **Show all**, collapse and active filters;
- fallback point target measurements at desktop and mobile widths;
- overlapping records at identical coordinates;
- 200% browser zoom and narrow-screen reflow;
- keyboard-visible and screen-reader-announced summary and year-filter states;
- concise screen-reader announcements for permit selection; and
- clean production reloads with extensions disabled.

Record task completion, incorrect states, errors, assistance required and participant confidence. Passing automated checks alone is not usability evidence—software can pass every test and still make a human mutter at it.
