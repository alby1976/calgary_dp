import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import config from "../config/dashboard.json" with { type: "json" };

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const documents = [
  "README.md",
  "docs/CONFIGURATION.md",
  "docs/ARCHITECTURE.md",
  "docs/TROUBLESHOOTING.md",
  "docs/THIRD-PARTY-HOSTING.md",
];

test("documentation has no broken relative file links", () => {
  for (const document of documents) {
    const content = readFileSync(resolve(projectRoot, document), "utf8");
    const links = [...content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);

    for (const link of links) {
      if (/^(?:https?:|mailto:|#)/.test(link)) continue;
      const relativePath = decodeURIComponent(link.split("#")[0].split("?")[0]);
      const target = resolve(projectRoot, dirname(document), relativePath);
      assert.ok(existsSync(target), `${document} links to missing file ${link}`);
    }
  }
});

test("configuration guide documents every top-level configuration section", () => {
  const guide = readFileSync(resolve(projectRoot, "docs/CONFIGURATION.md"), "utf8");
  for (const section of Object.keys(config)) {
    assert.match(guide, new RegExp(`\\b${section}\\b`), `missing documentation for ${section}`);
  }
});
