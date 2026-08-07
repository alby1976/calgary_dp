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
  assert.match(config.links.decisionRecordUrlTemplate, /\{appealNumber\}/);
  assert.match(config.links.decisionRecordUrlTemplate, /\/m84u-n3rp\/data\?q=/);
  assert.doesNotMatch(config.links.decisionRecordUrlTemplate, /\.json/);
  assert.equal(new URL(config.links.appealContactUrl).protocol, "https:");
});

test("street map provider remains valid and configuration-driven", () => {
  assert.equal(new URL(config.map.tileUrlTemplate.replace("{z}", "12").replace("{x}", "1000").replace("{y}", "1000")).protocol, "https:");
  assert.match(config.map.tileUrlTemplate, /\{z\}/);
  assert.match(config.map.tileUrlTemplate, /\{x\}/);
  assert.match(config.map.tileUrlTemplate, /\{y\}/);
  assert.equal(new URL(config.map.attributionUrl).protocol, "https:");
  assert.equal(new URL(config.map.issueUrl).protocol, "https:");
  assert.ok(config.map.minZoom < config.map.maxZoom);
  assert.ok(config.map.overviewLabels.length > 0);
  assert.ok(config.map.overviewLabels.every((label) => label.text && /^road-(one|two|three)$/.test(label.className)));
});
