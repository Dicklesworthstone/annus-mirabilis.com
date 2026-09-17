import assert from "node:assert/strict";
import test from "node:test";
import type { AppBuildManifest } from "./initialRouteGraph.ts";
import { checkInitialRouteGraph, normalizeAppManifestKey } from "./initialRouteGraph.ts";

test("normalizeAppManifestKey mirrors Next's normalizeAppPath for root and nested pages", () => {
  assert.equal(normalizeAppManifestKey("page"), "/");
  assert.equal(normalizeAppManifestKey("about/page"), "/about");
  assert.equal(normalizeAppManifestKey("papers/[slug]/page"), "/papers/[slug]");
  assert.equal(normalizeAppManifestKey("(marketing)/about/page"), "/about");
  assert.equal(normalizeAppManifestKey("dashboard/@sidebar/page"), "/dashboard");
});

const CLEAN_MANIFEST: AppBuildManifest = {
  pages: {
    page: ["static/chunks/main-app.js", "static/chunks/app/page.js"],
  },
};

test("a clean route manifest passes", () => {
  const result = checkInitialRouteGraph({ route: "/", manifest: CLEAN_MANIFEST });
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual([...result.chunks], CLEAN_MANIFEST.pages.page);
});

test("a chunk containing WebGLRenderer fails naming the chunk and the signature", () => {
  const result = checkInitialRouteGraph({
    route: "/",
    manifest: CLEAN_MANIFEST,
    chunkContents: {
      "static/chunks/app/page.js": "const r = new THREE.WebGLRenderer({ antialias: true });",
    },
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.violations.length, 1);
  assert.deepEqual(result.violations[0], {
    kind: "chunk-signature",
    chunk: "static/chunks/app/page.js",
    signature: "WebGLRenderer",
    excerpt: "const r = new THREE.WebGLRenderer({ antialias: true });".slice(
      "const r = new THREE.".length,
      "const r = new THREE.".length + 200,
    ),
  });
});

test("a module trace containing node_modules/pdfjs-dist/ fails", () => {
  const result = checkInitialRouteGraph({
    route: "/",
    manifest: CLEAN_MANIFEST,
    moduleTrace: ["node_modules/react/index.js", "node_modules/pdfjs-dist/build/pdf.js"],
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.violations, [
    {
      kind: "module-trace",
      module: "node_modules/pdfjs-dist/build/pdf.js",
      signature: "node_modules/pdfjs-dist/",
    },
  ]);
});

test("a .wasm entry fails", () => {
  const manifest: AppBuildManifest = {
    pages: { page: ["static/chunks/app/page.js", "static/wasm/frankensim.wasm"] },
  };
  const result = checkInitialRouteGraph({ route: "/", manifest });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.violations, [
    { kind: "chunk-filename", chunk: "static/wasm/frankensim.wasm", signature: ".wasm" },
  ]);
});

test("a route argument that does not exist in the manifest fails with a readable error rather than passing vacuously", () => {
  const result = checkInitialRouteGraph({ route: "/nonexistent", manifest: CLEAN_MANIFEST });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.reason, /\/nonexistent does not exist in the manifest/);
});

test("a route whose manifest lists no chunks fails", () => {
  const manifest: AppBuildManifest = { pages: { page: [] } };
  const result = checkInitialRouteGraph({ route: "/", manifest });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.reason, /lists no chunks/);
});

test("byte accounting: 204,800 bytes passes and 204,801 bytes fails", () => {
  // Boundary test: exactly 204,800 bytes
  const passManifest: AppBuildManifest = {
    pages: { page: ["static/chunks/exact-budget.js"] },
  };
  const passResult = checkInitialRouteGraph({
    route: "/",
    manifest: passManifest,
    chunkSizes: {
      "static/chunks/exact-budget.js": { raw: 400_000, gzip: 250_000, brotli: 204_800 },
    },
  });
  assert.equal(passResult.ok, true);
  assert.equal(passResult.byteAccounting?.effectiveBytes, 204_800);
  assert.equal(passResult.byteAccounting?.overBudget, false);

  // Boundary test: 204,801 bytes (1 byte over budget)
  const failManifest: AppBuildManifest = {
    pages: { page: ["static/chunks/over-budget.js"] },
  };
  const failResult = checkInitialRouteGraph({
    route: "/",
    manifest: failManifest,
    chunkSizes: {
      "static/chunks/over-budget.js": { raw: 400_000, gzip: 250_000, brotli: 204_801 },
    },
  });
  assert.equal(failResult.ok, false);
  assert.equal(failResult.byteAccounting?.effectiveBytes, 204_801);
  assert.equal(failResult.byteAccounting?.overBudget, true);
  if (!failResult.ok) {
    assert.equal(failResult.violations.length, 1);
    assert.equal(failResult.violations[0].kind, "byte-budget");
    assert.match(failResult.reason, /exceeds initial client JavaScript budget/);
  }
});

test("byte accounting on gzip encoding option", () => {
  const manifest: AppBuildManifest = {
    pages: { page: ["static/chunks/app.js"] },
  };
  const result = checkInitialRouteGraph({
    route: "/",
    manifest,
    preferredEncoding: "gzip",
    chunkSizes: {
      "static/chunks/app.js": { raw: 100_000, gzip: 45_000, brotli: 35_000 },
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.byteAccounting?.effectiveBytes, 45_000);
  assert.equal(result.byteAccounting?.encoding, "gzip");
});
