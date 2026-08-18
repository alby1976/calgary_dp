import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardSource = await readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8");

test("appeal filter can independently include or exclude appealed and non-appealed permits", () => {
  assert.match(dashboardSource, /return permit\.sdabnumber\?\.trim\(\) \? "appealed" : "not-appealed"/);
  assert.match(dashboardSource, /!excludedAppealStatusSet\.has\(appealFilterValue\(permit\)\)/);
  assert.match(dashboardSource, /const APPEAL_FILTER_VALUES = \["appealed", "not-appealed"\]/);
});

test("clear filters restores all appeal statuses", () => {
  assert.match(dashboardSource, /excludedAppealStatuses: \[],/);
});
