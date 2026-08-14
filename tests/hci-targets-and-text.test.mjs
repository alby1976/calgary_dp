import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const mapSource = await readFile(new URL("../app/permit-map.tsx", import.meta.url), "utf8");

test("map points and legend controls provide 44 CSS-pixel targets", () => {
  assert.match(mapSource, /element\.className = \[/);
  assert.match(mapSource, /"permit-map-marker"/);
  assert.match(css, /\.permit-map-marker \{ width: 44px; height: 44px;/);
  assert.match(css, /\.legend-item \{[^}]*min-width: 44px;[^}]*min-height: 44px;/s);
  assert.match(css, /\.permit-map \.maplibregl-ctrl button \{ width: 44px; height: 44px; \}/);
  assert.match(css, /\.fit-map-button \{ min-height: 44px;/);
});

test("ordinary map and appeal explanations use at least 14-pixel text", () => {
  const explanatorySelectors = [
    ".map-note",
    ".status-guide-popover > p:last-child",
    ".appeal-missing-explanation",
    ".appeal-decision-card .decision-meaning",
    ".appeal-record-note",
    ".appeal-dummies-guide dd",
    ".canlii-state",
    ".appeal-action .appeal-note",
    ".plans-action p",
    ".guide-cards p",
    ".scope-copy p",
  ];

  for (const selector of explanatorySelectors) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(css, new RegExp(`${escaped} \\{[^}]*font-size: (?:14|15|16)px;`, "s"), selector);
  }
});
