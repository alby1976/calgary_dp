import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import config from "../config/dashboard.json" with { type: "json" };

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const documents = [
  "README.md",
  "docs/USING-THE-DASHBOARD.md",
  "docs/HCI-USABILITY-FINDINGS.md",
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

test("documentation explains linked selection and the stable CanLII decision route", () => {
  const readme = readFileSync(resolve(projectRoot, "README.md"), "utf8");
  const userGuide = readFileSync(resolve(projectRoot, "docs/USING-THE-DASHBOARD.md"), "utf8");
  const configurationGuide = readFileSync(resolve(projectRoot, "docs/CONFIGURATION.md"), "utf8");

  assert.match(readme, /coordinated desktop workspace/i);
  assert.match(userGuide, /same permit then becomes selected everywhere/i);
  assert.match(configurationGuide, /id=\{citation\}/);
  assert.match(configurationGuide, /Do not copy `searchId`/);
  assert.match(configurationGuide, /Do not replace `id=\{citation\}` with the older free-text `text=\{citation\}` form/);
});

test("HCI findings preserve priorities and measurable acceptance criteria", () => {
  const findings = readFileSync(resolve(projectRoot, "docs/HCI-USABILITY-FINDINGS.md"), "utf8");

  assert.match(findings, /\| Critical \|/);
  assert.match(findings, /former 500-record truncation/i);
  assert.match(findings, /one GeoJSON point per filtered record/i);
  assert.match(findings, /Acceptance criterion/);
  assert.match(findings, /moderated test with five Varsity residents or civic-committee members/i);
  assert.match(findings, /44×44 CSS-pixel/i);
  assert.match(findings, /ordinary explanatory text now uses 14–16 pixels/i);
});

test("documentation describes the released target sizes and readable text", () => {
  const readme = readFileSync(resolve(projectRoot, "README.md"), "utf8");
  const userGuide = readFileSync(resolve(projectRoot, "docs/USING-THE-DASHBOARD.md"), "utf8");
  const architecture = readFileSync(resolve(projectRoot, "docs/ARCHITECTURE.md"), "utf8");
  const hostingGuide = readFileSync(resolve(projectRoot, "docs/THIRD-PARTY-HOSTING.md"), "utf8");

  for (const document of [readme, userGuide, architecture, hostingGuide]) {
    assert.match(document, /44×44 CSS-pixel/i);
    assert.match(document, /14–16(?:-| )pixel/i);
  }

  assert.match(architecture, /transparent hit layer/i);
  assert.doesNotMatch(architecture, /accessible DOM permit markers/i);
  assert.match(userGuide, /does not represent a parcel/i);
});

test("documentation explains the proactive Open Data to DMap workflow", () => {
  const readme = readFileSync(resolve(projectRoot, "README.md"), "utf8");
  const userGuide = readFileSync(resolve(projectRoot, "docs/USING-THE-DASHBOARD.md"), "utf8");
  const findings = readFileSync(resolve(projectRoot, "docs/HCI-USABILITY-FINDINGS.md"), "utf8");

  assert.match(readme, /proactive early-warning tool/i);
  assert.match(readme, /Always double-check the permit number/i);
  assert.match(userGuide, /Development Map \(DMap\)/i);
  assert.match(userGuide, /developmentmap\.calgary\.ca/i);
  assert.match(findings, /must not imply that a DMap record already exists/i);
});
