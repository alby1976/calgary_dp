import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardSource = await readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8");

test("recorded appeals retain official fallbacks when a package link is absent", () => {
  assert.match(dashboardSource, /Appeal package not currently linked/);
  assert.match(dashboardSource, /View Calgary Open Data decision record/);
  assert.match(dashboardSource, /Contact SDAB about archived documents/);
});

test("decision record links normalize SDAB-prefixed appeal numbers", () => {
  assert.match(dashboardSource, /\(20\\d\{2\}-\\d\{4\}\)/);
  assert.match(dashboardSource, /decisionRecordUrlTemplate/);
});
