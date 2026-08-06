import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mapSource = await readFile(new URL("../app/permit-map.tsx", import.meta.url), "utf8");

test("renders street-map permits as accessible DOM markers", () => {
  assert.match(mapSource, /new Marker\(\{ element, anchor: "center" \}\)/);
  assert.match(mapSource, /element\.type = "button"/);
  assert.match(mapSource, /onSelectRef\.current\(permitNumber\)/);
});

test("linked selection visibly highlights and centres the street map", () => {
  assert.match(mapSource, /classList\.toggle\("selected", isSelected\)/);
  assert.match(mapSource, /map\.easeTo\(\{/);
  assert.match(mapSource, /zoom: Math\.max\(map\.getZoom\(\), 15\)/);
});
