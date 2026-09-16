import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { InlineScriptRegistry } from "../../src/app/inline-scripts/registry.ts";
import {
  buildInlineScriptHashManifest,
  checkInlineScriptsAgainstRegistry,
  extractInlineScripts,
  serializeInlineScriptHashManifest,
  sha256Base64,
} from "./inline-script-hashes.ts";

function independentSha256Base64(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64");
}

test("sha256Base64 matches an independently computed digest, and a one-character change changes it", () => {
  const source = "document.documentElement.dataset.theme = 'annalen';";
  assert.equal(sha256Base64(source), independentSha256Base64(source));
  const mutated = `${source} `;
  assert.notEqual(sha256Base64(mutated), sha256Base64(source));
});

const THEME_ENTRY = {
  id: "theme",
  ownerBeadId: "am-design-themes-typography-288q",
  module: "src/app/inline-scripts/theme.ts",
  source: "document.documentElement.dataset.theme='annalen';",
  routes: "all",
} as const;

const DETAIL_ENTRY = {
  id: "detail",
  ownerBeadId: "am-read-detail-axis-sfc",
  module: "src/app/inline-scripts/detail.ts",
  source: "document.documentElement.dataset.detail='1';",
  routes: ["/papers/brownian-motion/"],
} as const;

const REGISTRY: InlineScriptRegistry = Object.freeze([THEME_ENTRY, DETAIL_ENTRY]);

test("the manifest is sorted by id and byte-identical across two runs on the same inputs", () => {
  const options = { buildRevision: "abc123", generatedAt: "2026-01-01T00:00:00.000Z" };
  const first = buildInlineScriptHashManifest(REGISTRY, options);
  const second = buildInlineScriptHashManifest(REGISTRY, options);
  assert.deepEqual(first.scripts.map((s) => s.id), ["detail", "theme"]);
  assert.equal(serializeInlineScriptHashManifest(first), serializeInlineScriptHashManifest(second));
  const themeEntry = first.scripts.find((s) => s.id === "theme");
  assert.equal(themeEntry?.sha256, sha256Base64(THEME_ENTRY.source));
  assert.equal(themeEntry?.length, Buffer.byteLength(THEME_ENTRY.source, "utf8"));
});

test("an empty registry with no inline scripts in the HTML passes, which is the scaffold's baseline", () => {
  const issues = checkInlineScriptsAgainstRegistry([], { "/": "<html><body>hello</body></html>" });
  assert.deepEqual(issues, []);
});

test("an inline <script src=\"...\"> is ignored, because only elements without src carry hashable content", () => {
  const found = extractInlineScripts('<script src="/_next/static/a.js"></script><script>1+1</script>');
  assert.equal(found.length, 1);
  assert.equal(found[0]?.source, "1+1");
});

test("an HTML fixture whose inline script matches a registry entry passes", () => {
  const html = `<html><head><script>${THEME_ENTRY.source}</script></head><body>ok</body></html>`;
  const issues = checkInlineScriptsAgainstRegistry(REGISTRY, { "/": html });
  // the "detail" entry is scoped to /papers/brownian-motion/, which this fixture never emits
  assert.deepEqual(issues, [{ kind: "stale-entry", id: "detail", ownerBeadId: "am-read-detail-axis-sfc" }]);
});

test("an HTML fixture with an extra unregistered inline script fails naming the route, the hash, and the excerpt", () => {
  const htmlByRoute = {
    "/": `<script>${THEME_ENTRY.source}</script>`,
    "/papers/brownian-motion/": `<script>${THEME_ENTRY.source}</script><script>${DETAIL_ENTRY.source}</script><script>evil()</script>`,
  };
  const issues = checkInlineScriptsAgainstRegistry(REGISTRY, htmlByRoute);
  assert.equal(issues.length, 1);
  assert.deepEqual(issues[0], {
    kind: "unregistered-script",
    route: "/papers/brownian-motion/",
    sha256: sha256Base64("evil()"),
    excerpt: "evil()",
  });
});

test("an HTML fixture missing a registered entry's script fails naming the stale entry", () => {
  const htmlByRoute = { "/": `<script>${THEME_ENTRY.source}</script>` };
  const issues = checkInlineScriptsAgainstRegistry(REGISTRY, htmlByRoute);
  assert.deepEqual(issues, [{ kind: "stale-entry", id: "detail", ownerBeadId: "am-read-detail-axis-sfc" }]);
});

test("an entry whose source differs from the emitted bytes by trailing whitespace fails, since CSP hashes are byte-exact", () => {
  const registry: InlineScriptRegistry = Object.freeze([{ ...THEME_ENTRY }]);
  const emittedWithTrailingWhitespace = `${THEME_ENTRY.source} `;
  const htmlByRoute = { "/": `<script>${emittedWithTrailingWhitespace}</script>` };
  const issues = checkInlineScriptsAgainstRegistry(registry, htmlByRoute);
  assert.deepEqual(issues, [
    { kind: "unregistered-script", route: "/", sha256: sha256Base64(emittedWithTrailingWhitespace), excerpt: emittedWithTrailingWhitespace },
    { kind: "stale-entry", id: "theme", ownerBeadId: "am-design-themes-typography-288q" },
  ]);
});
