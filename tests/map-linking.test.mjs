import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mapSource = await readFile(new URL("../app/permit-map.tsx", import.meta.url), "utf8");
const dashboardSource = await readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8");

test("renders every permit as its own GeoJSON point in both map views", () => {
  assert.match(mapSource, /data: featureCollection\(pointsRef\.current\)/);
  assert.match(mapSource, /one point per permit record/);
  assert.match(mapSource, /Each map point represents one permit record/);
  assert.match(mapSource, /onSelectRef\.current\(permitNumber\)/);
});

test("linked selection visibly highlights and zooms the street map to the selected permit", () => {
  assert.match(mapSource, /element\.classList\.toggle\("selected"/);
  assert.match(mapSource, /permitNumber === selectedPermitNumber/);
  assert.match(mapSource, /const selectionZoom = view === "overview"/);
  assert.match(mapSource, /Math\.min\(mapConfig\.maxZoom, 18\)/);
  assert.match(mapSource, /map\.easeTo\(\{/);
  assert.match(mapSource, /zoom: Math\.max\(map\.getZoom\(\), selectionZoom\)/);
});

test("the initially selected first permit centers the street-level map", () => {
  const streetMapProps = dashboardSource.match(
    /<h2>Street-level permit map<\/h2>[\s\S]*?<PermitMap([\s\S]*?)\/>/,
  )?.[1];

  assert.ok(streetMapProps, "expected to find the street-level PermitMap");
  assert.match(streetMapProps, /selectedPermitNumber=\{selectedPermit\?\.permitnum\}/);
  assert.match(streetMapProps, /focusPermitNumber=\{selectedPermit\?\.permitnum\}/);
  assert.match(streetMapProps, /view="street"/);
});
