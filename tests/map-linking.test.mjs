import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mapSource = await readFile(new URL("../app/permit-map.tsx", import.meta.url), "utf8");

test("renders every street-map permit through a clustered GeoJSON source", () => {
  assert.match(mapSource, /cluster:\s*true/);
  assert.match(mapSource, /data: featureCollection\(pointsRef\.current\)/);
  assert.match(mapSource, /Numbered circles combine nearby permits/);
  assert.match(mapSource, /onSelectRef\.current\(permitNumber\)/);
});

test("linked selection visibly highlights and centres the street map", () => {
  assert.match(mapSource, /map\.setFilter\(SELECTED_LAYER_ID/);
  assert.match(mapSource, /map\.easeTo\(\{/);
  assert.match(mapSource, /zoom: Math\.max\(map\.getZoom\(\), 15\)/);
});
