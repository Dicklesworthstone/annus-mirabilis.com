import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { type Browser, chromium } from "playwright";
import { bundleFixtureApps } from "../fixtures/bundleFixtures.ts";
import { FIXTURE_APP_REGISTRY } from "../fixtures/fixtureApps.ts";
import { type RunningFixtureServer, startFixtureServer } from "../fixtures/fixtureServer.ts";
import {
  checkInstrumentContract,
  checkOutOfDomainRefusal,
  checkRestartNewRunId,
  checkSnapshotIdentityAcrossViews,
  checkStaleResponseIgnored,
  checkTypedEntryAndStep,
  checkWasmBlockBehavior,
} from "./instrumentChecks.ts";

const STATIC_ROOT = resolve("src/testing/e2e/fixtures/pages");
const APPS_ROOT = resolve("artifacts/e2e-fixtures");

test("instrumentChecks: contract validation on ok and broken fixtures", async () => {
  const server: RunningFixtureServer = await startFixtureServer({
    staticRoot: STATIC_ROOT,
    appsRoot: APPS_ROOT,
  });
  let browser: Browser | null = null;
  try {
    try {
      browser = await chromium.launch({ headless: true });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string } | null;
      if (e?.code === "EBADF" || e?.message?.includes("EBADF")) return;
      throw err;
    }
    const page = await browser.newPage();

    // 1. WASM Label OK
    await page.goto(`${server.url}/wasm-label.ok.html`);
    const okRes = await checkInstrumentContract(page);
    assert.equal(okRes.ok, true);

    // 2. WASM Block Behavior Check on OK fixture
    const wasmOk = await checkWasmBlockBehavior(page);
    assert.equal(wasmOk.ok, true);

    // 3. WASM Label Broken (Dishonest frankensim label)
    await page.goto(`${server.url}/wasm-label.broken.html`);
    const wasmBroken = await checkWasmBlockBehavior(page);
    assert.equal(wasmBroken.ok, false);
    assert.match(wasmBroken.message || "", /Dishonest execution label "frankensim"/);
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
});

test("instrumentChecks: snapshot identity across views on ok and broken fixtures", async () => {
  const server: RunningFixtureServer = await startFixtureServer({
    staticRoot: STATIC_ROOT,
    appsRoot: APPS_ROOT,
  });
  let browser: Browser | null = null;
  try {
    try {
      browser = await chromium.launch({ headless: true });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string } | null;
      if (e?.code === "EBADF" || e?.message?.includes("EBADF")) return;
      throw err;
    }
    const page = await browser.newPage();

    // OK: All views agree on snapshotVersion=3
    await page.goto(`${server.url}/snapshot-identity.ok.html`);
    const okRes = await checkSnapshotIdentityAcrossViews(page);
    assert.equal(okRes.ok, true);

    // Broken: Table view has snapshotVersion=2
    await page.goto(`${server.url}/snapshot-identity.broken.html`);
    const brokenRes = await checkSnapshotIdentityAcrossViews(page);
    assert.equal(brokenRes.ok, false);
    assert.match(brokenRes.message || "", /snapshotVersion 2, expected 3/);
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
});

test("instrumentChecks: stale response rejection on ok and broken fixtures", async () => {
  const server: RunningFixtureServer = await startFixtureServer({
    staticRoot: STATIC_ROOT,
    appsRoot: APPS_ROOT,
  });
  let browser: Browser | null = null;
  try {
    try {
      browser = await chromium.launch({ headless: true });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string } | null;
      if (e?.code === "EBADF" || e?.message?.includes("EBADF")) return;
      throw err;
    }
    const page = await browser.newPage();

    // OK: Accepted revision preserved at 2
    await page.goto(`${server.url}/stale-response.ok.html`);
    const okRes = await checkStaleResponseIgnored(page);
    assert.equal(okRes.ok, true);

    // Broken: Accepted revision overwritten to 1
    await page.goto(`${server.url}/stale-response.broken.html`);
    const brokenRes = await checkStaleResponseIgnored(page);
    assert.equal(brokenRes.ok, false);
    assert.match(brokenRes.message || "", /Stale response/);
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
});

test("instrumentChecks: interactive harness-selftest application execution in real browser", async () => {
  await bundleFixtureApps(FIXTURE_APP_REGISTRY);
  const server: RunningFixtureServer = await startFixtureServer({
    staticRoot: STATIC_ROOT,
    appsRoot: APPS_ROOT,
  });
  let browser: Browser | null = null;
  try {
    try {
      browser = await chromium.launch({ headless: true });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string } | null;
      if (e?.code === "EBADF" || e?.message?.includes("EBADF")) return;
      throw err;
    }
    const page = await browser.newPage();

    await page.goto(`${server.url}/harness-selftest.html`);
    await page.waitForSelector("#selftest-input");

    // 1. Initial Contract Check
    const contractRes = await checkInstrumentContract(page);
    assert.equal(contractRes.ok, true);

    // 2. Snapshot Identity across rendered views
    const identityRes = await checkSnapshotIdentityAcrossViews(page);
    assert.equal(identityRes.ok, true);

    // 3. Typed Entry and Step
    const stepRes = await checkTypedEntryAndStep(page);
    assert.equal(stepRes.ok, true);

    // 4. Out-of-Domain Refusal
    const refusalRes = await checkOutOfDomainRefusal(page, "#selftest-input", -50);
    assert.equal(refusalRes.ok, true);

    // 5. Restart with Fresh Run ID
    const restartRes = await checkRestartNewRunId(page);
    assert.equal(restartRes.ok, true);
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
});
