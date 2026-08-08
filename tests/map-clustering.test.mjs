import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardSource = await readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8");
const streetMapSource = await readFile(new URL("../app/permit-map.tsx", import.meta.url), "utf8");

test("both maps represent every filtered coordinate without a fixed record cap", () => {
  assert.doesNotMatch(dashboardSource, /plotted\.slice\(/);
  assert.match(dashboardSource, /clusterOverviewPoints\(plotted/);
  assert.match(dashboardSource, /points=\{plotted\}/);
  assert.match(dashboardSource, /permits represented/);
});

test("street map clusters points and expands clusters on selection", () => {
  assert.match(streetMapSource, /cluster:\s*true/);
  assert.match(streetMapSource, /point_count_abbreviated/);
  assert.match(streetMapSource, /getClusterExpansionZoom/);
  assert.match(streetMapSource, /onSelectRef\.current\(permitNumber\)/);
});

test("street map reports viewport permits out of the filtered total", () => {
  assert.match(streetMapSource, /map\.on\("moveend", updateVisibleCount\)/);
  assert.match(streetMapSource, /pointsInsideViewport\(map, points/);
  assert.match(streetMapSource, /of \{points\.length\.toLocaleString\("en-CA"\)\} filtered permits in view/);
});
