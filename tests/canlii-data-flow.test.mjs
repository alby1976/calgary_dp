import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import config from "../config/dashboard.json" with { type: "json" };

const workerSource = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
const dashboardSource = await readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8");
const schemaSource = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");

test("CanLII key remains server-side", () => {
  assert.match(workerSource, /env\.CANLII_API_KEY/);
  assert.doesNotMatch(dashboardSource, /CANLII_API_KEY/);
  assert.doesNotMatch(JSON.stringify(config), /api[_-]?key/i);
});

test("CanLII requests use durable caching and global coordination", () => {
  assert.match(schemaSource, /canlii_metadata_cache/);
  assert.match(schemaSource, /canlii_rate_state/);
  assert.match(schemaSource, /canlii_request_log/);
  assert.match(workerSource, /lease_until/);
  assert.match(workerSource, /last_started_at/);
  assert.match(workerSource, /24 \* 60 \* 60 \* 1000/);
  assert.match(workerSource, /dailyQueryLimit/);
  assert.match(workerSource, /requestsPerSecond/);
});

test("dashboard requests metadata only for a selected appeal and preserves fallbacks", () => {
  assert.match(dashboardSource, /\/api\/canlii-metadata\?appeal=/);
  assert.match(dashboardSource, /selectedAppealNumber/);
  assert.match(dashboardSource, /Search CanLII:/);
  assert.match(dashboardSource, /Browse all Calgary SDAB decisions on CanLII/);
});
