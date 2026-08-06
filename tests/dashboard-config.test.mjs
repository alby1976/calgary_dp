import assert from "node:assert/strict";
import test from "node:test";
import config from "../config/dashboard.json" with { type: "json" };

const requiredMappings = [
  "permitNumber",
  "address",
  "description",
  "status",
  "appliedDate",
  "appealNumber",
  "latitude",
  "longitude",
];

test("dashboard configuration contains a complete, changeable feed definition", () => {
  assert.equal(new URL(config.feed.baseUrl).protocol, "https:");
  assert.equal(new URL(config.feed.datasetPageUrl).protocol, "https:");
  assert.match(config.feed.resourceDatasetId, /^[a-z0-9]{4}-[a-z0-9]{4}$/i);
  assert.match(config.feed.queryViewId, /^[a-z0-9]{4}-[a-z0-9]{4}$/i);
  assert.ok(config.feed.filter.field);
  assert.ok(config.feed.filter.value);
  assert.ok(config.feed.selectFields.includes(config.feed.filter.field));
  assert.ok(config.feed.selectFields.includes(config.feed.order.field));

  for (const mapping of requiredMappings) {
    assert.ok(config.feed.fieldMap[mapping], `missing fieldMap.${mapping}`);
  }
});

test("external application link remains configuration-driven", () => {
  assert.match(config.links.developmentApplicationUrlTemplate, /\{permitNumber\}/);
  assert.equal(new URL(config.links.activeAppealsUrl).protocol, "https:");
  assert.ok(config.links.appealReportsHost);
});
