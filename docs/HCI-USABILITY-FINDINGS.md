# HCI usability findings

**Initial evaluation:** August 7, 2026
**Latest retest:** August 12, 2026
**Evaluated production commit:** `80410524c0600e64a972117ba40c1af79f9ab2fe`
**Live dataset observed:** 1,242 Varsity development permits
**Audience:** Varsity residents, friends and Varsity Community Association civic-committee members

**Design intent:** The dashboard is a proactive early-warning tool. A permit appearing in Calgary Open Data can alert users to watch Calgary's Development Map (DMap) even when the corresponding DMap application page or public plans are not available yet. The dashboard must not imply that a DMap record already exists, predict when Calgary will publish it or replace verification through Calgary's official Development Map.

## Overall assessment

The dashboard's information architecture and civic-data guidance are strong, and the coordinated permit explorer, maps and details panel substantially reduce context switching. However, the August 12 retest found a critical map-resilience failure and an impossible viewport count during that failure. The dashboard is therefore **not ready for usability or accessibility sign-off**.

Build, lint and all 27 automated tests passed. That does not contradict the usability result: the current tests largely verify source patterns and do not simulate MapLibre construction failure, React cleanup after partial initialization or filtering while maps are unavailable.

## Scope and method

This report combines:

- an expert heuristic evaluation and cognitive walkthrough;
- hands-on interaction with the live production dashboard at desktop width;
- keyboard navigation through the primary workflow;
- a real permit-number search using `DP2025-05349`;
- inspection of live DOM state, browser console errors and map counters;
- source review of selection, map, responsive and accessibility behavior; and
- the production build, lint and 27-test validation suite.

The test browser did not provide WebGL2. This limitation exposed a genuine resilience path affecting unsupported graphics hardware, disabled hardware acceleration, remote-desktop sessions and similar environments. It prevented normal map pan, zoom and point-selection testing. Narrow-screen behavior and 200% reflow were source-verified but not fully interactively tested in a resized phone viewport. This remains an expert evaluation, not a moderated study with community participants.

The assessment focused on these tasks:

1. Find a development permit by address or permit number.
2. Filter the feed to permits with a recorded SDAB appeal.
3. Select a permit and follow it across the explorer, overview, street map and details.
4. Interpret the four permit-status groups.
5. Open City, appeal, DMap and CanLII source records.
6. Confirm data freshness, early-warning purpose and Varsity-only scope.
7. Continue using the permit explorer and details when maps cannot initialize.
8. Navigate the primary workflow by keyboard.

## Task results

| User task | Result | Evidence |
| --- | --- | --- |
| Find a permit by number | Pass | Searching `DP2025-05349` returned one correct record and updated the selected details. |
| Understand freshness, scope and purpose | Pass | City update time, dashboard refresh time, Varsity scope, unofficial-data warning and early-warning purpose are clear. |
| Verify information through DMap | Pass | The generated permit shortcut and Calgary's official Development Map are presented as separate actions with a verification warning. |
| Follow one selection across the workspace | Partial | The explorer row and details update, but filter-driven fallback selection can leave map focus tied to the previous stored selection. |
| Use maps without WebGL2 | Critical failure | Both maps remained in a loading state, the counters became invalid and a later cleanup error blanked the dashboard. |
| Navigate by keyboard | Partial pass | The order is logical and initially exposes only 12 permit rows, but status-summary and year-chart filters do not consistently expose their selected state. |
| Use enlarged targets and readable text | Pass | Map hit areas, legend controls and map controls meet the 44×44 target; ordinary explanatory text is generally 14–16 pixels. |

## Priority findings

| Priority | Finding | User impact | Recommended correction | Acceptance criterion |
| --- | --- | --- | --- | --- |
| Critical | MapLibre construction is not protected when WebGL2 is unavailable. The fallback listens for later map errors, and cleanup calls `remove()` on a partially initialized map. The resulting React error can blank the entire dashboard. | A user with unsupported graphics, disabled acceleration or some remote/assistive environments can lose the permit explorer and record details even though those features do not require a map. | Catch synchronous map-construction failures, keep partially created instances out of normal cleanup, guard `remove()`, and place each map behind an error boundary or equivalent isolated fallback. | With WebGL2 disabled, both map regions show a concise unavailable message; search, filters, permit rows, details and official links remain usable through repeated selections and filter changes, with no uncaught console error or blank page. |
| High | During failed map initialization, filtering from 1,242 records to one produced **1,242 of 1 permit points in this view** on both maps. | The impossible count undermines confidence in the dashboard's central promise of honest record-level mapping. | Do not display viewport counts until a map is ready. On failure, show **Map unavailable** rather than stale counts, and clamp or recompute state whenever the filtered collection changes. | At every state, `0 ≤ points in view ≤ total filtered points`; when the map is unavailable, no numeric viewport claim is shown. |
| High | If filtering removes the stored selection, `selectedPermit` falls back to the first displayed result while map focus still receives the previous `selected` value. | The row, details and maps can refer to different permits, creating exactly the context loss the linked workspace was designed to prevent. | Synchronize the stored selection whenever the filtered result set invalidates it. | After every search or filter change, the selected row, both map highlights, both map centres and the details heading refer to the same permit. |
| Medium | Search, year, permit-status and appeal-status labels remain visually hidden. | Sighted users must infer each filter from its current option and remember what a value such as “2025” represents. | Add persistent visible labels: **Search**, **Year**, **Permit status** and **Appeal status**. | Every filter retains a visible name before and after its value changes at desktop, mobile and 200% zoom. |
| Medium | The complete selected-permit panel remains `aria-live="polite"` and `aria-atomic="true"`. | Selecting an appealed permit may cause assistive technology to announce a long block of dates, metadata and links. | Remove the live region from the full panel and add a short dedicated announcement such as “DP2025-05349 selected; details updated.” | One concise announcement occurs per selection; users can then navigate the details normally without the entire panel being reread. |
| Medium | Status-summary and year-chart buttons use visual selected styling without consistent `aria-pressed`; chart values are revealed by hover or selection but not clearly by keyboard focus. | Keyboard and assistive-technology users receive weaker feedback about active filters and yearly values. | Add `aria-pressed`, visible `:focus-visible` styling and accessible names such as “2025: 50 permits.” | Focus and selection are visible and programmatically determinable for every summary and year control. |
| Low | The introductory hero occupies most of the initial desktop viewport. | Returning users must scroll or activate **Explore permits** before reaching the working interface. | Add a conventional skip-to-workspace link or a compact returning-user route while preserving the project explanation for first-time visitors. | A returning keyboard or pointer user can reach permit search in one action. |

## Resolved findings to preserve

| Original finding | Resolution observed by August 12 | Regression criterion |
| --- | --- | --- |
| Each map showed at most 500 records. | The former 500-record truncation is removed. Both maps now receive one GeoJSON point per filtered record with valid coordinates; no record cap or clustering substitutes a symbol for multiple records. | One point feature corresponds to one record, and the total equals the complete valid-coordinate filtered set. |
| Hundreds of HTML markers created excessive keyboard stops. | Permit points are canvas-rendered and the permit explorer remains the complete keyboard-selection path. | Keyboard users can reach every displayed permit without tabbing through the full point collection. |
| Markers, legend entries and controls were too small. | Each permit has a transparent 44×44 CSS-pixel hit area around a smaller visual dot; legend and map controls use at least 44-pixel targets. | Target-size checks pass without implying that hit areas represent parcels or development footprints. |
| Ordinary explanatory text was frequently 9–12 pixels. | Ordinary explanatory text now uses 14–16 pixels for core instructions, status explanations, map guidance, appeal guidance and source-verification warnings; smaller type is reserved for short metadata. | Ordinary guidance remains readable at 100% zoom and reflows without clipping at 200%. |

## Strengths to preserve

- The three-pane desktop workspace keeps the permit explorer, two maps and selected details together.
- Search and filters drive one shared result set.
- Status is communicated with words as well as colour.
- The early-warning purpose is explicit without claiming that Open Data replaces DMap.
- The generated DMap shortcut is clearly distinguished from Calgary's official Development Map.
- City update time and dashboard refresh time are presented separately.
- Varsity-only scope, unofficial interpretation and official-verification warnings are prominent.
- Public City, SDAB and CanLII fallbacks are extensive and written in plain language.
- The initial keyboard sequence is logical and limits the permit list to 12 rows until the user requests all results.
- Responsive one-column rules and reduced-motion support are present.
- Previously tested core colour pairs ranged from approximately 5.15:1 to 7.09:1.

## Recommended implementation order

1. Contain MapLibre construction and cleanup failure so the non-map dashboard never disappears.
2. Make map counts valid in loading, ready, filtered and failure states.
3. Synchronize stored selection after every filter or search change.
4. Add persistent visible filter labels.
5. Replace the atomic details live region with a concise selection announcement.
6. Add programmatic pressed states and keyboard-visible year-chart values.
7. Add the skip-to-workspace route.
8. Run a moderated test with five Varsity residents or civic-committee members.

## Retest requirements

After corrections, repeat all eight scenarios at desktop and mobile widths using pointer, touch, keyboard and a screen reader. Include these failure and regression cases:

- WebGL2 unavailable before initial render;
- map construction throws synchronously;
- tile requests fail after successful map construction;
- repeated search and filter changes while maps are unavailable;
- filter changes from 1,242 records to one, zero and back to all;
- selection invalidated by a year, status or appeal filter;
- overlapping records at identical coordinates;
- 200% browser zoom and narrow-screen reflow; and
- screen-reader announcements for permit selection and viewport-count changes.

Record task completion, incorrect states, errors, assistance required and participant confidence. Add runtime tests that simulate map-construction failure and verify that the permit explorer survives. Passing source-pattern tests alone is not usability evidence—software can pass every test and still make a human mutter at it.
