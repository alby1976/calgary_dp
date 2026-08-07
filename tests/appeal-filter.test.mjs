import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardSource = await readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8");

test("appeal filter selects permits with a recorded SDAB number", () => {
  assert.match(dashboardSource, /appealFilter === "all" \|\| Boolean\(permit\.sdabnumber\?\.trim\(\)\)/);
  assert.match(dashboardSource, /value="appealed">Appealed to SDAB/);
});

test("clear filters restores all appeal statuses", () => {
  assert.match(dashboardSource, /setAppealFilter\("all"\)/);
});
