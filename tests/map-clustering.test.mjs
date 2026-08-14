import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardSource = await readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8");
const streetMapSource = await readFile(new URL("../app/permit-map.tsx", import.meta.url), "utf8");

test("both maps receive every filtered coordinate without clustering or a record cap", () => {
  assert.doesNotMatch(dashboardSource, /plotted\.slice\(/);
  assert.equal((dashboardSource.match(/points=\{plotted\}/g) ?? []).length, 2);
  assert.match(dashboardSource, /view="overview"/);
  assert.match(dashboardSource, /view="street"/);
  assert.doesNotMatch(dashboardSource, /clusterOverviewPoints/);
  assert.doesNotMatch(streetMapSource, /cluster:\s*true/);
});

test("each GeoJSON feature and rendered point corresponds to one permit record", () => {
  assert.match(streetMapSource, /features: points\.map/);
  assert.match(streetMapSource, /return points\.map\(\(point\) =>/);
  assert.match(streetMapSource, /new MapLibreMarker/);
  assert.match(streetMapSource, /element\.addEventListener\("click"/);
  assert.match(streetMapSource, /permit-map-marker-dot/);
  assert.doesNotMatch(streetMapSource, /point_count/);
  assert.match(streetMapSource, /onSelectRef\.current\(permitNumber\)/);
});

test("both map instances report viewport permit points out of the filtered total", () => {
  assert.match(streetMapSource, /initializedMap\.on\("moveend", updateVisibleCount\)/);
  assert.match(streetMapSource, /pointsInsideViewport\(map, points/);
  assert.match(streetMapSource, /of \{points\.length\.toLocaleString\("en-CA"\)\} permit points in this view/);
  assert.match(streetMapSource, /\{mapReady && \(/);
  assert.match(streetMapSource, /Math\.min\(visiblePointCount, points\.length\)/);
});
