import assert from "node:assert/strict";
import test from "node:test";
import { type Browser, chromium, type Page } from "playwright";
import {
  COVERAGE,
  DEFAULT_SEED,
  DEGREES_CHOICES,
  drawRepeatedIntervals,
  TRIAL_CHOICES,
  TRUE_DIFFUSIVITY,
} from "../foundations/repeatedIntervals.ts";
import { EXPONENT_CHOICES, SPREAD_CHOICES, twoCurves } from "../foundations/twoCurves.ts";
import {
  closeDrawer,
  focusLessonLink,
  journeyRunner,
  LANE_USER_AGENT,
  laneTarget,
  openDrawer,
  tabUntil,
} from "./foundationsLane.ts";

/**
 * am-found-statistics-inference-pzqv, browser lane, from the bead's end-to-end tests:
 *
 * - error-and-inference: "From a Brownian §5 passage, open it in the drawer, run the
 *   repeated-experiment view with a fixed seed, read the covering fraction from the table, and
 *   return to the exact sentence. Repeat with JavaScript disabled."
 * - two-measurements-two-unknowns: from §5's identifiability statement open it in the drawer, read
 *   the worked example, operate the construction (the region widens as the bands turn parallel,
 *   with identical values in the visual and the text route), follow the link to the companion
 *   record's inversion and return, and repeat by keyboard, at 320 px, without JavaScript on the
 *   standalone route, and in print.
 *
 * Adapted where the page differs from the plan, and said so: the construction reports its region
 * in a status line and in the drawing's accessible name, not in a table; and the worked example
 * shows its decisive step without a reveal, so the lane asserts it is visible instead of revealing
 * it. The seed is the construction's fixed default, "1906", and the covering count is compared
 * with drawRepeatedIntervals at that seed, not with a typed number.
 */

const journey = journeyRunner("found-statistics-inference", "am-found-statistics-inference-pzqv");
const PASSAGE = "/papers/brownian-motion/s5/";
const ANCHOR = "arg-bm-inference";
const ERROR = "error-and-inference";
const TWO = "two-measurements-two-unknowns";
const COMPANION = "/lab/avogadro-lab/";

const expectedCover = () => {
  const outcome = drawRepeatedIntervals({
    seed: DEFAULT_SEED,
    q: DEGREES_CHOICES[0],
    trials: TRIAL_CHOICES[0],
  });
  assert.equal(outcome.status, "drawn");
  return outcome.status === "drawn" ? outcome : assert.fail("unreachable");
};

/** The covering count as the construction states it, and as its list of experiments shows it. */
async function readCover(page: Page, scope: string) {
  return page.evaluate(
    ({ scope, lesson }) => {
      const root = document.querySelector(`${scope} [data-foundation-construction="${lesson}"]`);
      const status = (root?.querySelector(".construction-display")?.textContent ?? "").replace(
        /\s+/g,
        " ",
      );
      const rows = [...(root?.querySelectorAll("ol.magnitude-rows li") ?? [])].map(
        (li) => li.textContent ?? "",
      );
      return {
        status,
        rows: rows.length,
        covers: rows.filter((r) => /\bcovers\b/.test(r)).length,
        misses: rows.filter((r) => /\bmisses\b/.test(r)).length,
      };
    },
    { scope, lesson: ERROR },
  );
}

function checkCover(read: Awaited<ReturnType<typeof readCover>>) {
  const owner = expectedCover();
  assert.ok(
    read.status.includes(
      `${owner.covered} of ${owner.trials} intervals cover ${TRUE_DIFFUSIVITY} μm²/s.`,
    ),
    `status reads "${read.status.slice(0, 120)}"`,
  );
  assert.ok(read.status.includes(`Seed ${DEFAULT_SEED}, q = ${DEGREES_CHOICES[0]}.`));
  assert.equal(read.rows, owner.trials);
  assert.equal(read.covers, owner.covered, "the list's covers match the stated count");
  assert.equal(read.covers + read.misses, read.rows);
  return `${owner.covered} of ${owner.trials} cover at seed ${DEFAULT_SEED} (${Math.round(COVERAGE * 100)} per cent procedure)`;
}

/** The region as the status line and as the drawing's accessible name report it, and the overlap's width. */
async function readRegion(page: Page, scope: string) {
  return page.evaluate(
    ({ scope, lesson }) => {
      const root = document.querySelector(`${scope} [data-foundation-construction="${lesson}"]`);
      const pattern =
        /between ([\d.]+) and ([\d.]+) times the true radius, and N between ([\d.]+) and ([\d.]+) times the true N/;
      const status = (root?.querySelector(".construction-display")?.textContent ?? "").replace(
        /\s+/g,
        " ",
      );
      const label = root?.querySelector("svg[role=img]")?.getAttribute("aria-label") ?? "";
      const overlap = root?.querySelector(".curves-overlap") as SVGGraphicsElement | null;
      return {
        status: status.match(pattern)?.slice(1) ?? null,
        label: label.match(pattern)?.slice(1) ?? null,
        overlapWidth: overlap ? overlap.getBBox().width : null,
      };
    },
    { scope, lesson: TWO },
  );
}

function ownerRegion(exponent: number) {
  const o = twoCurves({ second: true, exponent, spread: SPREAD_CHOICES[1] });
  assert.equal(o.status, "region");
  if (o.status !== "region") return assert.fail("unreachable");
  return [o.radiusFactor.low, o.radiusFactor.high, o.numberFactor.low, o.numberFactor.high].map(
    (v) => v.toFixed(2),
  );
}

async function withPage(
  browser: Browser,
  options: Readonly<{ jsEnabled: boolean; width: number; print?: boolean }>,
  run: (page: Page) => Promise<void>,
) {
  const context = await browser.newContext({
    userAgent: LANE_USER_AGENT,
    viewport: { width: options.width, height: 760 },
    reducedMotion: "reduce",
    javaScriptEnabled: options.jsEnabled,
  });
  const page = await context.newPage();
  if (options.print) await page.emulateMedia({ media: "print" });
  try {
    await run(page);
  } finally {
    await context.close();
  }
}

test("error-and-inference: the covering count read in the drawer by keyboard at 320 px, and read again without JavaScript", async () => {
  const site = await laneTarget();
  const browser = await chromium.launch();
  try {
    await withPage(browser, { jsEnabled: true, width: 320 }, (page) =>
      journey(
        page,
        {
          testId: "error-inference-drawer-keyboard-320",
          viewport: "320x760",
          reducedMotion: true,
          jsEnabled: true,
        },
        async () => {
          const { link, top } = await focusLessonLink(page, `${site.url}${PASSAGE}`, ANCHOR, ERROR);
          await openDrawer(page, ERROR);
          const said = checkCover(await readCover(page, "dialog[open]"));
          await closeDrawer(page, "Escape", { link, top, anchor: ANCHOR });
          return `drawer: ${said}; Escape returned focus to the link in #${ANCHOR}`;
        },
      ),
    );

    await withPage(browser, { jsEnabled: false, width: 320 }, (page) =>
      journey(
        page,
        {
          testId: "error-inference-no-js-320",
          viewport: "320x760",
          reducedMotion: true,
          jsEnabled: false,
        },
        async () => {
          await page.goto(`${site.url}${PASSAGE}#${ANCHOR}`, { waitUntil: "load" });
          await tabUntil(page, `#${ANCHOR} a[data-foundation="${ERROR}"]`, 30);
          await Promise.all([
            page.waitForURL(`**/foundations/${ERROR}/`),
            page.keyboard.press("Enter"),
          ]);
          const said = checkCover(await readCover(page, "main"));
          const back = `main a[href="${PASSAGE}#${ANCHOR}"]`;
          const presses = await tabUntil(page, back, 200);
          await Promise.all([
            page.waitForURL(`**${PASSAGE}#${ANCHOR}`),
            page.keyboard.press("Enter"),
          ]);
          const landed = await page.evaluate((anchor) => {
            const r = document.getElementById(anchor)?.getBoundingClientRect();
            return { hash: location.hash, top: r?.top ?? null, height: innerHeight };
          }, ANCHOR);
          assert.equal(landed.hash, `#${ANCHOR}`);
          assert.ok(
            landed.top !== null && landed.top > -2 && landed.top < landed.height,
            `the passage is on screen (${landed.top})`,
          );
          return `without JavaScript the link opened the lesson page: ${said}; its return link, ${presses} Tabs in, landed on #${ANCHOR}`;
        },
      ),
    );
  } finally {
    await browser.close();
    await site.close();
  }
});

test("two-measurements: read, operate and close in the drawer by keyboard at 320 px", async () => {
  const site = await laneTarget();
  const browser = await chromium.launch();
  try {
    await withPage(browser, { jsEnabled: true, width: 320 }, (page) =>
      journey(
        page,
        {
          testId: "two-measurements-drawer-keyboard-320",
          viewport: "320x760",
          reducedMotion: true,
          jsEnabled: true,
        },
        async () => {
          const { link, top } = await focusLessonLink(page, `${site.url}${PASSAGE}`, ANCHOR, TWO);
          await openDrawer(page, TWO);
          const decisive = await page.evaluate(() => {
            const dialog = document.querySelector("dialog[open]");
            const item = [...(dialog?.querySelectorAll("li, p") ?? [])].find((e) =>
              (e.textContent ?? "").includes("The decisive step"),
            );
            return item ? item.getClientRects().length > 0 : false;
          });
          assert.equal(decisive, true, "the worked example's decisive step is on the page");

          const [steep, next] = EXPONENT_CHOICES;
          const before = await readRegion(page, "dialog[open]");
          assert.deepEqual(before.status, ownerRegion(steep));
          assert.deepEqual(before.label, before.status, "the drawing says what the text says");

          // Keyboard only: Tab to the next, shallower slope and press it.
          for (let presses = 0; ; presses++) {
            assert.ok(presses < 60, `k = ${next} was not reached by Tab`);
            await page.keyboard.press("Tab");
            const on = await page.evaluate(
              (t) => document.activeElement?.textContent?.trim() === t,
              `k = ${next}`,
            );
            if (on) break;
          }
          await page.keyboard.press("Enter");
          const after = await readRegion(page, "dialog[open]");
          assert.deepEqual(after.status, ownerRegion(next));
          assert.deepEqual(after.label, after.status);
          const [lo0, hi0] = (before.status ?? []).map(Number);
          const [lo1, hi1] = (after.status ?? []).map(Number);
          assert.ok(
            (hi1 as number) / (lo1 as number) > (hi0 as number) / (lo0 as number),
            "the radius range widens as the bands turn parallel",
          );
          assert.ok(
            (after.overlapWidth ?? 0) > (before.overlapWidth ?? 0),
            `the drawn overlap widens (${before.overlapWidth} to ${after.overlapWidth})`,
          );

          await closeDrawer(page, "the close button", { link, top, anchor: ANCHOR });
          return `k = ${steep}: radius ${before.status?.slice(0, 2).join("-")}; k = ${next}: ${after.status?.slice(0, 2).join("-")}, text and drawing agree; closed by the close button back to #${ANCHOR}`;
        },
      ),
    );
  } finally {
    await browser.close();
    await site.close();
  }
});

test("two-measurements standalone: the link to the companion inversion, and back", async () => {
  const site = await laneTarget();
  const browser = await chromium.launch();
  const lesson = `${site.url}/foundations/${TWO}/`;
  try {
    await withPage(browser, { jsEnabled: true, width: 390 }, (page) =>
      journey(
        page,
        {
          testId: "two-measurements-companion-and-back",
          viewport: "390x760",
          reducedMotion: true,
          jsEnabled: true,
        },
        async () => {
          await page.goto(lesson, { waitUntil: "networkidle" });
          const companion = page.locator(
            `[data-foundation-construction="${TWO}"] a[href="${COMPANION}"]`,
          );
          assert.equal(await companion.count(), 1, "the lesson links to the companion inversion");
          await Promise.all([page.waitForURL(`**${COMPANION}`), companion.press("Enter")]);
          assert.match(await page.title(), /Three ways to infer the molecular number/);
          await page.goBack({ waitUntil: "networkidle" });
          assert.ok(page.url().endsWith(`/foundations/${TWO}/`));
          assert.equal(await page.locator(`[data-foundation-construction="${TWO}"]`).count(), 1);
          return `the lesson's link opened ${COMPANION} and Back returned to the lesson`;
        },
      ),
    );
  } finally {
    await browser.close();
    await site.close();
  }
});

for (const mode of ["no-js", "print"] as const)
  test(`two-measurements standalone at 320 px, ${mode === "no-js" ? "without JavaScript" : "in print"}: the region in text and drawing, the words, the decisive step, the companion link`, async () => {
    const site = await laneTarget();
    const browser = await chromium.launch();
    try {
      await withPage(
        browser,
        { jsEnabled: mode !== "no-js", width: 320, print: mode === "print" },
        (page) =>
          journey(
            page,
            {
              testId: `two-measurements-standalone-${mode}-320`,
              viewport: "320x760",
              reducedMotion: true,
              jsEnabled: mode !== "no-js",
            },
            async () => {
              await page.goto(`${site.url}/foundations/${TWO}/`, { waitUntil: "load" });
              const region = await readRegion(page, "main");
              assert.deepEqual(region.status, ownerRegion(EXPONENT_CHOICES[0]));
              assert.deepEqual(region.label, region.status);
              const page320 = await page.evaluate(
                ({ lesson, companion }) => {
                  const root = document.querySelector(
                    `main [data-foundation-construction="${lesson}"]`,
                  );
                  const text = (document.querySelector("main") as HTMLElement | null)?.innerText;
                  return {
                    words: root?.querySelector(".construction-text-equivalent") !== null,
                    companion: root?.querySelector(`a[href="${companion}"]`) !== null,
                    decisive: (text ?? "").includes("The decisive step"),
                    overflow:
                      document.documentElement.scrollWidth - document.documentElement.clientWidth,
                  };
                },
                { lesson: TWO, companion: COMPANION },
              );
              assert.deepEqual(page320, {
                words: true,
                companion: true,
                decisive: true,
                overflow: 0,
              });
              return `${mode}: the default region, the same in text and drawing, the words, the decisive step and the companion link, no overflow`;
            },
          ),
      );
    } finally {
      await browser.close();
      await site.close();
    }
  });
