import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardSource = await readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("permit explorer, linked maps and details share one coordinated workspace", () => {
  assert.match(dashboardSource, /className="explorer workspace-explorer"/);
  assert.match(dashboardSource, /className="linked-map-stack"/);
  assert.match(dashboardSource, /Community activity pattern/);
  assert.match(dashboardSource, /Street-level permit map/);
  assert.match(dashboardSource, /Linked selection · both views/);
  assert.match(styles, /\.linked-map-grid\s*\{[^}]*grid-template-columns:/s);
  assert.match(styles, /\.workspace-explorer\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.workspace-explorer \.permit-list\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(styles, /\.linked-detail-panel\s*\{[^}]*overflow-y:\s*auto/s);
});

test("linked workspace collapses safely on smaller screens", () => {
  assert.match(styles, /@media \(max-width: 960px\)[\s\S]*\.linked-map-grid\s*\{[^}]*height:\s*auto/s);
  assert.match(styles, /@media \(max-width: 960px\)[\s\S]*\.linked-map-grid[^}]*grid-template-columns:\s*1fr/s);
});

test("a selected older map record stays visible in the collapsed explorer", () => {
  assert.match(dashboardSource, /const latest = recent\.slice\(0, 12\)/);
  assert.match(dashboardSource, /selectedOutsideLatest && selectedPermit[\s\S]*\[selectedPermit, \.\.\.latest\]/);
  assert.match(dashboardSource, /selectedExplorerRow\.current\?\.scrollIntoView\(\{ block: "nearest" \}\)/);
  assert.match(dashboardSource, /Selected permit \{text\(selectedPermit\?\.permitnum\)\} is pinned above the latest 12 permits\./);
  assert.match(styles, /\.permit-row\.selected\s*\{[^}]*box-shadow:\s*inset 4px 0 0 #76bba3/s);
});

test("table filters use a compact toolbar and overlay drawer", () => {
  assert.match(dashboardSource, /className="filter-toolbar"/);
  assert.match(dashboardSource, /className="filter-drawer-toggle"/);
  assert.match(dashboardSource, /aria-controls="permit-filter-drawer"/);
  assert.match(dashboardSource, /role="dialog"/);
  assert.match(dashboardSource, /className="active-filter-chips"/);
  assert.match(dashboardSource, /Show \{filtered\.length\.toLocaleString\("en-CA"\)\} matches/);
  assert.match(styles, /\.filter-drawer-backdrop\s*\{[^}]*position:\s*fixed/s);
  assert.match(styles, /\.filter-drawer\s*\{[^}]*width:\s*min\(420px, 100%\)/s);
  assert.match(styles, /\.workspace-explorer \.permit-list\s*\{[^}]*flex:\s*1 1 auto/s);
});
