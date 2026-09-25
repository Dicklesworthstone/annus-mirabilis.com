import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { ENTROPY_TEMPERATURE_CHECK } from "../foundations/lessonInstruments.ts";
import { OSMOTIC_ROWS } from "../foundations/osmoticRows.ts";
import {
  closeDrawer,
  focusLessonLink,
  journeyRunner,
  LANE_USER_AGENT,
  laneTarget,
  openDrawer,
} from "./foundationsLane.ts";

/**
 * am-found-transport-thermo-smv3, browser lane. Two journeys from the bead's test plan:
 *
 * - "From Brownian §1 (or its nearest existing passage in the reference slice), open
 *   foundation:free-energy-osmotic-pressure at 320 px with keyboard only and return to the exact
 *   sentence." Brownian §§1-3 have no routes; the nearest passage that opens this lesson is §5's
 *   arg-bm-diffusivity, on the section page of the section it is filed under (§5 until dispatch
 *   215, §3 since).
 * - "Open foundation:entropy-temperature standalone with JavaScript enabled and disabled, and
 *   assert the static worked example and the status line." The status line stood in for the
 *   laboratory until lq-04-derived-temperature was registered; it is registered, so the journey
 *   asserts the laboratory link in its place and that the line is absent.
 *
 * Target and logging: foundationsLane.ts.
 */

const journey = journeyRunner("found-transport-e2e", "am-found-transport-thermo-smv3");
const LESSON = "free-energy-osmotic-pressure";
const ANCHOR = "arg-bm-diffusivity";
// The section the passage is filed under, read from its record: §5 until dispatch 215, §3 since.
const ANCHOR_SECTION = (
  JSON.parse(
    readFileSync(
      join(process.cwd(), "content", "arguments", "brownian-motion", `${ANCHOR}.json`),
      "utf8",
    ),
  ) as { section: string }
).section;

test("from Brownian §5, the osmotic lesson opens and closes by keyboard at 320 px, and focus returns to the calling link", async () => {
  const site = await laneTarget();
  const browser = await chromium.launch();
  try {
    // Measured on live: with smooth scrolling the link read 947 px down before it had arrived.
    const context = await browser.newContext({
      userAgent: LANE_USER_AGENT,
      viewport: { width: 320, height: 700 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const meta = {
      testId: "osmotic-lesson-keyboard-round-trip-320",
      viewport: "320x700",
      reducedMotion: true,
      jsEnabled: true,
    };
    await journey(page, meta, async () => {
      const { link, top, presses } = await focusLessonLink(
        page,
        `${site.url}/papers/brownian-motion/${ANCHOR_SECTION}/`,
        ANCHOR,
        LESSON,
      );
      for (const how of ["Escape", "the close button"] as const) {
        await openDrawer(page, LESSON);
        await page.waitForSelector(
          `dialog[open] [data-foundation-construction="${LESSON}"] table tbody tr`,
        );
        const rows = await page.evaluate(
          (lesson) =>
            document.querySelectorAll(
              `dialog[open] [data-foundation-construction="${lesson}"] table tbody tr`,
            ).length,
          LESSON,
        );
        assert.equal(rows, OSMOTIC_ROWS.length);
        await closeDrawer(page, how, { link, top, anchor: ANCHOR });
      }
      return `Tab reached the lesson link in #${ANCHOR} after ${presses}; opened twice, closed by Escape and by the close button, focus and position restored each time`;
    });
    await context.close();
  } finally {
    await browser.close();
    await site.close();
  }
});

test("entropy-temperature, standalone, with JavaScript on and off: the worked check, the laboratory link, and a disclosure that is never empty", async () => {
  const site = await laneTarget();
  const browser = await chromium.launch();
  const { instrumentId, temperatureK } = ENTROPY_TEMPERATURE_CHECK;
  try {
    for (const jsEnabled of [true, false]) {
      const context = await browser.newContext({
        userAgent: LANE_USER_AGENT,
        viewport: { width: 320, height: 800 },
        reducedMotion: "reduce",
        javaScriptEnabled: jsEnabled,
      });
      const page = await context.newPage();
      const meta = {
        testId: `entropy-temperature-standalone-js-${jsEnabled ? "on" : "off"}`,
        viewport: "320x800",
        reducedMotion: true,
        jsEnabled,
      };
      try {
        await journey(page, meta, async () => {
          await page.goto(`${site.url}/foundations/entropy-temperature/`, {
            waitUntil: "networkidle",
          });
          const root = page.locator('[data-foundation-construction="entropy-temperature"]');
          const worked = await root.evaluate((r) => ({
            steps: r.querySelectorAll(".derivation-steps li").length,
            text: (r.textContent ?? "").replace(/\s+/g, " "),
            labLinks: [...r.querySelectorAll("a[href]")]
              .filter((a) => !a.closest("details"))
              .map((a) => a.getAttribute("href")),
            status: r.querySelector(".construction-status")?.textContent ?? null,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          }));
          assert.equal(worked.steps, 4);
          assert.ok(worked.text.includes(`1 ÷ ${temperatureK} = 3.333 × 10⁻⁴ per kelvin`));
          assert.deepEqual(worked.labLinks, [`/lab/${instrumentId}/`]);
          assert.equal(worked.status, null, "the preset is registered, so no status line");
          assert.equal(worked.overflow, 0);

          await root.locator("summary").press("Enter");
          if (jsEnabled) {
            const frame = root.locator("details iframe");
            await frame.waitFor();
            assert.equal(await frame.getAttribute("src"), `/embed/lab/${instrumentId}/`);
            const inside = await page
              .frameLocator('[data-foundation-construction="entropy-temperature"] details iframe')
              .locator("body")
              .innerText({ timeout: 15_000 });
            assert.ok(inside.includes(String(temperatureK)), "the workbench shows the state");
            return `worked check and laboratory link present; the disclosure loaded /embed/lab/${instrumentId}/ showing ${temperatureK} K`;
          }
          const opened = await root.locator("details").evaluate((d, id) => {
            const link = d.querySelector(`a[href="/lab/${id}/"]`);
            return {
              open: (d as HTMLDetailsElement).open,
              linkHeight: link?.getBoundingClientRect().height ?? 0,
            };
          }, instrumentId);
          assert.equal(opened.open, true);
          assert.ok(
            opened.linkHeight > 0,
            "without JavaScript the opened disclosure holds a visible link to the laboratory",
          );
          return "worked check and laboratory link present; without JavaScript the opened disclosure links to the laboratory's page";
        });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    await site.close();
  }
});
