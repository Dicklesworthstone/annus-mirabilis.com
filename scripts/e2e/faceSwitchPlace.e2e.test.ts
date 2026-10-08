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

/**
 * CRITERION 4: "A split English sentence maps to its German source and back."
 *
 * A German sentence that English must break in two keeps the source id with a letter suffix
 * (docs/CONTENT_IDS.md), so `s1-p10-s1a` and `s1-p10-s1b` are English-only and `s1-p10-s1` is what
 * the German face renders.
 *
 * THE TWO DIRECTIONS ARE NOT SYMMETRIC, and the asymmetry is not the one the criterion's wording
 * suggests. Measured in the built relativity faces:
 *
 *     62 English split halves, and 0 of the 62 appear on the German face
 *     the unsuffixed source id appears on BOTH faces (223 shared sentence ids; 223 + 62 = the
 *     English face's 285)
 *
 * So the forward direction genuinely needs the variant walk -- the German face has no
 * `s1-p10-s1a` and `contentIdVariants` truncates it to the source -- while the return direction is
 * served by EXACT MATCH, because the English face publishes the source id too.
 *
 * That makes the return the more interesting assertion rather than the lesser one. `resolvedFaceAnchor`
 * tries the requested id before any variant, so a reader coming back from German lands on the whole
 * sentence. Reorder those two steps -- prefer the `a` half, which contentIdVariants lists first --
 * and the reader is silently sent to HALF of the sentence they were reading. Nothing else in the
 * suite would notice, because both ids exist and both are in the right place.
 *
 * The first draft of this lane asserted that the English face does NOT publish the source id, which
 * is false, and its own guard caught it: `s1-p10-s1 IS on the English face, so this pair does not
 * test a split`. The guard is kept below, inverted to state the fact it found.
 */
test("criterion 4: a split English sentence maps to its German source and back", {
  timeout: 180_000,
}, async (ctx) => {
  await lane("split-sentence-round-trip", async (page, note) => {
    const HALF = "s1-p10-s1a";
    const OTHER_HALF = "s1-p10-s1b";
    const SOURCE = "s1-p10-s1";

    // FORWARD: the English half carries to the German face and lands on the unsuffixed source.
    await page.goto(`${ORIGIN}/papers/${PAPER}/view/english/#${HALF}`, { waitUntil: "load" });
    await settle(page);
    assert.notEqual(await topOf(page, HALF), null, `${HALF} is not on the English face`);
    assert.notEqual(
      await topOf(page, OTHER_HALF),
      null,
      `${OTHER_HALF} is not on the English face`,
    );
    // The fact the first draft got backwards: the English face publishes the source id as well as
    // its two halves. That is what makes the return direction an exact match.
    assert.notEqual(
      await topOf(page, SOURCE),
      null,
      `${SOURCE} is NOT on the English face; the measured corpus says it is`,
    );

    await page.locator('a[data-view-link="german"]').first().click();
    await page.waitForURL(/\/view\/german\//, { timeout: 60_000 });
    await settle(page);
    const germanTop = await topOf(page, SOURCE);
    assert.notEqual(germanTop, null, `${SOURCE} is not on the German face`);
    // The half must NOT be there, or the mapping was never exercised and this lane proves nothing.
    assert.equal(
      await topOf(page, HALF),
      null,
      `${HALF} IS on the German face, so no variant walk happened`,
    );
    // And the URL names what the reader is at, which is the source id rather than the half they
    // arrived on: a copied URL has to address something this face publishes.
    assert.match(
      page.url(),
      new RegExp(`#${SOURCE}$`),
      `the German URL still names a half: ${page.url()}`,
    );
    const forward = `forward: ${HALF} (English-only) -> ${SOURCE} at ${(germanTop as number).toFixed(1)}px`;
    ctx.diagnostic(forward);
    note(forward);

    // BACK: exact match wins over the variant preference, so the reader returns to the WHOLE
    // sentence and not to its first half.
    await page.locator('a[data-view-link="english"]').first().click();
    await page.waitForURL(/\/view\/english\//, { timeout: 60_000 });
    await settle(page);
    assert.notEqual(
      await topOf(page, SOURCE),
      null,
      `${SOURCE} is not on the English face after the return`,
    );
    assert.match(
      page.url(),
      new RegExp(`#${SOURCE}$`),
      `the return URL is ${page.url()}, not the whole sentence: exact match must beat the 'a' half that contentIdVariants lists first`,
    );
    const back = `back: ${SOURCE} -> ${SOURCE} by exact match, not to ${HALF}`;
    ctx.diagnostic(back);
    note(back);

    // CONTROL. Both halves of this would pass for an implementation that ignored the fragment IF
    // the ids happened to sit at the top of each face. So check the reader was actually moved.
    const depth = await page.evaluate(() => ({
      scrollY: Math.round(window.scrollY),
      docHeight: document.documentElement.scrollHeight,
    }));
    const ctl = `control: landed at scrollY ${depth.scrollY} of ${depth.docHeight}px`;
    ctx.diagnostic(ctl);
    note(ctl);
    assert.ok(
      depth.scrollY > 200,
      `the round trip ended at scrollY ${depth.scrollY}; nothing navigated`,
    );
  });
});

/**
 * CRITERION 6: "Back and forward restore face, anchor, and relative position, even after a Detail
 * change between visits."
 *
 * MEASURED BROKEN BEFORE THE FIX, which is why this lane asserts a number rather than a boolean.
 * With history.scrollRestoration at "auto", English #s4-p3-s1 -> click German -> Back returned the
 * right face and the right fragment and put the reader at scrollY 4 with the sentence 24,450.1px
 * below the viewport: 24,434px of lost place. Forward worked. The engine applies its saved offset
 * to a document that has not grown to 65,961px yet, and a Back navigation does not re-apply the
 * fragment.
 *
 * So the first assertion here is that the takeover actually happened -- scrollRestoration is
 * "manual" on a face page -- because if it silently reverted, every position check below would be
 * measuring the engine again and would fail for a reason this docblock would not explain.
 */
test("criterion 6: back and forward restore the face, the anchor and the position", {
  timeout: 180_000,
}, async (ctx) => {
  await lane("back-forward-restore", async (page, note) => {
    await page.goto(`${ORIGIN}/papers/${PAPER}/view/english/#${SENTENCE}`, { waitUntil: "load" });
    await settle(page);

    // The takeover, asserted before anything that depends on it.
    const restoration = await page.evaluate(() => history.scrollRestoration);
    assert.equal(
      restoration,
      "manual",
      `scrollRestoration is '${restoration}'; the engine still owns restoration`,
    );

    const englishTop = await topOf(page, SENTENCE);
    assert.notEqual(englishTop, null);
    const englishScroll = await page.evaluate(() => Math.round(window.scrollY));
    // The reader must be DEEP in the document, or "restored the position" is indistinguishable from
    // "the page is short". This is the control for every comparison below.
    assert.ok(
      englishScroll > 5000,
      `the English face only scrolled to ${englishScroll}; the fixture cannot show a lost place`,
    );

    await page.locator('a[data-view-link="german"]').first().click();
    await page.waitForURL(/\/view\/german\//, { timeout: 60_000 });
    await settle(page);
    const germanTop = await topOf(page, SENTENCE);
    assert.notEqual(germanTop, null);

    // BACK: face, anchor and position.
    await page.goBack({ waitUntil: "load" });
    await settle(page);
    assert.match(
      page.url(),
      /\/view\/english\//,
      `Back did not return to the English face: ${page.url()}`,
    );
    assert.match(page.url(), new RegExp(`#${SENTENCE}$`), `Back lost the anchor: ${page.url()}`);
    const backTop = await topOf(page, SENTENCE);
    assert.notEqual(backTop, null, `${SENTENCE} is not on the page after Back`);
    const backDrift = Math.abs((backTop as number) - (englishTop as number));
    const backLine = `Back: top ${(backTop as number).toFixed(1)}px against ${(englishTop as number).toFixed(1)}px, drift ${backDrift.toFixed(1)}px`;
    ctx.diagnostic(backLine);
    note(backLine);
    assert.ok(
      backDrift <= 8,
      `Back restored the sentence ${backDrift.toFixed(1)}px away, over the 8 CSS px the criterion allows`,
    );

    // FORWARD: the same, to the German face.
    await page.goForward({ waitUntil: "load" });
    await settle(page);
    assert.match(
      page.url(),
      /\/view\/german\//,
      `Forward did not reach the German face: ${page.url()}`,
    );
    const forwardTop = await topOf(page, SENTENCE);
    assert.notEqual(forwardTop, null);
    const forwardDrift = Math.abs((forwardTop as number) - (germanTop as number));
    const fwdLine = `Forward: top ${(forwardTop as number).toFixed(1)}px against ${(germanTop as number).toFixed(1)}px, drift ${forwardDrift.toFixed(1)}px`;
    ctx.diagnostic(fwdLine);
    note(fwdLine);
    assert.ok(forwardDrift <= 8, `Forward restored the sentence ${forwardDrift.toFixed(1)}px away`);
  });
});

/**
 * The same journey with a DETAIL CHANGE between the visits, which is the clause the criterion adds
 * and the reason the stored record is a fraction rather than a pixel offset. Changing Detail
 * re-renders every paragraph at a different height, so a pixel offset saved before the change
 * addresses different content after it; a fraction of the viewport addresses the same place.
 */
test("criterion 6: and the restore survives a Detail change between visits", {
  timeout: 180_000,
}, async (ctx) => {
  await lane("back-forward-after-detail", async (page, note) => {
    await page.goto(`${ORIGIN}/papers/${PAPER}/view/english/#${SENTENCE}`, { waitUntil: "load" });
    await settle(page);
    const before = await topOf(page, SENTENCE);
    assert.notEqual(before, null);

    await page.locator('a[data-view-link="german"]').first().click();
    await page.waitForURL(/\/view\/german\//, { timeout: 60_000 });
    await settle(page);

    // Detail is read from `data-detail` on <html> by the inline script and by CSS, so setting it is
    // the same change a reader's Detail control makes.
    const was = await page.evaluate(() => {
      const prior = document.documentElement.dataset.detail ?? null;
      document.documentElement.dataset.detail = "2";
      try {
        localStorage.setItem("am:reader:v1:detail", "2");
      } catch {
        /* a blocked store still leaves the attribute set, which is what CSS reads */
      }
      return prior;
    });
    await page.waitForTimeout(600);
    const detailLine = `Detail changed on the German face from ${JSON.stringify(was)} to "2"`;
    ctx.diagnostic(detailLine);
    note(detailLine);

    await page.goBack({ waitUntil: "load" });
    await settle(page);
    assert.match(page.url(), new RegExp(`#${SENTENCE}$`), `Back lost the anchor: ${page.url()}`);
    const after = await topOf(page, SENTENCE);
    assert.notEqual(after, null, `${SENTENCE} is not on the page after Back`);
    const drift = Math.abs((after as number) - (before as number));
    const line = `Back after a Detail change: top ${(after as number).toFixed(1)}px against ${(before as number).toFixed(1)}px, drift ${drift.toFixed(1)}px`;
    ctx.diagnostic(line);
    note(line);
    assert.ok(drift <= 8, `the restore drifted ${drift.toFixed(1)}px after a Detail change`);
  });
});
