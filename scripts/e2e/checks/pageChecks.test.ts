import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { type Browser, chromium } from "playwright";
import { type RunningFixtureServer, startFixtureServer } from "../fixtures/fixtureServer.ts";
import {
  checkAccessibilityAxe,
  checkFocusRestoration,
  checkFootnotesAndLocators,
  checkHorizontalOverflow,
  checkMathMLSemantics,
  checkPrintFidelity,
} from "./pageChecks.ts";

const STATIC_ROOT = resolve("src/testing/e2e/fixtures/pages");
const APPS_ROOT = resolve("artifacts/e2e-fixtures");

test("pageChecks: horizontal overflow check on ok and broken fixtures", async () => {
  const server: RunningFixtureServer = await startFixtureServer({
    staticRoot: STATIC_ROOT,
    appsRoot: APPS_ROOT,
  });
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 320, height: 800 } });
    const page = await context.newPage();

    // 1. OK fixture: No horizontal overflow at 320px
    await page.goto(`${server.url}/horizontal-overflow.ok.html`);
    const okRes = await checkHorizontalOverflow(page);
    assert.equal(okRes.ok, true);

    // 2. Broken fixture: 800px fixed width element triggers horizontal overflow
    await page.goto(`${server.url}/horizontal-overflow.broken.html`);
    const brokenRes = await checkHorizontalOverflow(page);
    assert.equal(brokenRes.ok, false);
    assert.match(brokenRes.message || "", /Horizontal overflow detected/);
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
});

test("pageChecks: mathml semantic check on ok and broken fixtures", async () => {
  const server: RunningFixtureServer = await startFixtureServer({
    staticRoot: STATIC_ROOT,
    appsRoot: APPS_ROOT,
  });
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // 1. OK fixture: Has <math><semantics> and no raw LaTeX
    await page.goto(`${server.url}/mathml.ok.html`);
    const okRes = await checkMathMLSemantics(page);
    assert.equal(okRes.ok, true);

    // 2. Broken fixture: Contains raw unparsed $E = mc^2$ text
    await page.goto(`${server.url}/mathml.broken.html`);
    const brokenRes = await checkMathMLSemantics(page);
    assert.equal(brokenRes.ok, false);
    assert.match(brokenRes.message || "", /Raw unparsed LaTeX text found/);
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
});

test("pageChecks: focus restoration check on ok and broken fixtures", async () => {
  const server: RunningFixtureServer = await startFixtureServer({
    staticRoot: STATIC_ROOT,
    appsRoot: APPS_ROOT,
  });
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // 1. OK fixture: Restores focus to opening button
    await page.goto(`${server.url}/focus-restoration.ok.html`);
    const okRes = await checkFocusRestoration(page);
    assert.equal(okRes.ok, true);

    // 2. Broken fixture: Leaves focus un-restored
    await page.goto(`${server.url}/focus-restoration.broken.html`);
    const brokenRes = await checkFocusRestoration(page);
    assert.equal(brokenRes.ok, false);
    assert.match(brokenRes.message || "", /Focus was not restored/);
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
});

test("pageChecks: print fidelity check on ok and broken fixtures", async () => {
  const server: RunningFixtureServer = await startFixtureServer({
    staticRoot: STATIC_ROOT,
    appsRoot: APPS_ROOT,
  });
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // 1. OK fixture: Unclipped equations in print
    await page.goto(`${server.url}/print-clipped.ok.html`);
    const okRes = await checkPrintFidelity(page);
    assert.equal(okRes.ok, true);

    // 2. Broken fixture: Hidden/clipped equations in print
    await page.goto(`${server.url}/print-clipped.broken.html`);
    const brokenRes = await checkPrintFidelity(page);
    assert.equal(brokenRes.ok, false);
    assert.match(brokenRes.message || "", /Print clipping defects found/);
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
});

test("pageChecks: footnote locator reachability and axe-core a11y audit on reading section", async () => {
  const server: RunningFixtureServer = await startFixtureServer({
    staticRoot: STATIC_ROOT,
    appsRoot: APPS_ROOT,
  });
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${server.url}/fixture-section.html`);

    // 1. Footnotes check
    const footnotesRes = await checkFootnotesAndLocators(page);
    assert.equal(footnotesRes.ok, true);

    // 2. MathML semantic check on full fixture section
    const mathRes = await checkMathMLSemantics(page);
    assert.equal(mathRes.ok, true);

    // 3. Axe-core accessibility audit (zero serious/critical violations)
    const axeRes = await checkAccessibilityAxe(page);
    assert.equal(axeRes.ok, true);
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
});
