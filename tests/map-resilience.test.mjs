import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardSource = await readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8");
const mapSource = await readFile(new URL("../app/permit-map.tsx", import.meta.url), "utf8");

test("synchronous MapLibre construction failures become a local unavailable state", () => {
  assert.match(mapSource, /try \{\s*map = new MapLibreMap\(/s);
  assert.match(mapSource, /catch \{\s*markMapUnavailable\(map\);\s*return;/s);
  assert.match(mapSource, /Map unavailable\. Permit records, filters, details and official links remain available\./);
});

test("only fully constructed maps enter normal cleanup and remove is guarded", () => {
  assert.match(mapSource, /Only fully constructed instances enter normal update and cleanup paths/);
  assert.match(mapSource, /mapRef\.current = map/);
  assert.match(mapSource, /function safelyRemoveMap\(map: MapLibreMap \| null\)/);
  assert.match(mapSource, /try \{\s*map\.remove\(\);\s*\} catch \{/s);
  assert.match(mapSource, /safelyRemoveMap\(initializedMap\)/);
  assert.doesNotMatch(mapSource, /return \(\) => \{[^}]*map\.remove\(\)/s);
});

test("each dashboard map is independently contained by an error boundary", () => {
  assert.match(mapSource, /class MapErrorBoundary extends Component/);
  assert.match(mapSource, /static getDerivedStateFromError/);
  assert.match(mapSource, /<MapErrorBoundary mapLabel=\{mapLabel\}>/);
  assert.equal((dashboardSource.match(/<PermitMap/g) ?? []).length, 2);
  assert.match(mapSource, /Community overview map/);
  assert.match(mapSource, /Street-level permit map/);
});
