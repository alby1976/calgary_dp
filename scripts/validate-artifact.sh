#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

worker="${SITES_PROJECT_ROOT}/dist/server/index.js"
hosting="${SITES_PROJECT_ROOT}/dist/.openai/hosting.json"
wrangler_config="${SITES_PROJECT_ROOT}/dist/server/wrangler.json"
maplibre_worker="${SITES_PROJECT_ROOT}/dist/client/assets/maplibre-gl-worker.mjs"
maplibre_shared="${SITES_PROJECT_ROOT}/dist/client/assets/maplibre-gl-shared.mjs"
migration="${SITES_PROJECT_ROOT}/dist/server/drizzle/0000_sturdy_dexter_bennett.sql"

[[ -f "${worker}" ]] || {
  echo "Missing Sites Worker entry: dist/server/index.js" >&2
  exit 66
}
[[ -f "${hosting}" ]] || {
  echo "Missing packaged Sites manifest: dist/.openai/hosting.json" >&2
  exit 66
}
[[ -s "${maplibre_worker}" ]] || {
  echo "Missing packaged MapLibre worker: dist/client/assets/maplibre-gl-worker.mjs" >&2
  exit 66
}
[[ -s "${maplibre_shared}" ]] || {
  echo "Missing packaged MapLibre shared module: dist/client/assets/maplibre-gl-shared.mjs" >&2
  exit 66
}
[[ -f "${wrangler_config}" ]] || {
  echo "Missing generated Wrangler configuration: dist/server/wrangler.json" >&2
  exit 66
}
[[ -s "${migration}" ]] || {
  echo "Missing packaged Cloudflare D1 migration: dist/server/drizzle/0000_sturdy_dexter_bennett.sql" >&2
  exit 66
}

node --input-type=module - "${worker}" "${hosting}" "${wrangler_config}" <<'NODE'
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const [workerPath, hostingPath, wranglerPath] = process.argv.slice(2);
JSON.parse(await readFile(hostingPath, "utf8"));

const wrangler = JSON.parse(await readFile(wranglerPath, "utf8"));
const database = wrangler.d1_databases?.find(({ binding }) => binding === "DB");
if (!database) {
  throw new Error("dist/server/wrangler.json must contain the DB binding");
}
if (database.database_name !== "varsity-development-watch-db") {
  throw new Error("DB binding must target varsity-development-watch-db");
}
if (database.database_id !== "988127e3-a01d-4780-a23b-68cf92be351d") {
  throw new Error("DB binding contains the wrong Cloudflare D1 database ID");
}

const workerUrl = pathToFileURL(workerPath);
workerUrl.searchParams.set("sites-validation", `${process.pid}-${Date.now()}`);
const worker = await import(workerUrl.href);
if (!worker.default || typeof worker.default.fetch !== "function") {
  throw new Error("dist/server/index.js must have an ESM default export with fetch(request, env, ctx)");
}
NODE

echo "Validated deployment artifact: Worker, hosting manifest, D1 binding, migration, and complete MapLibre worker modules are present."
