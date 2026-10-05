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
 * count a box that scrolls because of a sibling.
 *
 * Every <details> is opened first, because some disclosures render their formulas only when a
 * reader opens them, and those were never in the DOM the census measured: on live (2026-09-24) it
 * laid out 562 formulas closed and 699 opened; /papers/brownian-motion/ alone goes from 23 to 79. A
 * formula already rendered inside a closed disclosure keeps its layout box in Chromium and was
 * always counted, so opening adds the lazily rendered ones, not those.
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

/** Opens every disclosure, as a reader may, and lets anything that renders on opening render. */
async function openDisclosures(page: Page) {
  await page.evaluate(() => {
    for (const details of document.querySelectorAll("details")) details.open = true;
  });
  await page.waitForTimeout(150);
}

/** Each laid-out display formula wider than its box: "drawn/available". */
/**
 * WHAT IS WRONG WITH HOW A DISPLAY TOO WIDE FOR ITS BOX BEHAVES (am-ke2x).
 *
 * THIS USED TO REPORT THE OVERFLOW ITSELF, and the test was named "no display formula is wider than
 * its box at 320px". That standard is wrong for mathematics on a reading face, and the other half of
 * this same file says so: `germanProblems` lets a wide display SCROLL inside a focusable region named
 * "..., scrolls sideways", and the test asserts `germanWide > 0` because such displays are EXPECTED to
 * exist. AGENTS.md requires long mathematics to stay readable and reachable; making
 * `f(x + \Delta, t) = f(x, t) + \Delta \partial f/\partial x + ...` fit 288px means wrapping or
 * shrinking it to illegibility. am-14at's "make them fit rather than scroll" ruling was about twelve
 * lab TABLES tripping a lint rule, not about displayed equations.
 *
 * MEASURED BEFORE CHANGING THE RULE, because the honest question was whether the 119 overflows this
 * gate reported were defects. Across ten routes covering every face of all four papers, at 320px:
 * 76 overflowing displays, 76 keyboard-reachable, 76 with an accessible name, 0 whose name contains
 * TeX. Their holders are span.equation-body, span.inline-display, div.formula and div.capstone-math.
 * The product was already doing the right thing on every one of them, so there was nothing to fix and
 * a gate demanding the opposite.
 *
 * So the question asked here is now the same one the German half asks, applied to every face, and it
 * is STRICTLY MORE than the old rule tested: a display wider than its box must sit in a clipping box,
 * be reachable by keyboard, and carry a name that is not TeX. Each clause can fail on its own.
 *
 * ONE CLAUSE OF THE OLD RULE SURVIVES UNCHANGED, and it is the one that mattered: if nothing clips
 * the display, the overflow reaches the page and the page scrolls sideways. That is WCAG 2.2 reflow
 * and is still a failure.
 */
function overflowing(page: Page) {
  return page.evaluate(() => {
    const rows: string[] = [];
    let laidOut = 0;
    let wide = 0;
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
      const clipped = box && box !== document.body;
      const holder = clipped ? (box as HTMLElement) : document.documentElement;
      const style = getComputedStyle(holder);
      const available =
        holder.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      // A red names the formula, so it can be found in the source without a second probe.
      const tex = (
        display.querySelector('annotation[encoding="application/x-tex"]')?.textContent ?? ""
      )
        .replace(/\s+/g, " ")
        .slice(0, 60);
      if (drawn <= available + 1) continue;
      wide++;
      const where = `${Math.round(drawn)}/${Math.round(available)} ${tex}`;
      // NOTHING CLIPS IT, so the overflow reaches the page and the page scrolls sideways. That is
      // WCAG 2.2 reflow and is a failure at any width, which is the one part of the old rule that
      // had to survive unchanged.
      if (!clipped) {
        rows.push(`${where}: nothing clips it, so the page scrolls sideways`);
        continue;
      }
      const name = holder.getAttribute("aria-label") ?? "";
      if (holder.getAttribute("tabindex") !== "0") {
        rows.push(`${where}: scrolls with no tab stop`);
      }
      if (!name.trim()) {
        rows.push(`${where}: scrolls with no accessible name`);
      } else if (name.includes("\\")) {
        rows.push(`${where}: its name holds TeX`);
      }
    }
    return { laidOut, wide, rows };
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

test("a display wider than its box scrolls in a named, keyboard-reachable region at 320px", async () => {
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

    // Positive control: a formula wider than any phone, which a disclosure renders only when it
    // is opened, as the lazily rendered ones do. Absent until opened, so finding it proves the
    // census opens disclosures and waits for what opening renders.
    await page.goto(`${target.url}${all[0]}`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      const main = document.querySelector("main") ?? document.body;
      const details = document.createElement("details");
      details.innerHTML = "<summary>planted</summary>";
      details.addEventListener("toggle", () => {
        if (!details.open) return;
        details.insertAdjacentHTML(
          "beforeend",
          '<span class="katex-display"><span class="katex"><span class="katex-html"><span class="base" style="display:inline-block;width:900px">x</span></span></span></span>',
        );
      });
      main.append(details);
    });
    assert.equal(
      (await overflowing(page)).rows.length,
      0,
      "closed, the planted disclosure has rendered nothing",
    );
    await openDisclosures(page);
    assert.equal(
      (await overflowing(page)).rows.length > 0,
      true,
      "opened, the planted formula is found",
    );

    let laidOut = 0;
    let wideSeen = 0;
    const found: string[] = [];
    for (const route of all) {
      await page.goto(`${target.url}${route}`, { waitUntil: "networkidle" });
      await openDisclosures(page);
      // LET THE OVERFLOW SCRIPT SEE WHAT OPENING A DISCLOSURE REVEALED (am-ke2x). Opening a
      // disclosure renders formulas that were not in the DOM, and formulaOverflow.inline.ts marks
      // them from a MutationObserver debounced by 50ms, so for a moment a freshly revealed display
      // scrolls without a tab stop. Measured on /papers/brownian-motion/ and /papers/light-quanta/,
      // sampling after opening every disclosure: 0 unmarked at +0ms, 1 at +100ms, 0 at +400ms and
      // 0 at +1500ms. Without this wait the gate reported that one as a keyboard-reachability defect
      // on both pages, which it is not.
      //
      // A fixed interval rather than waiting for the assertion to come true: waiting until nothing
      // is unmarked would make the check vacuous, since it would wait precisely until it passed. The
      // bound is small against what the clause guards, a display that is permanently unreachable, and
      // the same pattern is already used for this script below ("its last timed pass runs 1.2s after
      // load").
      await page.waitForTimeout(500);
      const result = await overflowing(page);
      laidOut += result.laidOut;
      wideSeen += result.wide;
      for (const row of result.rows) found.push(`${route} ${row}`);
      for (const stop of await falseTabStops(page))
        found.push(`${route} ${stop}: nothing to scroll`);
    }
    // THE GERMAN FACES GO THROUGH THE SAME CENSUS NOW (am-ke2x), and then through their own extra
    // checks. `germanProblems` asks its question of `.source-equation` only, and the German faces'
    // wide displays are not in one: measured at 320px on /papers/brownian-motion/view/german/, 11
    // displays overflow and every holder is a `span.inline-display`, while `.source-equation` occurs
    // twice on the page and neither instance overflows. So its `wide` count was 0 of 32 routes and
    // the control built on it reported that the German half "measured nothing" - correctly, and about
    // its own selector rather than about the pages.
    //
    // Running `overflowing()` over these routes as well fixes that without a second selector to
    // drift: it finds the holder by walking up to whatever actually clips, so it cannot miss a class
    // it was not told about, and it asserts exactly what germanProblems asserts of a wide display
    // (clipped, keyboard-reachable, named, name free of TeX). germanProblems is kept for the two
    // things it checks that the census does not: whether the PAGE scrolls sideways, and a display
    // that fits while carrying a tab stop.
    let germanWide = 0;
    const germanFound: string[] = [];
    for (const route of german) {
      await page.goto(`${target.url}${route}`, { waitUntil: "networkidle" });
      await openDisclosures(page);
      // The overflow script's last timed pass runs 1.2s after load.
      await page.waitForTimeout(1500);
      const census = await overflowing(page);
      laidOut += census.laidOut;
      germanWide += census.wide;
      for (const row of census.rows) germanFound.push(`${route} ${row}`);
      const result = await germanProblems(page);
      for (const stop of await falseTabStops(page))
        germanFound.push(`${route} ${stop}: nothing to scroll`);
      for (const problem of result.problems) germanFound.push(`${route} ${problem}`);
    }
    console.log(
      `[formula width] ${all.length} routes, ${laidOut} laid-out formulas, ${wideSeen} wider than ` +
        `their box, ${found.length} problems; ` +
        `German source faces: ${german.length} routes, ${germanWide} wider than their box, ` +
        `${germanFound.length} problems`,
    );
    // ONE LIST, SO A CONTROL CANNOT STAND IN FRONT OF THE FINDINGS (am-enpr).
    //
    // These were four assertions in this order: laidOut > 500, germanWide > 0, found empty,
    // germanFound empty. The first two are non-vacuity controls and the last two are the actual
    // defects, so the controls were ABOVE the findings. On 2026-10-04 `germanWide` reached 0, which
    // aborted the test at that line and hid 119 entries in `found` that nobody could see. AGENTS.md
    // records this exact shape: "a brittle count does not merely fail; it hides what it was standing
    // in front of."
    //
    // Both kinds of claim still hold, and both are still asserted. They are collected into one list
    // first, so a run reports every finding AND every vacuity in a single failure instead of the one
    // that happens to come first.
    const problems = [...found, ...germanFound];
    if (laidOut <= 500) {
      problems.push(
        `only ${laidOut} formulas were laid out across ${all.length} routes, so this census measured too little to mean anything`,
      );
    }
    // Per face family, because one total could hide an empty half. This is now counted by the same
    // census as the reading faces, so it measures the pages rather than one class name.
    if (germanWide === 0) {
      problems.push(
        `no display was wider than its box on any of the ${german.length} German source faces, so the German half of this gate measured nothing`,
      );
    }
    // The reading faces' own non-vacuity, which the old rule did not need and this one does: it
    // asserts a property OF wide displays, so with none anywhere it would pass over an empty
    // population. Measured today: 76 across ten routes, so this is a floor and not a census.
    if (wideSeen === 0) {
      problems.push(
        `no display was wider than its box on any of the ${all.length} routes, so the clause about how a wide display must behave measured nothing`,
      );
    }
    assert.deepEqual(problems, []);
  } finally {
    await browser.close();
    await target.close();
  }
});

/**
 * The Before and After regions of the missing-step panels carry no tab stop because they fit
 * (am-14at): 16 instances, the widest 254/254 at 320px and 308/308 at 1280px on live 095fe596.
 * The census above runs at 320px only, so these are held at both widths the bead names. Each route
 * must show some regions, so a route that stops rendering them cannot pass by measuring nothing.
 */
test("the missing-step regions fit at 320px and 1280px", async () => {
  const target = await laneTarget();
  const browser = await chromium.launch();
  try {
    const wide: string[] = [];
    for (const width of [320, 1280]) {
      const page = await (
        await browser.newContext({
          userAgent: LANE_USER_AGENT,
          viewport: { width, height: 900 },
          reducedMotion: "reduce",
        })
      ).newPage();
      for (const route of ["/papers/brownian-motion/", "/papers/brownian-motion/s4/"]) {
        await page.goto(`${target.url}${route}`, { waitUntil: "networkidle" });
        await openDisclosures(page);
        const regions = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>(".missing-step-math")].map((el) => ({
            step: el.closest("[data-missing-step]")?.getAttribute("data-missing-step") ?? "?",
            label: el.getAttribute("aria-label") ?? "",
            scroll: el.scrollWidth,
            client: el.clientWidth,
          })),
        );
        assert.ok(regions.length > 0, `${width}px ${route}: no missing-step region was found`);
        for (const r of regions)
          if (r.scroll > r.client)
            wide.push(`${width}px ${route} ${r.step} ${r.label}: ${r.scroll}/${r.client}`);
      }
      await page.close();
    }
    assert.deepEqual(wide, []);
  } finally {
    await browser.close();
    await target.close();
  }
});
