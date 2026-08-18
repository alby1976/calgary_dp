import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import config from "../config/dashboard.json" with { type: "json" };

const dashboardSource = await readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8");
const permitSource = await readFile(new URL("../lib/permit.ts", import.meta.url), "utf8");

const requestedSourceFields = [
  "proposedusedescription",
  "permitteddiscretionary",
  "landusedistrict",
  "landusedistrictdescription",
  "concurrent_loc",
  "statuscurrent",
  "applieddate",
  "decision",
  "decisiondate",
  "releasedate",
  "mustcommencedate",
  "sdabnumber",
  "sdabdecision",
];

test("requested permit fields are fetched and mapped into the dashboard model", () => {
  for (const field of requestedSourceFields) {
    assert.ok(config.feed.selectFields.includes(field), `missing feed field ${field}`);
  }

  assert.equal(config.feed.fieldMap.concurrentLandUse, "concurrent_loc");
  assert.match(permitSource, /concurrent_loc\?: string/);
});

test("every categorical filter supports multiple exclusions and reset", () => {
  assert.match(dashboardSource, /const \[excludedYears, setExcludedYears\] = useState<string\[]>\(\[]\)/);
  assert.match(dashboardSource, /const \[excludedStatusGroups, setExcludedStatusGroups\] = useState<string\[]>\(\[]\)/);
  assert.match(dashboardSource, /const \[excludedLandUseDistricts, setExcludedLandUseDistricts\] = useState<string\[]>\(\[]\)/);
  assert.match(dashboardSource, /const \[excludedPermittedDiscretionary, setExcludedPermittedDiscretionary\] = useState<string\[]>\(\[]\)/);
  assert.match(dashboardSource, /const \[excludedAppealStatuses, setExcludedAppealStatuses\] = useState<string\[]>\(\[]\)/);
  assert.match(dashboardSource, /!excludedStatusGroupSet\.has\(statusGroup\(permit\.statuscurrent, config\.statuses\)\)/);
  assert.match(dashboardSource, /!excludedYearSet\.has\(permitYear\(permit\)\)/);
  assert.match(dashboardSource, /\.every\(\(value\) => !excludedLandUseDistrictSet\.has\(value\)\)/);
  assert.match(dashboardSource, /\.has\(permittedDiscretionaryFilterValue\(permit\)\)/);
  assert.match(dashboardSource, /!excludedAppealStatusSet\.has\(appealFilterValue\(permit\)\)/);
  assert.match(dashboardSource, /label="Years"/);
  assert.match(dashboardSource, /label="Permit statuses"/);
  assert.match(dashboardSource, /label="Land-use districts"/);
  assert.match(dashboardSource, /label="Permitted \/ discretionary"/);
  assert.match(dashboardSource, /label="Appeal statuses"/);
  assert.match(dashboardSource, /Select all<\/button>/);
  assert.match(dashboardSource, /Deselect all<\/button>/);
  assert.match(dashboardSource, /excludedYears: \[],/);
  assert.match(dashboardSource, /excludedStatusGroups: \[],/);
  assert.match(dashboardSource, /excludedLandUseDistricts: \[],/);
  assert.match(dashboardSource, /excludedPermittedDiscretionary: \[],/);
  assert.match(dashboardSource, /excludedAppealStatuses: \[],/);
  assert.match(dashboardSource, /aria-pressed=\{!excludedYearSet\.has\(item\.year\)\}/);
});

test("missing categorical values remain explicitly selectable", () => {
  assert.match(dashboardSource, /const NOT_REPORTED_FILTER_VALUE = "__not_reported__"/);
  assert.match(dashboardSource, /return values\.length \? values : \[NOT_REPORTED_FILTER_VALUE\]/);
  assert.match(dashboardSource, /return permittedDiscretionaryValue\(permit\) \|\| NOT_REPORTED_FILTER_VALUE/);
  assert.match(dashboardSource, /function dataFilterValueLabel\(value: string\)/);
  assert.match(dashboardSource, /if \(value === NOT_REPORTED_FILTER_VALUE\) return "Not reported"/);
});

test("filter defaults persist in browser storage and can be restored or forgotten", () => {
  assert.match(dashboardSource, /const FILTER_DEFAULTS_STORAGE_KEY = "varsity-development-watch\.filter-defaults\.v1"/);
  assert.match(dashboardSource, /window\.localStorage\.getItem\(FILTER_DEFAULTS_STORAGE_KEY\)/);
  assert.match(dashboardSource, /window\.localStorage\.setItem\(FILTER_DEFAULTS_STORAGE_KEY, JSON\.stringify\(currentFilterDefaults\)\)/);
  assert.match(dashboardSource, /window\.localStorage\.removeItem\(FILTER_DEFAULTS_STORAGE_KEY\)/);
  assert.match(dashboardSource, /Set current as default/);
  assert.match(dashboardSource, /Restore saved default/);
  assert.match(dashboardSource, /Forget saved default/);
  assert.match(dashboardSource, /clear this site&apos;s browser data/);
});

test("selected permit details display every requested field separately", () => {
  const labels = [
    "Proposed use",
    "Permitted / discretionary",
    "Land-use district",
    "Concurrent land-use redesignation",
    "Current status",
    "Applied date",
    "Decision",
    "Decision date",
    "Released date",
    "Must commence date",
    "SDAB number",
    "SDAB decision",
  ];

  for (const label of labels) {
    assert.match(dashboardSource, new RegExp(`FieldTerm label="${label.replace("/", "\\/")}"`), label);
  }
});

test("permit field definitions open in an accessible searchable drawer", () => {
  assert.match(dashboardSource, /const PERMIT_FIELD_DEFINITIONS = \[/);
  assert.match(dashboardSource, /aria-label=\{`Explain \$\{label\}`\}/);
  assert.match(dashboardSource, /aria-controls="permit-field-guide"/);
  assert.match(dashboardSource, /className="permit-field-guide-toggle"/);
  assert.match(dashboardSource, /id="permit-field-guide"/);
  assert.match(dashboardSource, /aria-label="Close permit field value guide"/);
  assert.match(dashboardSource, /Close guide/);
  assert.match(dashboardSource, /closePermitFieldGuide\(\)/);
  assert.match(dashboardSource, /Search field definitions/);
  assert.match(dashboardSource, /Not reported<\/strong> means the City source did not provide a value/);
  assert.doesNotMatch(dashboardSource, /className="panel detail-panel linked-detail-panel" aria-live/);
  assert.match(dashboardSource, /Selected permit \{text\(selectedPermit\.permitnum\)\}; details updated\./);
});

test("field guide explains loaded land-use district and current-status values", () => {
  assert.match(dashboardSource, /function landUseDistrictValueMeanings\(permits: Permit\[\]\)/);
  assert.match(dashboardSource, /permit\.landusedistrictdescription/);
  assert.match(dashboardSource, /const CURRENT_STATUS_MEANINGS: Record<string, string>/);
  assert.match(dashboardSource, /"pending release":/);
  assert.match(dashboardSource, /"released":/);
  assert.match(dashboardSource, /Meanings of \{values\.length\} values in the loaded Varsity records/);
  assert.match(dashboardSource, /valueGlossary instanceof HTMLDetailsElement/);
});

test("field guide explains loaded permitted and discretionary values", () => {
  assert.match(dashboardSource, /const PERMITTED_DISCRETIONARY_MEANINGS: Record<string, string>/);
  assert.match(dashboardSource, /"permitted with a relaxation":/);
  assert.match(dashboardSource, /"discretionary":/);
  assert.match(dashboardSource, /"unspecified":/);
  assert.match(dashboardSource, /"permitted-discretionary": permittedDiscretionaryValueMeanings\(permits\)/);
});
