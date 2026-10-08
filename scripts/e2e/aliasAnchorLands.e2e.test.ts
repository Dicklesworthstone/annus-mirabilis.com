/**
 * A RETIRED ID MUST LAND, AND A `hidden` ANCHOR DOES NOT. This is the browser half of
 * src/reader/anchors/aliasAnchors.test.ts, which cannot check it: fragment navigation is not
 * something a renderer does, and the unit test that used to stand in for this asserted
 * `toContain("hidden")` -- the presence of the attribute that prevents the landing -- under a title
 * claiming the landing worked.
 *
 * am-read-anchors-navigation-a6o criterion 5 ("a retired id from the alias fixture lands on its new
 * location with JavaScript disabled") and am-to1q (which spelling of the alias anchor survives).
 *
 * SYNTHETIC MARKUP ON PURPOSE, and it is the only honest fixture for this claim. The question is
 * what the ENGINE does with a boxless fragment target, so the page has to contain the two
 * candidate spellings side by side under identical conditions. Reading the built site instead would
 * answer a different question -- whether today's German face happens to work -- and would go green
 * the moment the alias span moved, without anyone learning why.
 *
 * BOTH ENGINES, because this is a layout behaviour and the repository serves a real WebKit lane.
 * JavaScript is not disabled here and does not need to be: setting `location.hash` asks the engine
 * for exactly the navigation a no-script reader's click asks for, and the measurement is the
 * engine's scroll, not a script's.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { aliasAnchorProps } from "../../src/reader/anchors/aliasAnchors.ts";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const OUT_DIR = join(REPO_ROOT, "out");

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

/** Long enough that a landing cannot be confused with the page's resting position. */
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; font: 16px/1.125 serif }
  .pad { height: 2000px }
</style></head><body>
<div class="pad">top</div>
<p id="target-a">Paragraph A. <span id="alias-hidden" data-alias="" hidden></span>Text.</p>
<div class="pad">middle</div>
<p id="target-b">Paragraph B. <span id="alias-live" data-alias=""></span>Text.</p>
<div class="pad">bottom</div>
</body></html>`;

interface Landing {
  scrollY: number;
  width: number;
  height: number;
  isTarget: boolean;
}

for (const [engineName, engine] of [
  ["chromium", chromium],
  ["webkit", webkit],
] as const) {
  test(`a boxless alias anchor does not land, and a live one does (${engineName})`, {
    timeout: 120_000,
  }, async (ctx) => {
    const executablePath =
      engineName === "chromium" ? process.env.CHROMIUM_EXECUTABLE_PATH : undefined;
    const browser = await engine.launch(executablePath ? { executablePath } : {});
    try {
      const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
      const land = async (id: string): Promise<Landing> => {
        await page.setContent(PAGE);
        await page.evaluate(() => window.scrollTo(0, 0));
        return page.evaluate((anchor) => {
          window.location.hash = `#${anchor}`;
          const el = document.getElementById(anchor);
          const rect = el?.getBoundingClientRect();
          return {
            scrollY: Math.round(window.scrollY),
            width: rect ? Number(rect.width.toFixed(1)) : -1,
            height: rect ? Number(rect.height.toFixed(1)) : -1,
            isTarget: el !== null && el === document.querySelector(":target"),
          };
        }, id);
      };

      const hidden = await land("alias-hidden");
      const live = await land("alias-live");
      const paragraph = await land("target-b");
      ctx.diagnostic(
        `${engineName}: hidden ${JSON.stringify(hidden)} | live ${JSON.stringify(live)} | paragraph ${JSON.stringify(paragraph)}`,
      );

      // 1. The hidden anchor IS the target and still does not move the reader. Both halves matter:
      //    without the `:target` assertion this would look like a selector that simply missed.
      assert.equal(hidden.isTarget, true, "the hidden span did not even become :target");
      assert.equal(
        hidden.scrollY,
        0,
        `a hidden anchor scrolled to ${hidden.scrollY}; the premise of this test is gone`,
      );
      assert.equal(
        hidden.height,
        0,
        "the hidden span reported a height, so it is not display:none here",
      );

      // 2. The same span without `hidden` lands, and lands where the paragraph it sits in lands.
      assert.equal(live.isTarget, true);
      assert.ok(live.scrollY > 100, `the live alias anchor only reached ${live.scrollY}`);
      assert.equal(
        live.scrollY,
        paragraph.scrollY,
        "the alias anchor and its own paragraph land at different places, so the retired id does not reach the successor's location",
      );
      // Zero width, non-zero height: invisible, and still addressable. That is the property that
      // makes an empty inline span the right shape for this.
      assert.equal(live.width, 0, "the alias anchor is taking horizontal space");
      assert.ok(live.height > 0, "the alias anchor has no height, so it has no box to scroll to");

      // 3. And the module under discussion emits the landing spelling, not the boxless one. This is
      //    what ties the engine measurement to the code: without it the test proves a fact about
      //    HTML and says nothing about this repository.
      const props = aliasAnchorProps("s4-p2-s1-old") as Record<string, unknown>;
      assert.equal("hidden" in props, false, "aliasAnchorProps has reacquired `hidden`");
      assert.deepEqual(Object.keys(props).sort(), ["data-alias", "id"]);
    } finally {
      await browser.close();
    }
  });
}

/**
 * THE SAME CLAIM ON THE REAL SITE, which is where criterion 5 is actually written: "A retired id
 * from the alias fixture lands on its new location with JavaScript disabled, and is rewritten by
 * replacement with JavaScript enabled, without adding a history entry."
 *
 * `rewrittenAliasHash` is well covered as a pure function (8 cases in
 * src/reader/faces/aliasHashRewrite.test.ts). The ISLAND's two browser behaviours were asserted
 * only in a docblock: that a no-script reader lands, and that the rewrite uses replaceState rather
 * than pushState. Neither is checkable without a browser.
 *
 * THE FIXTURE IS REAL, not planted: relativity's German face carries 17 `data-alias-of` spans, and
 * `s1-p4 -> s1-p3` is one of them, with the target present as its own id.
 *
 * THE HISTORY CLAUSE IS MEASURED COMPARATIVELY, because the rewrite happens during load and there is
 * no moment before it to take a baseline. Loading the retired id and loading the successor directly
 * must leave `history.length` EQUAL: with pushState the retired case would be one greater.
 */
const RETIRED = "s1-p4";
const SUCCESSOR = "s1-p3";
const GERMAN = "/papers/special-relativity/view/german/";

async function settled(page: import("playwright").Page): Promise<void> {
  await page.waitForLoadState("load");
  let last = Number.NaN;
  let stable = 0;
  for (let i = 0; i < 24; i += 1) {
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
}

test("criterion 5: a retired id lands on its successor's location with NO JavaScript", {
  timeout: 180_000,
}, async (ctx) => {
  assertOutFreshness("out", REPO_ROOT);
  const { server, origin } = await startStaticServer(OUT_DIR);
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();

    // The retired id, with no script to rewrite it. The static alias span is all there is.
    await page.goto(`${origin}${GERMAN}#${RETIRED}`, { waitUntil: "load" });
    await settled(page);
    const retiredLanding = await page.evaluate(() => Math.round(window.scrollY));

    // The successor directly, as the reference.
    await page.goto(`${origin}${GERMAN}#${SUCCESSOR}`, { waitUntil: "load" });
    await settled(page);
    const successorLanding = await page.evaluate(() => Math.round(window.scrollY));

    ctx.diagnostic(
      `no-JS: #${RETIRED} -> scrollY ${retiredLanding}; #${SUCCESSOR} -> scrollY ${successorLanding}`,
    );

    // The control first: the reference must be DEEP in the page, or "landed on its successor"
    // cannot be told from "both stayed at the top".
    assert.ok(
      successorLanding > 300,
      `#${SUCCESSOR} only reached scrollY ${successorLanding}; the fixture cannot show a landing`,
    );
    assert.ok(
      retiredLanding > 300,
      `#${RETIRED} did not land at all (scrollY ${retiredLanding}) with JavaScript disabled`,
    );
    // The alias span sits inside the successor's block, so the two land within a line of each other
    // rather than exactly. A line is about 24px here; 40 allows for the span's own position in the
    // paragraph without allowing a different paragraph.
    assert.ok(
      Math.abs(retiredLanding - successorLanding) <= 40,
      `the retired id landed ${Math.abs(retiredLanding - successorLanding)}px from its successor`,
    );

    /*
      And the live alias span must not be `hidden`.

      A CORRECTION TO THE SYNTHETIC MEASUREMENT AT THE TOP OF THIS FILE, produced by this very run.
      I first asserted here that the span must have a non-zero height, reasoning from that table
      where the landing anchor was 0 x 18 and the hidden one 0 x 0. The assertion FAILED against the
      real site: relativity's live alias span is 0 x 0 -- a bare inline span BETWEEN two block
      elements, generating no line box -- and it lands perfectly, at scrollY 3379 against the
      successor's 3386.

      So height is not the mechanism. `display: none` is: a hidden element has NO BOX, while a
      zero-height laid-out element has a box with a POSITION, which is all a fragment scroll needs.
      The synthetic case happened to have height because it sat inline among text, and reading a
      cause off that coincidence was my error.
    */
    const spanBox = await page.evaluate((id) => {
      const el = document.getElementById(id);
      if (el === null) return null;
      const b = el.getBoundingClientRect();
      return {
        w: Number(b.width.toFixed(1)),
        h: Number(b.height.toFixed(1)),
        hidden: el.hasAttribute("hidden"),
        display: getComputedStyle(el).display,
        boxes: el.getClientRects().length,
      };
    }, RETIRED);
    assert.ok(spanBox, `#${RETIRED} is not in the no-script HTML at all`);
    const s = spanBox as {
      w: number;
      h: number;
      hidden: boolean;
      display: string;
      boxes: number;
    };
    assert.equal(s.hidden, false, "the live alias span carries `hidden`, which cannot land");
    assert.notEqual(
      s.display,
      "none",
      "the live alias span is display:none, which has no box to scroll to",
    );
    ctx.diagnostic(
      `no-JS: the alias span is ${s.w}x${s.h}, display=${s.display}, client rects=${s.boxes}, hidden=${s.hidden}`,
    );
  } finally {
    await browser.close();
    await new Promise<void>((done) => server.close(() => done()));
  }
});

test("criterion 5: with JavaScript the hash is rewritten BY REPLACEMENT, adding no history entry", {
  timeout: 180_000,
}, async (ctx) => {
  assertOutFreshness("out", REPO_ROOT);
  const { server, origin } = await startStaticServer(OUT_DIR);
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await page.goto(`${origin}${GERMAN}#${RETIRED}`, { waitUntil: "load" });
    await settled(page);
    const rewritten = await page.evaluate(() => ({ hash: location.hash, length: history.length }));

    // A second, otherwise identical visit that needs NO rewrite, as the history baseline.
    const fresh = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await fresh.goto(`${origin}${GERMAN}#${SUCCESSOR}`, { waitUntil: "load" });
    await settled(fresh);
    const baseline = await fresh.evaluate(() => ({ hash: location.hash, length: history.length }));

    ctx.diagnostic(
      `with JS: #${RETIRED} became ${rewritten.hash} (history.length ${rewritten.length}); #${SUCCESSOR} stayed ${baseline.hash} (history.length ${baseline.length})`,
    );

    assert.equal(
      rewritten.hash,
      `#${SUCCESSOR}`,
      `the retired id was not rewritten; the URL still reads ${rewritten.hash}`,
    );
    assert.equal(
      baseline.hash,
      `#${SUCCESSOR}`,
      "the control visit's hash changed, so it is not a baseline",
    );
    // THE CLAUSE: replaceState, not pushState. With pushState the rewritten visit would carry one
    // more entry than a visit that needed no rewrite.
    assert.equal(
      rewritten.length,
      baseline.length,
      `the rewrite added ${rewritten.length - baseline.length} history entr(y|ies); criterion 5 requires replacement`,
    );
  } finally {
    await browser.close();
    await new Promise<void>((done) => server.close(() => done()));
  }
});
