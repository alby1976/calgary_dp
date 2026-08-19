# HCI usability findings

**Initial evaluation:** August 7, 2026

**Latest hands-on production retest:** August 16, 2026

**Latest expert regression evaluation:** August 18, 2026

**Evaluated source commit:** `e21b0083804f87d34c7fdc5507aace45f5508552`

**Evaluated production URL:** https://varsity-development-watch.albert-leung.chatgpt.site/

**Live dataset observed:** 1,243 Varsity development permits

**City data timestamp observed:** August 18, 2026, 3:10 p.m. MDT

**Dashboard refresh timestamp observed:** August 18, 2026, 11:53 p.m. MDT

**Audience:** Varsity residents, friends and Varsity Community Association civic-committee members

**Design intent:** The dashboard is a proactive early-warning tool. A permit appearing in Calgary Open Data can alert users to watch Calgary's Development Map (DMap) even when the corresponding DMap application page or public plans are not available yet. The dashboard must not imply that a DMap record already exists, predict when Calgary will publish it or replace verification through Calgary's official Development Map.

## Overall assessment

The August 18 regression evaluation found no release-blocking functional regression. The compact filter drawer, browser-saved filter defaults, linked selection, initial street-map centring and searchable permit field value guide are represented in the production response and covered by the 47-test build suite. Status-summary and year-chart controls now expose explicit accessible names and `aria-pressed` state.

The dashboard remains suitable for public preview, but it is **not ready for full accessibility sign-off**. The two modal drawers declare `aria-modal="true"` without containing keyboard focus or making the background inert. Search still relies on placeholder text as its only visible label. Previously measured compatibility-map point targets remain smaller than 44 by 44 CSS pixels at some rendered sizes, and the new drawer interactions have not yet received hands-on keyboard, touch or screen-reader testing.

## Scope, evidence and limitation

This update is an expert regression evaluation, not a new moderated usability study. It combines:

- review of the live production response, dataset count and freshness timestamps;
- a cognitive walkthrough of search, filters, saved defaults, linked selection, both map paths, permit details and the field guide;
- source inspection of labels, ARIA state, keyboard handlers, responsive rules, target sizes and focus behavior;
- comparison with the August 16 hands-on desktop and keyboard evidence; and
- a clean production build plus all 47 automated tests.

The cloud interaction browser could not reach the otherwise healthy preview during this evaluation. No new pointer, keyboard, screen-reader, mobile-touch, 200% zoom or WebGL2 interaction is claimed. Items verified only by source, rendered response or automation are labelled accordingly. The August 16 hands-on observations remain historical evidence, not proof that every later drawer change works for people.

## Regression scenarios evaluated

1. Find a development permit by address or permit number.
2. Open the filter drawer, include or exclude multiple years and categorical values, and clear filters.
3. Save the current filters as this browser's default, restore them and forget them.
4. Select a permit and follow it across the explorer, overview, street map and details.
5. Confirm the first selected permit is passed to the street map for initial centring.
6. Open the searchable permit field value guide from its main button and a field-level help button.
7. Interpret land-use district, current status and permitted/discretionary values without leaving the page.
8. Use status-summary and year-chart buttons as filters.
9. Continue using the dashboard if MapLibre or WebGL2 is unavailable.
10. Verify City, DMap, SDAB and CanLII source paths and the dashboard's freshness and scope warnings.

## Current task results

| User task | Result | Evidence and limits |
| --- | --- | --- |
| Find a permit | Source- and regression-verified | Search remains in the compact toolbar and drives the same filtered collection used by the explorer, maps and details. The live response contains the search control; no new hands-on typing session was possible. |
| Filter years and categorical values | Source- and regression-verified | The overlay contains Years, Permit statuses, Land-use districts, Permitted / discretionary and Appeal statuses. Each supports multiple exclusions, show-all/show-none actions and reset; active categories remain visible as removable chips outside the drawer. |
| Save browser defaults | Source- and regression-verified | Current settings are stored in `localStorage`, restored on a later visit in the same browser, and can be replaced or forgotten. Failure to access storage is handled with a status message. |
| Use the filter drawer | Partial | Open, backdrop close, explicit close, **Show matches**, `Escape`, body-scroll lock and return-focus logic are present. Keyboard focus is not trapped inside the declared modal, so background controls may still be reached with Tab. |
| Use the permit field guide | Partial | The guide is searchable, uses the same desktop drawer/mobile bottom-sheet pattern, supports field-level deep links and explains loaded values for land-use district, current status and permitted/discretionary. Close, backdrop, `Escape` and return-focus paths are present, but modal focus containment and screen-reader behavior need hands-on testing. |
| Follow one selected permit | Source- and regression-verified | Explorer rows expose pressed state; both maps and the details receive one selected permit number; the concise live message announces that details updated. An older selection remains pinned above the latest 12. |
| Centre the first selection on the street map | Regression-verified | The initially selected permit is passed as the street map's focus permit and covered by an automated regression. Visible movement and timing still require a WebGL2-capable browser retest. |
| Filter from status summaries and year chart | Source- and regression-verified | Both control groups expose `aria-pressed` and explicit names such as “2025: 50 permits; hide year.” This resolves the earlier programmatic-state defect. |
| Use maps without WebGL2 | Previously hands-on; regression preserved | The August 16 session confirmed independent compatibility plots, honest totals and synchronized selection. Current tests still protect construction failure, complete point input and fallback rendering. Fallback target size remains open. |
| Understand freshness, scope and purpose | Live-response verified | The live response identifies a connected City feed, 1,243 records, separate City and dashboard timestamps, Varsity scope and the unofficial early-warning caveat. |
| Use a narrow/mobile layout | Source-verified only | Below 960 pixels the workspace becomes one column; below 680 pixels the sticky header is removed and drawers become bottom sheets. Physical touch, on-screen keyboard and interactive reflow were not tested. |

## Priority findings

| Priority | Finding | User impact | Recommended correction | Acceptance criterion |
| --- | --- | --- | --- | --- |
| High | Compatibility-map point targets use transparent SVG circles with a fixed radius in a 1,000-by-560 view box. The August 16 rendered measurement found targets as small as about 18 by 18 CSS pixels, and current source does not provide a scale-independent 44 by 44 CSS-pixel minimum. | People with tremor, low vision or an imprecise pointer receive the smallest targets when the normal map is unavailable. Dense, overlapping or overlaid points become difficult to select. | Implement a resize-aware or non-scaling hit area and keep map notices and credits from covering selectable targets. Add rendered measurement tests at supported desktop and mobile widths. | Every fallback point has a measured pointer target of at least 44 by 44 CSS pixels at supported widths, with no map chrome blocking it and no change that implies parcel extent. |
| Medium | Both overlay drawers use `role="dialog"` and `aria-modal="true"`, but neither traps Tab/Shift+Tab or makes the page behind the modal inert. | Keyboard and screen-reader users can leave an apparently modal task, reach obscured controls and lose context. | Use a tested focus-trap implementation or the native dialog model, keep focus within the open drawer, and make background content non-interactive until close. | Repeated Tab and Shift+Tab cycle only through the open drawer; background controls are not focusable or exposed as active; Escape and every close action restore focus to the opener. |
| Medium | The permit search has an `.sr-only` label and uses placeholder text as its only visible name. | The control's purpose disappears after typing and can be harder to recall for users with cognitive or low-vision needs. | Add a persistent visible **Search permits** label while keeping the compact toolbar. | The search name remains visible before and after text entry at desktop, mobile, 200% zoom and enlarged-text layouts. |
| Medium | The concise selected-permit live message and the new field-guide drawer have automated coverage but no human screen-reader retest. | A selection change could be silent, duplicated or followed by excessive content; opening a field definition could move focus without a useful announcement. | Test with NVDA, JAWS and VoiceOver, including row/map selection, pinned older records, field-level help, guide search and all close paths. | One concise announcement occurs per selection; opening a field definition announces the guide and target field once; closing returns focus without rereading the full permit article. |
| Medium | Activating **Explore permits** targets an element beneath the 88-pixel sticky header, and no `scroll-margin-top` rule is present for the workspace. | The primary action can land with the explorer and map context headings obscured. | Add an appropriate scroll margin or move the anchor to a target that clears the header. | After activating **Explore permits**, the explorer heading and both map-panel headings begin below the sticky header. |
| Low | The introductory hero occupies almost the entire initial desktop viewport. | Returning users must scroll or use the primary action before reaching current permit information. | Add a conventional skip-to-workspace link or compact returning-user route while retaining the first-visit explanation. | A returning keyboard or pointer user reaches permit search in one clear action without losing the workspace heading. |

## Investigation item

A recoverable React production error 418 appeared during the August 16 browser session. React identifies this class of error as a server/client hydration mismatch, but the automation browser also ran an extension capable of altering the document. The August 18 response/build review cannot confirm or clear the defect because the interaction browser was unavailable.

Reproduce a production reload in a clean browser with extensions disabled. If the error remains, compare server and client output—especially locale-formatted dates and counts—and add a hydration regression test. Acceptance requires no application-origin hydration mismatch during a clean reload.

## Resolved findings to preserve

| Earlier finding | Resolution observed | Regression criterion |
| --- | --- | --- |
| Status-summary and year-chart filters exposed visual selection without programmatic state; year names could be concatenated with counts. | Both groups now use `aria-pressed` and explicit, natural-order accessible labels containing the category/year, count and action. | Every summary and year control retains a clear accessible name, visible focus and programmatically determinable state after filtering. |
| Persistent filter controls compressed the permit table. | Five categorical controls and browser-default actions now live in an overlay drawer; search and active-filter summaries remain in the explorer's compact toolbar. | The default explorer preserves useful row space at desktop and mobile sizes while every filter remains reachable in one clear action. |
| The permit field guide lengthened the selected-permit panel. | The searchable guide now opens in a desktop drawer or narrow-screen bottom sheet, supports direct field help, and closes through explicit, backdrop and Escape actions. | Opening and closing the guide does not resize the permit details column or lose the user's selected permit and filters. |
| Search, year, permit-status and appeal-status names were all visually hidden. | The drawer gives categorical groups persistent visible names, while chart years and status summaries are visibly named in place. Search remains the one open visible-label issue. | Each categorical group retains its visible name before and after selections change. |
| Selecting a map point outside the latest 12 could update both maps and details while leaving no selected explorer row visible. | Older map selections are pinned above the latest 12; **Show all** scrolls the selected row into view and active filters remain unchanged. | After selecting any map point, the matching explorer row is rendered, selected and visible without manual searching. |
| MapLibre construction or cleanup failure could blank the dashboard. | Both map regions fail independently into coordinate plots; search, filters, rows, details and links remain available. | With WebGL2 disabled or construction forced to throw, the non-map workflow remains usable with no blank page. |
| Failed maps could report impossible totals. | Compatibility maps report the current filtered coordinate total and previously reached valid zero, one, 33, 36, 50 and 1,243-point states. | Every displayed count is non-negative and never exceeds the filtered valid-coordinate total. |
| Filter-driven fallback selection could disagree across explorer, maps and details. | If a filter removes the selection, the first remaining permit becomes the shared selection. | Explorer row, map highlights and details heading refer to the same permit after every search or filter change. |
| Each map showed at most 500 records. | Both maps now receive the full filtered coordinate collection. | One point corresponds to one valid-coordinate record; no silent truncation is introduced. |
| Hundreds of map markers created excessive keyboard stops. | Keyboard access uses the permit explorer, initially limited to 12 rows; compatibility-map points are not added to the Tab sequence. | Keyboard users reach every permit through the explorer without traversing the entire map collection. |
| Production omitted a required MapLibre worker module. | Build validation requires both MapLibre worker modules and the August 18 build passed. | Production validation fails if either worker module is absent or empty. |
| Ordinary explanatory text was frequently 9 to 12 pixels. | Core map guidance, appeal explanations and source-verification warnings render at approximately 14 to 16 pixels. | Core instructions and warnings remain readable and reflow without clipping. |

## Strengths to preserve

- The desktop workspace keeps the explorer, both maps and selected details together.
- One shared result set drives rows, both maps, counts, charts and selection.
- Compact search, filter button and removable active-category chips preserve table space.
- Users can include or exclude multiple years and values, clear settings, and save or forget a same-browser default.
- The field guide explains fields and live land-use, status and permitted/discretionary values without leaving the page.
- Map selections outside the latest 12 remain visible in the explorer.
- The no-WebGL path preserves all valid-coordinate records and the rest of the dashboard.
- Status uses words as well as colour.
- City update time and dashboard refresh time are presented separately.
- Varsity-only scope, unofficial interpretation and official verification are prominent.
- DMap, SDAB and CanLII fallbacks are extensive and use plain language.
- Responsive one-column rules, bottom-sheet drawers and reduced-motion support are present.

## Recommended implementation order

1. Add modal focus containment and inert background behavior to both drawers.
2. Enlarge compatibility-map targets to a measured 44 by 44 CSS-pixel minimum.
3. Add a persistent visible label to permit search.
4. Correct the sticky-header anchor offset.
5. Retest concise selection and field-guide announcements with screen readers.
6. Reproduce the hydration warning in a clean browser.
7. Run a moderated test with five Varsity residents or civic-committee members using desktop, mobile, touch, keyboard and a screen reader.

## Next hands-on retest requirements

Repeat the primary scenarios after corrections and include:

- opening each drawer by mouse, keyboard and touch;
- cycling forward and backward through every drawer control without focus escaping;
- closing by explicit button, bottom action, Escape and backdrop, then verifying return focus;
- saving, restoring and forgetting filter defaults, followed by a reload and a new same-browser visit;
- multiple exclusions for years, land-use districts, permit statuses, permitted/discretionary and appeals, alone and in combination with search;
- field-guide searches for a field name and live values from each glossary;
- field-level help from every detail term, including scroll and focus placement;
- first visit with the first explorer record selected and the street map visibly centred once ready;
- successful WebGL2 pan, zoom and selection plus WebGL2-unavailable fallback behavior;
- fallback point target measurements at desktop and mobile widths, including overlap and map chrome;
- a map-originated selection outside the latest 12, including **Show all** and active filters;
- summary and year filtering with visible focus, clear names and screen-reader-announced pressed state;
- one concise screen-reader announcement per permit selection;
- 200% browser zoom, narrow-screen reflow, physical touch and on-screen keyboard behavior; and
- clean production reloads with extensions disabled.

Record task completion, incorrect states, errors, assistance required and participant confidence. Automated checks protect implementation contracts, but passing them alone is not usability evidence.
