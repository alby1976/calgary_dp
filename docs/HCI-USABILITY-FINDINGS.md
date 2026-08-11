# HCI usability findings

**Evaluation date:** August 7, 2026  
**Evaluated version:** Sites version 25; implementation status updated August 8, 2026
**Audience:** Varsity residents, friends and Varsity Community Association civic-committee members

**Design intent:** The dashboard is a proactive early-warning tool. A permit appearing in Calgary Open Data can alert users to watch Calgary's Development Map (DMap) even when the corresponding DMap application page or public plans are not available yet. The dashboard must not imply that a DMap record already exists or predict when Calgary will publish it.

## Scope and limitations

This report preserves the prioritized findings from an expert heuristic evaluation and cognitive walkthrough of the rendered dashboard, interaction code, responsive rules and automated checks. It is not a moderated usability study with community participants. The internal interactive-browser preview was unavailable during the evaluation, so findings that depend on live clicking were verified from application state and tests rather than observed participant behaviour.

The assessment focused on these tasks:

1. Find a development permit by address or permit number.
2. Filter the feed to permits with a recorded SDAB appeal.
3. Select a permit and follow it across the explorer, overview, street map and details.
4. Interpret the four permit-status groups.
5. Open City, appeal and CanLII source records.
6. Confirm data freshness and Varsity-only scope.

## Priority findings

| Priority | Finding | User impact | Recommended correction | Acceptance criterion |
| --- | --- | --- | --- | --- |
| Critical | **Resolved August 11:** both maps now create exactly one GeoJSON point per filtered record with valid coordinates; the former 500-record truncation and later cluster-symbol ambiguity are removed. | The previous limit and aggregation could make the activity pattern look complete while hiding how many records a symbol represented. | Preserve the one-feature-per-record mapping and honest viewport-total labels. | Each filtered coordinate record produces one point feature, and neither map imposes a record cap or substitutes a cluster symbol. |
| High | **Resolved August 11:** individual records use one canvas point layer instead of hundreds of HTML marker buttons, and the permit explorer remains the complete keyboard-selection path. | Individual HTML markers could create roughly 1,000 map stops in the keyboard sequence. | Preserve individual GeoJSON points for pointer users and the explorer path for keyboard and switch users. | A keyboard user can move from filters to any permit, its details and source links without traversing the complete point collection. |
| High | **Resolved August 11:** every map record has a transparent 44×44 CSS-pixel pointer/touch target around its smaller visual dot; legend entries and map controls use a minimum 44-pixel target. | The former controls could be difficult to acquire with touch, tremor, low vision or an imprecise pointer, especially when records shared nearby coordinates. | Preserve the 44-pixel hit layer, smaller visual dots, larger legend controls, zoom controls and explorer alternative. | Automated target-size checks pass, nearby points can be separated by zoom, and every record remains selectable from the explorer. |
| High | **Resolved August 11:** ordinary explanatory text now uses 14–16 pixels; smaller type is reserved for concise labels, dates, source labels and other secondary metadata. | The former dense 9–12 pixel copy raised reading effort and made complex appeal material harder to scan. | Preserve the body-copy floor for core instructions, status explanations, map guidance, appeal guidance and source-verification warnings. | Core instructions, status explanations and appeal guidance remain readable at 100% zoom without relying on 9–12 pixel body copy. |
| Medium | Year, status and appeal filter labels are visually hidden. | After choosing a value such as “2025,” a sighted reader must remember which filter the value belongs to. | Add persistent visible labels: **Search**, **Year**, **Permit status** and **Appeal status**. | Every input retains a visible name before and after its value changes. |
| Medium | The full selected-permit panel is `aria-live="polite"` and `aria-atomic="true"`. | Selecting an appealed permit may cause assistive technology to announce a long block of dates, metadata and links. | Use a short dedicated live message such as “DP2025-05349 selected; details updated,” while leaving the details available for normal navigation. | One concise announcement occurs per selection instead of rereading the complete panel. |
| Medium | If a filter removes the stored selection, `selectedPermit` falls back to the first displayed result but the street-map focus still receives the old `selected` value. | The row and highlight can change without the granular map reliably centring on the new permit. | Synchronize the stored selection when the filtered result set invalidates it. | After every filter change, the explorer row, overview point, street marker, street-map centre and detail panel refer to the same permit. |
| Medium | Status-summary and year-chart buttons rely mainly on visual selected styling; chart values appear on hover or selection but not explicitly on keyboard focus. | Keyboard and assistive-technology users receive weaker feedback about the active filter and yearly values. | Add consistent `aria-pressed`, visible focus styling and names such as “2025: 84 permits.” | Focus and selection states are both visible and programmatically determinable. |
| Low | The introductory hero occupies most of the initial desktop viewport. | Returning civic users must scroll or activate **Explore permits** before reaching the working interface. | Provide a visible skip link or a compact returning-user route to the permit workspace. | A returning user can reach search and filters with one keyboard or pointer action. |

## Strengths to preserve

- The three-pane workspace keeps the explorer, linked maps and details together on desktop.
- Search and filters drive one shared result set.
- Status is communicated with text as well as colour.
- The dashboard clearly separates the City update time from its own refresh time.
- Varsity-only scope, unofficial interpretation and official-verification warnings are prominent.
- Public City, SDAB and CanLII fallbacks are extensive and written in plain language.
- The map can fail without removing the permit explorer and record details.
- Responsive one-column behaviour and reduced-motion support are present.
- Tested core colour pairs ranged from approximately 5.15:1 to 7.09:1.

## Recommended implementation order

1. ~~Correct the 500-point map discrepancy.~~ Completed August 8, 2026.
2. ~~Reduce keyboard tab stops without hiding record-level points and enlarge pointer/touch targets.~~ Completed August 11, 2026 with canvas point layers, 44×44 hit areas and the explorer keyboard path.
3. Add visible filter labels. ~~Increase explanatory text size.~~ Completed August 11, 2026.
4. Correct selection synchronisation after filtering.
5. Refine live-region and chart accessibility.
6. Run a moderated test with five Varsity residents or civic-committee members.

## Retest requirement

After each correction, repeat the six task scenarios above at desktop and mobile widths using pointer, touch, keyboard and a screen reader. Record completion, errors, assistance required and participant confidence. Passing automated tests alone is not usability evidence—software can pass every test and still make a human mutter at it.
