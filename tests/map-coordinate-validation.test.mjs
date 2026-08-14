import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardSource = await readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8");

test("blank and out-of-community coordinates never enter map bounds", () => {
  assert.match(dashboardSource, /if \(!value\?\.trim\(\)\) return null/);
  assert.match(dashboardSource, /coordinate >= minimum && coordinate <= maximum/);
  assert.doesNotMatch(dashboardSource, /lat: Number\(permit\.latitude\)/);
  assert.doesNotMatch(dashboardSource, /lon: Number\(permit\.longitude\)/);
});
