#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

command -v timeout >/dev/null || {
  echo "build-verified.sh requires GNU timeout." >&2
  exit 69
}

vinext="${SITES_PROJECT_ROOT}/node_modules/.bin/vinext"
if [[ ! -x "${vinext}" ]]; then
  echo "vinext is unavailable. Run npm run install:ci and wait for it to finish before building." >&2
  exit 69
fi

echo "Running bounded vinext build..."
timeout \
  --signal=TERM \
  --kill-after="${SITES_BUILD_KILL_AFTER:-10s}" \
  "${SITES_BUILD_TIMEOUT:-3m}" \
  "${vinext}" build

# MapLibre GL v6 resolves its module worker beside the browser bundle at
# /assets/maplibre-gl-worker.mjs. Vite currently leaves that dependency-owned
# module out of dist/client, so package it explicitly for both Sites and direct
# Cloudflare Worker deployments.
maplibre_worker="${SITES_PROJECT_ROOT}/node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs"
client_assets="${SITES_PROJECT_ROOT}/dist/client/assets"
migrations_source="${SITES_PROJECT_ROOT}/drizzle"
migrations_target="${SITES_PROJECT_ROOT}/dist/server/drizzle"

[[ -s "${maplibre_worker}" ]] || {
  echo "Missing MapLibre worker module: ${maplibre_worker}" >&2
  exit 66
}

mkdir -p "${client_assets}"
cp "${maplibre_worker}" "${client_assets}/maplibre-gl-worker.mjs"

# Wrangler's direct D1 migration command reads the generated configuration in
# dist/server, so keep the migration files beside that configuration as well as
# in the Sites-specific dist/.openai package.
[[ -d "${migrations_source}" ]] || {
  echo "Missing D1 migrations directory: ${migrations_source}" >&2
  exit 66
}
rm -rf "${migrations_target}"
cp -R "${migrations_source}" "${migrations_target}"

"${script_dir}/validate-artifact.sh"
