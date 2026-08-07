import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardSource = await readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8");

test("recorded appeals retain official fallbacks when a package link is absent", () => {
  assert.match(dashboardSource, /Appeal package not currently linked/);
  assert.match(dashboardSource, /Formatted from Calgary’s SDAB Decisions JSON/);
  assert.match(dashboardSource, /Plain-language guide: what do these fields mean\?/);
  assert.match(dashboardSource, /Original City decision/);
  assert.match(dashboardSource, /Written decision issued/);
  assert.match(dashboardSource, /Contact SDAB about archived documents/);
  assert.match(dashboardSource, /appealdecisionrecord \?\?/);
  assert.match(dashboardSource, /Development Permits feed/);
  assert.match(dashboardSource, /View original Calgary JSON source/);
  assert.match(dashboardSource, /Search CanLII:/);
  assert.match(dashboardSource, /Browse all Calgary SDAB decisions on CanLII/);
  assert.match(dashboardSource, /does not copy or scrape its decision documents/);
  assert.match(dashboardSource, /Official decision catalogue record/);
  assert.match(dashboardSource, /Read the complete decision on CanLII/);
  assert.match(dashboardSource, /Plain-language guide: what is CanLII metadata\?/);
  assert.match(dashboardSource, /API key has not been installed/);
});

test("decision record links normalize SDAB-prefixed appeal numbers", () => {
  assert.match(dashboardSource, /\(20\\d\{2\}-\\d\{4\}\)/);
  assert.match(dashboardSource, /decisionRecordPageUrlTemplate/);
  assert.match(dashboardSource, /decisionRecordApiUrlTemplate/);
});
