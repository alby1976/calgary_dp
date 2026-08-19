import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const viteConfig = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("direct Cloudflare builds target the configured D1 database", () => {
  assert.match(viteConfig, /binding: d1/);
  assert.match(viteConfig, /database_name: "varsity-development-watch-db"/);
  assert.match(viteConfig, /database_id: CLOUDFLARE_D1_DATABASE_ID/);
  assert.match(viteConfig, /988127e3-a01d-4780-a23b-68cf92be351d/);
  assert.doesNotMatch(viteConfig, /00000000-0000-4000-8000-000000000000/);
  assert.equal(
    packageJson.scripts["db:migrate:cloudflare"],
    "wrangler d1 migrations apply varsity-development-watch-db --remote --config dist/server/wrangler.json",
  );
  assert.equal(
    packageJson.scripts["deploy:cloudflare"],
    "npm run db:migrate:cloudflare && wrangler deploy --config dist/server/wrangler.json",
  );
  assert.equal(
    packageJson.scripts["preview:cloudflare"],
    "wrangler versions upload --config dist/server/wrangler.json",
  );
});

test("production build packages the complete MapLibre module worker", async () => {
  const workerUrl = new URL("../dist/client/assets/maplibre-gl-worker.mjs", import.meta.url);
  const workerStat = await stat(workerUrl);
  assert.ok(workerStat.size > 1_000, "MapLibre worker should be a non-empty production asset");

  const workerSource = await readFile(workerUrl, "utf8");
  assert.match(workerSource, /\.\/maplibre-gl-shared\.mjs/);

  const sharedUrl = new URL("../dist/client/assets/maplibre-gl-shared.mjs", import.meta.url);
  const sharedStat = await stat(sharedUrl);
  assert.ok(sharedStat.size > 100_000, "MapLibre shared worker module should be packaged beside the worker");

  const migrationUrl = new URL(
    "../dist/server/drizzle/0000_sturdy_dexter_bennett.sql",
    import.meta.url,
  );
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /CREATE TABLE `canlii_metadata_cache`/);
  assert.match(migration, /CREATE TABLE `canlii_rate_state`/);

  const generatedWrangler = JSON.parse(
    await readFile(new URL("../dist/server/wrangler.json", import.meta.url), "utf8"),
  );
  const database = generatedWrangler.d1_databases.find(({ binding }) => binding === "DB");
  assert.equal(database.database_name, "varsity-development-watch-db");
  assert.equal(database.database_id, "988127e3-a01d-4780-a23b-68cf92be351d");
});
