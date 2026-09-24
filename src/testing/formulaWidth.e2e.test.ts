import assert from "node:assert/strict";
import test from "node:test";
import { chromium, type Page } from "playwright";
import { LANE_USER_AGENT, laneTarget } from "./foundationsLane.ts";

/**
 * No displayed formula is wider than a phone. At 320px on live (2026-09-24), 11 of 343 laid-out
 * formulas on the section pages and lessons scrolled sideways, and 87 of 398 on the other pages:
 * 46 lab formulas, 7 on the whole-paper pages, and 34 on the German source faces. Each outside the
 * German faces was given an authored break (rowLayout.ts "break" and "terms", a derivation step's
 * "terms", the low-speed factorization's rows, the labs' aligned rows); none by shrinking the font.
 *
 * The German source faces keep Einstein's lines (TanElk's ruling, 2026-09-24): checked against the
 * plates, none of their 20 distinct wide displays is broken where the plate does not break it. There
 * a wide display must instead scroll inside a focusable region named for a listener ("Equation (n),
 * scrolls sideways", never its TeX), the page must not scroll, and a display that fits must not be a
 * tab stop.
 *
 * A formula overflows when its drawn width exceeds the content width of the box that holds it:
 * the nearest ancestor that clips or scrolls, less its padding. Measuring the box instead would
 * count a box that scrolls because of a sibling. Formulas inside a closed disclosure are not laid
 * out and are not counted; the section pages render the explorers' formulas open.
 *
 * Runs against E2E_BASE_URL (a deployment) or a fresh out/ (foundationsLane.ts laneTarget).
 */
const WIDTH = 320;

/** Every page the sitemap lists, the German source faces apart: they are held to scrolling instead. */
async function routes(page: Page, base: string): Promise<{ checked: string[]; german: string[] }> {
  const response = await page.goto(`${base}/sitemap.xml`);
  const xml = (await response?.text()) ?? "";
  const paths = [...xml.matchAll(/<loc>https?:\/\/[^/<]+(\/[^<]*)<\/loc>/g)].map((m) => m[1] ?? "");
  const unique = [...new Set(paths)].sort();
  return {
    checked: unique.filter((p) => !p.includes("/view/german/")),
    german: unique.filter((p) => p.includes("/view/german/")),
  };
}

/** Each laid-out display formula wider than its box: "drawn/available". */
function overflowing(page: Page) {
  return page.evaluate(() => {
    const rows: string[] = [];
    let laidOut = 0;
    for (const display of document.querySelectorAll<HTMLElement>(".katex-display")) {
      if (!display.getClientRects().length) continue;
      laidOut++;
      const html = display.querySelector<HTMLElement>(".katex-html");
      if (!html) continue;
      const drawn = [...html.children].reduce((w, c) => w + c.getBoundingClientRect().width, 0);
      let box: HTMLElement | null = display.parentElement;
      while (box && box !== document.body) {
        const overflowX = getComputedStyle(box).overflowX;
        if (overflowX !== "visible") break;
        box = box.parentElement;
      }
      const holder = box && box !== document.body ? box : document.documentElement;
      const style = getComputedStyle(holder);
      const available =
        holder.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      // A red names the formula, so it can be found in the source without a second probe.
      const tex = (
        display.querySelector('annotation[encoding="application/x-tex"]')?.textContent ?? ""
      )
        .replace(/\s+/g, " ")
        .slice(0, 60);
      if (drawn > available + 1) rows.push(`${Math.round(drawn)}/${Math.round(available)} ${tex}`);
    }
    return { laidOut, rows };
  });
}

/**
 * On a German source face, what is wrong with how its wide displays scroll: the page itself
 * scrolls; a wide display is not inside a focusable region named "..., scrolls sideways" with no
 * TeX in the name; or a display that fits is a tab stop. Runs after the overflow script has marked
 * the page, which it does on load and again after hydration.
 */
function germanProblems(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = [];
    const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    if (over > 0) problems.push(`the page scrolls sideways by ${over}px`);
    let wide = 0;
    for (const region of document.querySelectorAll<HTMLElement>(".source-equation")) {
      if (!region.getClientRects().length) continue;
      const scrolls = region.scrollWidth > region.clientWidth;
      const stop = region.getAttribute("tabindex") === "0";
      const name = region.getAttribute("aria-label") ?? "";
      const id = region.id || "(no id)";
      if (scrolls) {
        wide++;
        if (!stop) problems.push(`${id}: scrolls with no tab stop`);
        if (!/, scrolls sideways$/.test(name)) problems.push(`${id}: named "${name.slice(0, 40)}"`);
        if (name.includes("\\")) problems.push(`${id}: its name holds TeX`);
      } else if (stop && region.hasAttribute("data-scroll-focus")) {
        problems.push(`${id}: a tab stop with nothing to scroll`);
      }
    }
    return { wide, problems };
  });
}

/**
 * Regions the overflow script made tab stops that have nothing to scroll: they fit sideways and
 * scroll less than 12px vertically. KaTeX's glyph boxes run a few pixels past a formula's box, so
 * any box with overflow-x: auto and no overflow-y rule became one (6030eff9, 34b01191). A resize
 * makes the script pass over the page again, so the marks read are the current ones.
 */
async function falseTabStops(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await page.waitForTimeout(250);
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-scroll-focus]")]
      .filter((e) => e.scrollWidth <= e.clientWidth && e.scrollHeight - e.clientHeight < 12)
      .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0]}`),
  );
}

test("no display formula is wider than its box at 320px", async () => {
  const target = await laneTarget();
  const browser = await chromium.launch();
  try {
    const page = await (
      await browser.newContext({
        userAgent: LANE_USER_AGENT,
        viewport: { width: WIDTH, height: 900 },
        reducedMotion: "reduce",
      })
    ).newPage();
    const { checked: all, german } = await routes(page, target.url);
    assert.ok(all.length > 150, `the census found ${all.length} routes`);

    // Positive control: a formula planted wider than any phone is found on the first route.
    await page.goto(`${target.url}${all[0]}`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      const main = document.querySelector("main") ?? document.body;
      main.insertAdjacentHTML(
        "beforeend",
        '<span class="katex-display"><span class="katex"><span class="katex-html"><span class="base" style="display:inline-block;width:900px">x</span></span></span></span>',
      );
    });
    assert.equal((await overflowing(page)).rows.length > 0, true, "the planted formula is found");

    let laidOut = 0;
    const found: string[] = [];
    for (const route of all) {
      await page.goto(`${target.url}${route}`, { waitUntil: "networkidle" });
      const result = await overflowing(page);
      laidOut += result.laidOut;
      for (const row of result.rows) found.push(`${route} ${row}`);
      for (const stop of await falseTabStops(page))
        found.push(`${route} ${stop}: nothing to scroll`);
    }
    // The German source faces: wide displays scroll, in named focusable regions.
    let germanWide = 0;
    const germanFound: string[] = [];
    for (const route of german) {
      await page.goto(`${target.url}${route}`, { waitUntil: "networkidle" });
      // The overflow script's last timed pass runs 1.2s after load.
      await page.waitForTimeout(1500);
      const result = await germanProblems(page);
      for (const stop of await falseTabStops(page))
        germanFound.push(`${route} ${stop}: nothing to scroll`);
      germanWide += result.wide;
      for (const problem of result.problems) germanFound.push(`${route} ${problem}`);
    }
    console.log(
      `[formula width] ${all.length} routes, ${laidOut} laid-out formulas, ${found.length} overflow; ` +
        `German source faces: ${german.length} routes, ${germanWide} wide displays scrolling, ` +
        `${germanFound.length} problems`,
    );
    assert.ok(laidOut > 500, `only ${laidOut} formulas were laid out`);
    assert.ok(germanWide > 0, "the German faces' wide displays were found");
    assert.deepEqual(found, []);
    assert.deepEqual(germanFound, []);
  } finally {
    await browser.close();
    await target.close();
  }
});
