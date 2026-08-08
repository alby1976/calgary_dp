import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, developmentPreviewMeta);
  assert.match(html, /Varsity Development Watch/i);
  assert.match(html, /config\/dashboard\.json/i);
  assert.match(html, /Map data © OpenStreetMap contributors/i);
  assert.match(html, /Fit visible permits/i);
  assert.match(html, /Community activity pattern/i);
  assert.match(html, /Community activity pattern colour legend/i);
  assert.match(html, /Active \/ under review/i);
  assert.match(html, /Approved \/ released/i);
  assert.match(html, /Refused \/ cancelled/i);
  assert.match(html, /Other status/i);
  assert.match(html, /All appeal statuses/i);
  assert.match(html, /Appealed to SDAB/i);
  assert.match(html, /Still moving through the City process/i);
  assert.match(html, /The City said yes—check which stage/i);
  assert.match(html, /Stopped in its current form/i);
  assert.match(html, /Read the exact City status before drawing a conclusion/i);
  assert.match(html, /Street-level permit map/i);
  assert.match(html, /Linked selection · both views/i);
  assert.match(html, /Open data is an early signal/i);
  assert.match(html, /Development Map \(DMap\)/i);
  assert.match(html, /Double-check Calgary(?:&#x27;|&apos;|')s official Development Map/i);
  assert.match(html, /permit-specific link above is only a convenience/i);
  const dashboardSource = await readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8");
  assert.match(dashboardSource, /Highlighted in the community overview and the street-level map/i);
});
