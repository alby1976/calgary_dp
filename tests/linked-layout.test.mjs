import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardSource = await readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("linked maps share the left column and details use the right column", () => {
  assert.match(dashboardSource, /className="linked-map-stack"/);
  assert.match(dashboardSource, /Community activity pattern/);
  assert.match(dashboardSource, /Street-level permit map/);
  assert.match(dashboardSource, /Linked selection · both views/);
  assert.match(styles, /\.linked-map-grid\s*\{[^}]*grid-template-columns:/s);
  assert.match(styles, /\.linked-detail-panel\s*\{[^}]*position:\s*sticky/s);
});

test("linked workspace collapses safely on smaller screens", () => {
  assert.match(styles, /@media \(max-width: 960px\)[\s\S]*\.linked-detail-panel\s*\{[^}]*position:\s*static/s);
  assert.match(styles, /@media \(max-width: 960px\)[\s\S]*\.linked-map-grid[^}]*grid-template-columns:\s*1fr/s);
});
