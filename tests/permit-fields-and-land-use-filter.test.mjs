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
    assert.match(dashboardSource, new RegExp(`<dt>${label.replace("/", "\\/")}</dt>`), label);
  }
});
