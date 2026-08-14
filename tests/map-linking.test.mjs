import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mapSource = await readFile(new URL("../app/permit-map.tsx", import.meta.url), "utf8");

test("renders every permit as its own GeoJSON point in both map views", () => {
  assert.match(mapSource, /data: featureCollection\(pointsRef\.current\)/);
  assert.match(mapSource, /one point per permit record/);
  assert.match(mapSource, /Each map point represents one permit record/);
  assert.match(mapSource, /onSelectRef\.current\(permitNumber\)/);
});

test("linked selection visibly highlights and centres the street map", () => {
  assert.match(mapSource, /element\.classList\.toggle\("selected"/);
  assert.match(mapSource, /permitNumber === selectedPermitNumber/);
  assert.match(mapSource, /map\.easeTo\(\{/);
  assert.match(mapSource, /view === "overview" \? 13 : 15/);
});
