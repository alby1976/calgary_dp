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

test("land-use district is an exact table filter and can be cleared", () => {
  assert.match(dashboardSource, /const \[landUseDistrict, setLandUseDistrict\] = useState\("all"\)/);
  assert.match(dashboardSource, /landUseDistrictValues\(permit\)\.includes\(landUseDistrict\)/);
  assert.match(dashboardSource, /Filter by land-use district/);
  assert.match(dashboardSource, /All land-use districts/);
  assert.match(dashboardSource, /setLandUseDistrict\("all"\)/);
});

test("permitted or discretionary classification is an exact filter and can be cleared", () => {
  assert.match(dashboardSource, /const \[permittedDiscretionary, setPermittedDiscretionary\] = useState\("all"\)/);
  assert.match(dashboardSource, /permittedDiscretionaryValue\(permit\) === permittedDiscretionary/);
  assert.match(dashboardSource, /Filter by permitted or discretionary classification/);
  assert.match(dashboardSource, /All permitted \/ discretionary/);
  assert.match(dashboardSource, /setPermittedDiscretionary\("all"\)/);
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

test("permit field definitions stay on the main page and open from accessible help controls", () => {
  assert.match(dashboardSource, /const PERMIT_FIELD_DEFINITIONS = \[/);
  assert.match(dashboardSource, /aria-label=\{`Explain \$\{label\}`\}/);
  assert.match(dashboardSource, /aria-controls="permit-field-guide"/);
  assert.match(dashboardSource, /<details id="permit-field-guide"/);
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
