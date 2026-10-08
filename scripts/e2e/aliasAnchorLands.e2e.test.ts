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
import test from "node:test";
import { chromium, webkit } from "playwright";
import { aliasAnchorProps } from "../../src/reader/anchors/aliasAnchors.ts";

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
