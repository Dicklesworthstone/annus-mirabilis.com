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
