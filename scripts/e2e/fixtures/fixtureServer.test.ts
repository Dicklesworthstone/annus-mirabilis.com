import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { startFixtureServer } from "./fixtureServer.ts";

function makeRoots() {
  const base = mkdtempSync(join(tmpdir(), "fixture-server-test-"));
  const staticRoot = join(base, "static");
  const appsRoot = join(base, "apps");
  mkdirSync(staticRoot, { recursive: true });
  mkdirSync(join(appsRoot, "probe-app"), { recursive: true });
  writeFileSync(join(staticRoot, "index.html"), "<html><body>fixture page</body></html>");
  writeFileSync(join(appsRoot, "probe-app", "bundle.js"), "console.log('probe');");
  writeFileSync(join(appsRoot, "probe-app", "manifest.json"), '{"probe":true}');
  const wasmBytes = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
  writeFileSync(join(appsRoot, "probe-app", "artifact.wasm"), wasmBytes);
  return { base, staticRoot, appsRoot, wasmBytes };
}

test("serves a static page, a bundle, and a static input over real HTTP on 127.0.0.1", async () => {
  const { base, staticRoot, appsRoot } = makeRoots();
  const server = await startFixtureServer({ staticRoot, appsRoot });
  try {
    assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+$/);

    const page = await fetch(`${server.url}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /fixture page/);

    const bundle = await fetch(`${server.url}/apps/probe-app/bundle.js`);
    assert.equal(bundle.status, 200);
    assert.equal(bundle.headers.get("content-type"), "application/javascript");
    assert.match(await bundle.text(), /probe/);

    const staticInput = await fetch(`${server.url}/apps/probe-app/manifest.json`);
    assert.equal(staticInput.status, 200);
    assert.equal(staticInput.headers.get("content-type"), "application/json");
  } finally {
    await server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test(".wasm responses carry application/wasm and bytes identical to the source", async () => {
  const { base, staticRoot, appsRoot, wasmBytes } = makeRoots();
  const server = await startFixtureServer({ staticRoot, appsRoot });
  try {
    const response = await fetch(`${server.url}/apps/probe-app/artifact.wasm`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/wasm");
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(bytes, wasmBytes);
  } finally {
    await server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test("response headers equal the configured application headers for the same path", async () => {
  const { base, staticRoot, appsRoot } = makeRoots();
  const configuredHeaders = { "x-fixture-header": "csp-like-value", "cache-control": "no-store" };
  const server = await startFixtureServer({
    staticRoot,
    appsRoot,
    headersForPath: (path) => (path === "/apps/probe-app/bundle.js" ? configuredHeaders : {}),
  });
  try {
    const bundle = await fetch(`${server.url}/apps/probe-app/bundle.js`);
    assert.equal(bundle.headers.get("x-fixture-header"), "csp-like-value");
    assert.equal(bundle.headers.get("cache-control"), "no-store");

    const page = await fetch(`${server.url}/`);
    assert.equal(page.headers.get("x-fixture-header"), null);
  } finally {
    await server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test("a path outside both roots returns 404", async () => {
  const { base, staticRoot, appsRoot } = makeRoots();
  const server = await startFixtureServer({ staticRoot, appsRoot });
  try {
    const response = await fetch(`${server.url}/definitely-not-served.txt`);
    assert.equal(response.status, 404);
  } finally {
    await server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test("a request that tries to escape an application root with .. returns 404", async () => {
  const { base, staticRoot, appsRoot } = makeRoots();
  const server = await startFixtureServer({ staticRoot, appsRoot });
  try {
    const response = await fetch(`${server.url}/apps/probe-app/../../static/index.html`);
    assert.equal(response.status, 404);
    const encoded = await fetch(`${server.url}/apps/probe-app/..%2f..%2fstatic%2findex.html`);
    assert.equal(encoded.status, 404);
  } finally {
    await server.close();
    rmSync(base, { recursive: true, force: true });
  }
});
