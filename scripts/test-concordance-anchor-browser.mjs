import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * A CONCORDANCE FIRST-USE LINK LANDS ON THE GERMAN PARAGRAPH IT NAMES
 * (am-german-face-anchors-not-frozen-ids-jtv6, the browser half of its acceptance).
 *
 * The bead's defect was that the German face published anchors the frozen manifest does not
 * contain, and reused two retired mass-energy ids for different paragraphs, so a concordance link
 * could land on the wrong paragraph or nowhere. src/testing/germanFaceAnchors.test.ts proves the ids
 * in the built HTML are the frozen ones, which is a statement about bytes. This is the statement
 * about a reader: the link is followed in a browser, and the element that ends up targeted is the
 * one the link named, in the viewport.
 *
 * TWO THINGS ARE ASSERTED, NOT ONE, because the weaker of them passes on a broken page. That an
 * element with the id EXISTS is what the unit test already covers. What a browser adds is that
 * following the link makes that element `:target` and brings it into view, so a duplicate id earlier
 * in the document -- exactly what reusing a retired id produces -- is caught here and not there.
 *
 * JAVASCRIPT IS DISABLED, which is the bead's fourth acceptance item and the stronger claim:
 * fragment navigation is the browser's own, so a page that only reached the right paragraph after
 * hydration fails here.
 *
 * REDUCED MOTION IS ON, AND THAT IS WHAT MAKES THE MEASUREMENT VALID RATHER THAN FLAKY. The German
 * face sets `scroll-behavior: smooth`, so a rect read immediately after `goto` catches the page
 * mid-animation: a first draft of this check measured 1570px of a 900px viewport and read it as a
 * link that does not scroll, which would have been reported as a product defect that does not exist.
 * Under `reducedMotion: "reduce"` the computed behaviour is `auto` and the jump is immediate, so no
 * sleep is needed and there is no window in which the answer depends on timing. The check asserts
 * that behaviour is `auto` FIRST, so if the site ever stops honouring reduced motion this fails
 * saying so instead of going quietly flaky.
 *
 * The population is read from the BUILT paper pages, not from the notation records, because the
 * question is what a reader can click. A paper whose page links no first-use anchor fails rather
 * than passing on an empty list.
 */
export async function checkConcordanceAnchorBrowser(browser, url, check) {
  const papers = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"];
  const height = 900;
  const context = await browser.newContext({
    javaScriptEnabled: false,
    reducedMotion: "reduce",
    viewport: { width: 1280, height },
  });
  const perPaper = [];
  let followed = 0;
  try {
    const page = await context.newPage();
    for (const paper of papers) {
      const html = await readFile(`out/papers/${paper}/index.html`, "utf8");
      const pattern = new RegExp(`href="/papers/${paper}/view/german/#([A-Za-z0-9._-]+)"`, "g");
      const anchors = [...new Set([...html.matchAll(pattern)].map((m) => m[1]))];
      assert.ok(
        anchors.length > 0,
        `${paper}: the paper page links no first-use anchor into the German face, so this check would pass on an empty list`,
      );
      // Four per paper keeps the lane short; the number followed is reported beside the verdict.
      const sample = anchors.slice(0, 4);
      for (const id of sample) {
        await page.goto(`${url}/papers/${paper}/view/german/#${id}`);
        const seen = await page.evaluate(() => {
          const target = document.querySelector(":target");
          return {
            behavior: getComputedStyle(document.documentElement).scrollBehavior,
            id: target?.id ?? null,
            blockId: target?.getAttribute("data-block-id") ?? null,
            tag: target?.tagName ?? null,
            top: target ? target.getBoundingClientRect().top : null,
            duplicates: document.querySelectorAll(`[id="${CSS.escape(location.hash.slice(1))}"]`)
              .length,
          };
        });
        assert.equal(
          seen.behavior,
          "auto",
          `${paper}#${id}: reduced motion is not honoured (scroll-behavior ${seen.behavior}), so this measurement would depend on animation timing`,
        );
        assert.equal(seen.id, id, `${paper}#${id}: the fragment targeted ${seen.id} instead`);
        assert.equal(
          seen.duplicates,
          1,
          `${paper}#${id}: ${seen.duplicates} elements carry that id, so a link lands on whichever comes first`,
        );
        // A source block carries the frozen id as `data-block-id` too. A footnote MARK is a span
        // inside the running text and carries only the id, which is the right landing place for a
        // symbol whose first use is the footnote, so the pairing is asserted where it exists rather
        // than demanded everywhere.
        if (seen.blockId !== null) {
          assert.equal(
            seen.blockId,
            id,
            `${paper}#${id}: the targeted block declares data-block-id ${seen.blockId}`,
          );
        }
        assert.ok(
          seen.top !== null && seen.top >= -4 && seen.top < height,
          `${paper}#${id}: the targeted ${seen.tag} is at ${Math.round(seen.top ?? NaN)}px, outside a ${height}px viewport`,
        );
        followed += 1;
      }
      perPaper.push(`${paper}: ${sample.length} of ${anchors.length}`);
    }
  } finally {
    await context.close();
  }
  // A count with its denominator, so a pass cannot be read off an empty population.
  assert.ok(followed >= 8, `only ${followed} anchors followed`);

  // THE PLANTED NEGATIVE, so the duplicate-id arm above is known to be live rather than merely
  // written. It is the bead's own defect in its sharpest form: mass-energy reused two retired ids
  // for different paragraphs, and a second element carrying an id is what makes a link land on
  // whichever copy comes first. The plant inserts that copy ahead of the real block and checks that
  // the predicate SEES two, which is the condition the assertion above refuses.
  //
  // The arm cannot be proved by the real pages, because on them the answer is always 1. That is why
  // it is planted rather than asserted: an arm that never meets its own failure is an arm nobody
  // knows works.
  const plantContext = await browser.newContext({
    javaScriptEnabled: false,
    reducedMotion: "reduce",
    viewport: { width: 1280, height },
  });
  try {
    const page = await plantContext.newPage();
    const target = "**/papers/mass-energy/view/german/**";
    await page.route(target, async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(
        "<main",
        '<p id="s0-p5" data-block-id="s0-p5">planted duplicate</p><main',
      );
      await route.fulfill({ response, body, contentType: "text/html; charset=utf-8" });
    });
    await page.goto(`${url}/papers/mass-energy/view/german/#s0-p5`);
    const planted = await page.evaluate(() => ({
      duplicates: document.querySelectorAll('[id="s0-p5"]').length,
      targetedText: document.querySelector(":target")?.textContent ?? "",
    }));
    // The plant landed. Reading the verdict without checking this is how a green plant indicts the
    // plant rather than the page.
    assert.equal(
      planted.duplicates,
      2,
      `the plant did not land: ${planted.duplicates} element(s) carry s0-p5`,
    );
    // And the fragment now resolves to the planted copy, which is the reader-facing harm.
    assert.match(planted.targetedText, /planted duplicate/);
  } finally {
    await plantContext.close();
  }
  check("a concordance first-use link lands on the German paragraph it names, without JavaScript", {
    anchorsFollowed: followed,
    plantedDuplicateCaught: true,
    perPaper: perPaper.join(" | "),
  });
}
