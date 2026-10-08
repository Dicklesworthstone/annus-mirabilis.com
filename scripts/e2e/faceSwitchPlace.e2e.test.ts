/**
 * CRITERION 2 OF am-read-anchors-navigation-a6o, MEASURED IN A BROWSER AGAINST THE BUILT SITE:
 * "Deep link ... on the English face followed by a switch to German shows the same sentence at the
 * same relative position (within 8 CSS px). A switch to results shows the section's results, and a
 * switch to facsimile shows the sentence's page."
 *
 * Three clauses, three tests, and each one carries the control that stops it passing vacuously.
 *
 * THE CRITERION'S OWN EXAMPLE ID DOES NOT EXIST, so this uses one that does. It names `#s4-p2-s1`:
 * content/source-blocks/special-relativity/ holds s4-p1 and s4-p3..s4-p9 and no s4-p2.yaml, and the
 * built German face emits `<span id="s4-p2" data-alias-of="s4-p1">` -- s4-p2 is a RETIRED paragraph
 * id kept as an alias, and the English face publishes no paragraph ids at all. 223 sentence ids are
 * shared between relativity's two source faces (285 on English, 223 on German, all 223 shared), and
 * s4-p3-s1 is one of them.
 *
 * THE 8 PX IS MEASURED AS A DIFFERENCE OF TWO `getBoundingClientRect().top` VALUES, each taken
 * after the page has settled, not as a scroll offset. A scroll offset would be the wrong instrument:
 * the two faces lay out differently (the German face wraps each paragraph beside an "Explained in"
 * line), so the same sentence sits at a different document height on each, and identical scroll
 * positions would mean different viewport positions. What the criterion is about is where the
 * sentence appears to the reader.
 *
 * Serves out/, which must be fresh. A failing lane keeps a screenshot, trace and DOM snapshot.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { type Browser, chromium, type Page } from "playwright";
import { newRunIdentity, TestLogger } from "../../src/testing/log/logger.ts";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";
import { retainE2EEvidence } from "./evidence.ts";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const OUT_DIR = join(REPO_ROOT, "out");
const SUITE = "face-switch-place";
const PAPER = "special-relativity";

/** A sentence deep in the paper that BOTH source faces publish, verified in the test itself. */
const SENTENCE = "s4-p3-s1";

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
};

function startStaticServer(rootDir: string): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    const rawUrl = (req.url ?? "/").split("?")[0] ?? "/";
    let filePath = join(rootDir, decodeURIComponent(rawUrl));
    if (existsSync(filePath) && statSync(filePath).isDirectory())
      filePath = join(filePath, "index.html");
    if (!filePath.startsWith(rootDir) || !existsSync(filePath)) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
    // readFileSync BEFORE writeHead: reversing them sends the headers and then throws on a
    // directory read, which the client sees as ERR_HTTP_HEADERS_SENT rather than a 404.
    const body = readFileSync(filePath);
    res.writeHead(200, {
      "content-type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  });
  return new Promise((done) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      done({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

/**
 * One lane: a fresh out/, a static origin, a browser with its console captured, and -- on failure --
 * the five evidence kinds AGENTS.md requires, plus one JSON line per lane either way.
 *
 * The capture is written whether or not it is needed, because a screenshot taken after the failure
 * has propagated shows a page that has already moved on.
 */
async function lane(
  testId: string,
  body: (page: Page, note: (line: string) => void) => Promise<void>,
): Promise<void> {
  assertOutFreshness("out", REPO_ROOT);
  assert.ok(existsSync(join(OUT_DIR, "papers")), "out/ has no /papers/");
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);
  const scratch = join(REPO_ROOT, "artifacts", "e2e-scratch", SUITE, logRunId);
  mkdirSync(scratch, { recursive: true });
  const capture = {
    screenshot: join(scratch, `${testId}.png`),
    trace: join(scratch, `${testId}.trace.zip`),
    dom: join(scratch, `${testId}.dom.html`),
    console: join(scratch, `${testId}.console.log`),
    network: join(scratch, `${testId}.network.log`),
  };
  const { server, origin } = await startStaticServer(OUT_DIR);
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  const consoleLines: string[] = [];
  const networkLines: string[] = [];
  page.on("console", (m) => consoleLines.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => consoleLines.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => networkLines.push(`failed ${r.url()}`));
  const notes: string[] = [];
  const started = Date.now();
  try {
    ORIGIN = origin;
    await body(page, (line) => notes.push(line));
    logger.log({
      testId,
      outcome: "passed",
      durationMs: Date.now() - started,
      browser: "chromium",
      viewport: "1280x900",
      jsEnabled: true,
      beadId: "am-read-anchors-navigation-a6o",
      message: notes.join(" | ") || testId,
    });
    logger.flushSync();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await page.screenshot({ path: capture.screenshot, fullPage: false });
      writeFileSync(capture.dom, await page.content(), "utf8");
    } catch {
      /* the page may already be gone; the remaining three kinds still get written */
    }
    writeFileSync(capture.console, `${consoleLines.join("\n")}\n`, "utf8");
    writeFileSync(capture.network, `${networkLines.join("\n")}\n`, "utf8");
    try {
      await context.tracing.stop({ path: capture.trace });
    } catch {
      writeFileSync(capture.trace, "", "utf8");
    }
    const retained = await retainE2EEvidence(
      { suite: SUITE, logRunId, testId, lane: "chromium-1280", outcome: "failed", message },
      capture,
    ).catch(() => undefined);
    // The schema REFUSES a failing browser event without a screenshot and a DOM path, and the first
    // version of this harness omitted them. The refusal then replaced the assertion message in the
    // output, so the first failing run reported a LogSchemaError and not the drift that caused it.
    // A failure-reporting path that destroys the failure is worse than none.
    const kept = retained?.copied ?? [];
    const evidence = {
      screenshot: kept.find((f) => f.endsWith(".png")) ?? capture.screenshot,
      dom: kept.find((f) => f.endsWith(".dom.html")) ?? capture.dom,
      console: kept.find((f) => f.endsWith(".console.log")) ?? capture.console,
      network: kept.find((f) => f.endsWith(".network.log")) ?? capture.network,
      trace: kept.find((f) => f.endsWith(".trace.zip")) ?? capture.trace,
    };
    logger.log({
      testId,
      evidence,
      outcome: "failed",
      durationMs: Date.now() - started,
      browser: "chromium",
      viewport: "1280x900",
      jsEnabled: true,
      beadId: "am-read-anchors-navigation-a6o",
      message: `${message} | ${notes.join(" | ")}`,
    });
    logger.flushSync();
    throw error;
  } finally {
    await browser.close();
    await new Promise<void>((done) => server.close(() => done()));
  }
}

/** Set by `lane` before the body runs; the body needs the port the server chose. */
let ORIGIN = "";

/** The viewport-relative top of an id's element, or null when the id is not on the page. */
async function topOf(page: Page, id: string): Promise<number | null> {
  return page.evaluate((anchor) => {
    const el = document.getElementById(anchor);
    return el === null ? null : el.getBoundingClientRect().top;
  }, id);
}

/**
 * WAIT FOR THE SCROLL TO STOP MOVING, not for an event. A fixed delay after `load` is the wrong
 * instrument here and the first version of this file used one, which produced a 1036px "drift" that
 * was entirely the measurement.
 *
 * Measured on relativity's English face at #s4-p3-s1, 1280x900: the browser chases the anchor as
 * the document grows, and the position converges in stages --
 *
 *     domcontentloaded   scrollY      0   element top 24454
 *     load               scrollY      0   element top 24454
 *     load + 300ms       scrollY   8413   element top 16041
 *     load + ~1800ms     scrollY  24438   element top    16   <- settled
 *
 * The document is 65,961px tall and the anchor sits 24,454px down, so any sample taken before
 * convergence reads a different mid-flight position on each face, and comparing two of them
 * measures the delay rather than the layout. So: poll until scrollY is unchanged across three
 * consecutive samples, and fail loudly if it never settles rather than measuring a moving page.
 */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  await page.evaluate(() => document.fonts.ready);
  let last = Number.NaN;
  let stable = 0;
  for (let i = 0; i < 40; i += 1) {
    await page.waitForTimeout(250);
    const now = await page.evaluate(() => window.scrollY);
    if (now === last) {
      stable += 1;
      if (stable >= 3) return;
    } else {
      stable = 0;
      last = now;
    }
  }
  assert.fail(
    `the page never stopped scrolling (last scrollY ${last}); a drift measured here would be the delay, not the layout`,
  );
}

async function faceHref(page: Page, face: string): Promise<string> {
  const href = await page.locator(`a[data-view-link="${face}"]`).first().getAttribute("href");
  assert.ok(href, `no face link for '${face}'`);
  return href;
}

test("criterion 2: the same sentence, at the same relative position, on the other face", {
  timeout: 180_000,
}, async (ctx) => {
  await lane("same-relative-position", async (page, note) => {
    // 1. Deep link on the English face.
    await page.goto(`${ORIGIN}/papers/${PAPER}/view/english/#${SENTENCE}`, { waitUntil: "load" });
    await settle(page);
    const before = await topOf(page, SENTENCE);
    assert.notEqual(
      before,
      null,
      `${SENTENCE} is not on the English face; the fixture id is wrong`,
    );

    // 2. Switch by CLICKING, which is the reader's own path. A page.goto would bypass the handler
    //    that carries the fragment, and the test would pass while the feature did nothing.
    const germanHref = await faceHref(page, "german");
    assert.equal(
      germanHref,
      `/papers/${PAPER}/view/german/`,
      "the href itself must stay fragment-free: scripts/e2e/journeys/steps.ts matches it exactly",
    );
    await page.locator('a[data-view-link="german"]').first().click();
    await page.waitForURL(/\/view\/german\//, { timeout: 60_000 });
    await settle(page);

    // 3. The same sentence is there, and the URL names it.
    const after = await topOf(page, SENTENCE);
    assert.notEqual(after, null, `${SENTENCE} is not on the German face after the switch`);
    assert.match(
      page.url(),
      new RegExp(`#${SENTENCE}$`),
      `the fragment was not carried: ${page.url()}`,
    );

    const drift = Math.abs((after as number) - (before as number));
    const line = `English top ${(before as number).toFixed(1)}px, German top ${(after as number).toFixed(1)}px, drift ${drift.toFixed(1)}px`;
    ctx.diagnostic(line);
    note(line);
    assert.ok(
      drift <= 8,
      `the sentence moved ${drift.toFixed(1)}px, over the 8 CSS px the criterion allows`,
    );

    // CONTROL. `drift <= 8` would also pass for a reason unrelated to the feature: if the sentence
    // sat at the top of the viewport on both faces the drift is ~0 whatever the code does. So check
    // the instrument can see a move at all. A 300px scroll must change the measured top by far more
    // than 8px, or the verdict above means nothing.
    const scrolled = await page.evaluate((anchor) => {
      window.scrollBy({ top: -300, behavior: "instant" });
      const el = document.getElementById(anchor);
      return el === null ? null : el.getBoundingClientRect().top;
    }, SENTENCE);
    assert.notEqual(scrolled, null);
    const sensitivity = Math.abs((scrolled as number) - (after as number));
    const ctl = `control: a 300px scroll moved the measured top by ${sensitivity.toFixed(1)}px`;
    ctx.diagnostic(ctl);
    note(ctl);
    assert.ok(
      sensitivity > 8,
      `the instrument cannot see a 300px move (it reported ${sensitivity.toFixed(1)}px), so the 8px verdict means nothing`,
    );
  });
});

test("criterion 2: a switch to results shows the section's results", {
  timeout: 180_000,
}, async (ctx) => {
  await lane("results-section", async (page, note) => {
    await page.goto(`${ORIGIN}/papers/${PAPER}/view/english/#${SENTENCE}`, { waitUntil: "load" });
    await settle(page);
    await page.locator('a[data-view-link="results"]').first().click();
    await page.waitForURL(/\/view\/results\//, { timeout: 60_000 });
    await settle(page);

    // The results face publishes no sentence ids, so the carried id must be MAPPED. The island
    // rewrites the URL to the card it chose, which is where the claim is readable.
    const url = page.url();
    ctx.diagnostic(`results URL after the switch: ${url}`);
    const match = /#(result-[A-Za-z0-9-]+)$/.exec(url);
    assert.ok(match, `the URL names no result card: ${url}`);
    const cardId = match[1] as string;

    // It must be a card declaring the sentence's OWN section, read from the DOM rather than assumed.
    const sections = await page.evaluate(
      (id) => document.getElementById(id)?.getAttribute("data-sections") ?? null,
      cardId,
    );
    assert.ok(sections, `${cardId} carries no data-sections`);
    assert.ok(
      (sections as string).split(" ").includes("s4"),
      `${cardId} declares sections '${String(sections)}', which does not include s4`,
    );

    // CONTROL: the face has many cards, so landing on one proves nothing unless s4's card is not
    // simply the first card on the page. Without this the test passes for an island that always
    // scrolled to the top card.
    const cards = await page.evaluate(() =>
      [...document.querySelectorAll("[data-result-id][data-sections]")].map((el) => ({
        id: el.id,
        sections: el.getAttribute("data-sections"),
      })),
    );
    const ctl = `${cards.length} cards on the face; chose ${cardId} for s4; first card is ${String(cards[0]?.id)}`;
    ctx.diagnostic(ctl);
    note(ctl);
    assert.ok(cards.length >= 8, `only ${cards.length} cards; the control needs a real population`);
    assert.notEqual(
      cards[0]?.id,
      cardId,
      "s4's card IS the first card, so this run cannot tell a real mapping from 'scroll to the top card'",
    );
  });
});

test("criterion 2: a switch to facsimile shows the sentence's page", {
  timeout: 180_000,
}, async (ctx) => {
  await lane("facsimile-page", async (page, note) => {
    await page.goto(`${ORIGIN}/papers/${PAPER}/view/english/#${SENTENCE}`, { waitUntil: "load" });
    await settle(page);
    await page.locator('a[data-view-link="facsimile"]').first().click();
    await page.waitForURL(/\/view\/facsimile\//, { timeout: 60_000 });
    await settle(page);

    assert.match(
      page.url(),
      new RegExp(`#${SENTENCE}$`),
      `the fragment was not carried: ${page.url()}`,
    );
    const target = await page.evaluate(
      (id) =>
        document
          .getElementById(id)
          ?.querySelector("[data-facsimile-target]")
          ?.getAttribute("data-facsimile-target") ?? null,
      SENTENCE,
    );
    assert.equal(target, SENTENCE, `the facsimile entry for ${SENTENCE} names '${String(target)}'`);

    // THE SENTENCE'S PAGE, which is what the clause asks for. s4-p3's locator in its source record
    // is printedPage 903, so its entry must sit under that page's heading and above the next one.
    // Asserting the ORDERING rather than a scroll position, because the entry's place in the index
    // is what says which page it belongs to.
    const ordering = await page.evaluate((id) => {
      const sentence = document.getElementById(id);
      const own = document.getElementById("facsimile-page-903");
      const next = document.getElementById("facsimile-page-904");
      if (sentence === null || own === null) return null;
      const top = (el: Element) => el.getBoundingClientRect().top + window.scrollY;
      return { sentence: top(sentence), own: top(own), next: next === null ? null : top(next) };
    }, SENTENCE);
    assert.ok(
      ordering,
      "the facsimile face publishes no facsimile-page-903, or the sentence is absent",
    );
    const o = ordering as { sentence: number; own: number; next: number | null };
    const ctl = `${SENTENCE} at ${o.sentence.toFixed(0)}, page 903 at ${o.own.toFixed(0)}, page 904 at ${o.next === null ? "absent" : o.next.toFixed(0)}`;
    ctx.diagnostic(ctl);
    note(ctl);
    assert.ok(o.sentence >= o.own, "the sentence's entry sits ABOVE its own page's heading");
    assert.notEqual(
      o.next,
      null,
      "page 904 is absent, so 'under the right page' cannot be distinguished from 'anywhere after 903'",
    );
    assert.ok(
      (o.next as number) > o.sentence,
      "the sentence's entry sits below page 904's heading, i.e. filed under the wrong page",
    );
  });
});
