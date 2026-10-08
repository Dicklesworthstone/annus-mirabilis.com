/**
 * CRITERION 7 OF am-read-anchors-navigation-a6o: "The outline tracks the current section and is
 * keyboard operable at desktop and 320 px."
 *
 * It is implemented and was ungated. The live outline is PaperPage.tsx's
 * `<aside className="reader-outline">` with `<nav aria-label="Argument outline">` and real `<a>`
 * elements, and ReaderController.tsx tracks the current section with an IntersectionObserver that
 * toggles `data-current` on the link's group.
 *
 * `src/reader/Outline.tsx` IS NOT THAT COMPONENT and nothing mounts it. It renders
 * `aria-label="Section outline"` and `aria-current="location"`, neither of which appears anywhere in
 * the built site (0 files), while `aria-label="Argument outline"` is on every paper route. So it is
 * an unmounted duplicate of a live capability, the same shape as aliasAnchors.ts, and this lane
 * deliberately asserts the LIVE markup. Asserting Outline.tsx's spelling would have produced a test
 * that passed against a component no reader reaches.
 *
 * WHAT MAKES THIS NON-TRIVIAL TO ASSERT: "nothing is marked" is the correct answer at the top of
 * the page, above the first section, so a lane that only checked for a mark would fail for a
 * truthful implementation, and a lane that only checked once could pass for an implementation that
 * marks one entry permanently. Both directions are asserted below.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const OUT_DIR = join(REPO_ROOT, "out");
const PAPER = "special-relativity";

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

/** The section the outline currently marks, read from the live markup. */
async function marked(page: Page): Promise<{ count: number; anchor: string | null }> {
  return page.evaluate(() => {
    const groups = [...document.querySelectorAll(".reader-outline [data-current]")];
    const link = groups[0]?.querySelector("a");
    return {
      count: groups.length,
      anchor: link?.getAttribute("data-reader-anchor") ?? null,
    };
  });
}

async function scrollToSection(page: Page, id: string): Promise<void> {
  await page.evaluate((anchor) => {
    const el = document.getElementById(anchor);
    if (el)
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 50,
        behavior: "instant",
      });
  }, id);
  await page.waitForTimeout(700);
}

for (const width of [1440, 320] as const) {
  test(`the outline tracks the current section and is keyboard operable at ${width}px`, {
    timeout: 180_000,
  }, async (ctx) => {
    assertOutFreshness("out", REPO_ROOT);
    const { server, origin } = await startStaticServer(OUT_DIR);
    const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
    const browser = await chromium.launch(executablePath ? { executablePath } : {});
    try {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(`${origin}/papers/${PAPER}/`, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1500);

      // 1. The LIVE outline, by the markup the built site actually carries.
      const shape = await page.evaluate(() => {
        const aside = document.querySelector(".reader-outline");
        const nav = aside?.querySelector("nav");
        return {
          present: aside !== null,
          label: nav?.getAttribute("aria-label") ?? null,
          links: nav?.querySelectorAll("a").length ?? 0,
          // Outline.tsx's spelling, which must NOT be what is live, or this lane is testing the
          // unmounted duplicate and the live component is unguarded again.
          duplicateLabel: document.querySelector('[aria-label="Section outline"]') !== null,
        };
      });
      assert.equal(shape.present, true, "no .reader-outline on the paper route");
      assert.equal(shape.label, "Argument outline");
      assert.equal(
        shape.duplicateLabel,
        false,
        "the page carries Outline.tsx's 'Section outline'; this lane now tests the wrong component",
      );
      assert.ok(shape.links >= 10, `only ${shape.links} outline links`);
      ctx.diagnostic(
        `${width}px: ${shape.links} links under aria-label ${JSON.stringify(shape.label)}`,
      );

      // 2. AT THE TOP OF THE PAGE, NOTHING IS CURRENT, and that is the right answer rather than a
      //    missing feature: above the first section no section is in view. An implementation that
      //    marked §1 here would be asserting something false.
      const atTop = await marked(page);
      assert.equal(
        atTop.count,
        0,
        `${atTop.count} entries marked at the top of the page, pointing at ${String(atTop.anchor)}`,
      );

      // 3. Scrolling into each section marks exactly that one.
      const sections = await page.evaluate(() =>
        [...document.querySelectorAll(".reader-section")].map((e) => e.id).slice(0, 5),
      );
      assert.ok(sections.length >= 4, `only ${sections.length} .reader-section elements found`);
      const seen: string[] = [];
      for (const id of sections) {
        await scrollToSection(page, id);
        const now = await marked(page);
        assert.equal(now.count, 1, `${now.count} entries marked while ${id} is in view`);
        assert.equal(
          now.anchor,
          id,
          `${id} is in view but the outline marks ${String(now.anchor)}`,
        );
        seen.push(now.anchor as string);
      }
      ctx.diagnostic(`${width}px: tracked ${seen.join(" -> ")}`);
      // The mark MOVED. Without this, an implementation that marked one entry forever would satisfy
      // every assertion above for the one section that happened to match.
      assert.ok(
        new Set(seen).size >= 4,
        `the mark only ever landed on ${[...new Set(seen)].join(", ")}`,
      );

      // 4. KEYBOARD. Real <a> elements, so this is a question about whether anything hides them --
      //    at 320px the layout changes from a sticky column to a static block, which is where a
      //    collapse into an unreachable menu would show up.
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.locator("body").press("Tab");
      let reached: string | null = null;
      for (let i = 1; i <= 60 && reached === null; i += 1) {
        reached = await page.evaluate(() => {
          const a = document.activeElement;
          return a !== null && a.closest(".reader-outline") !== null
            ? (a.textContent ?? "").trim().slice(0, 40)
            : null;
        });
        if (reached === null) await page.keyboard.press("Tab");
        else break;
      }
      assert.notEqual(reached, null, "no outline link could be reached with 60 Tab presses");
      ctx.diagnostic(`${width}px: keyboard reached ${JSON.stringify(reached)}`);

      // And the focused link must be visible, not merely focusable: a link scrolled or clipped out
      // of the viewport is reachable and useless.
      const focusBox = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        if (a === null) return null;
        const b = a.getBoundingClientRect();
        const s = getComputedStyle(a);
        return {
          w: b.width,
          h: b.height,
          left: b.left,
          right: b.right,
          display: s.display,
          visibility: s.visibility,
        };
      });
      assert.ok(focusBox, "no focused element");
      const f = focusBox as {
        w: number;
        h: number;
        left: number;
        right: number;
        display: string;
        visibility: string;
      };
      assert.ok(f.w > 0 && f.h > 0, `the focused outline link has no box (${f.w}x${f.h})`);
      assert.notEqual(f.visibility, "hidden");
      assert.ok(
        f.left >= -1 && f.right <= width + 1,
        `the focused link spans ${f.left}..${f.right} at ${width}px`,
      );
    } finally {
      await browser.close();
      await new Promise<void>((done) => server.close(() => done()));
    }
  });
}

/**
 * CRITERION 6'S SECOND SENTENCE: "Focus lands on navigation targets and is not obscured."
 *
 * Both halves are measurable and both are easy to assert vacuously, so each carries its control.
 *
 * FOCUS: a browser does NOT move focus when a fragment link points at a non-focusable element -- the
 * target becomes `:target` and focus stays on the LINK, so a keyboard reader's next Tab continues
 * from the outline rather than from the section they just chose. The fix is `tabindex="-1"` on the
 * target plus an explicit focus, and it is applied here: measured, after both a click and an Enter
 * press on an outline link, `document.activeElement` is `section#s1` and not the anchor.
 *
 * OBSCURED: being in the viewport is not enough, because a sticky header can paint over the top of
 * a focused target that is technically on screen. So this samples what is actually painted at three
 * points across the target's first line with elementFromPoint, rather than comparing rectangles.
 *
 * Measured: section#s1 at top 104 (1280px) and top 266 (320px), 1,682px and 2,182px tall, with all
 * three points reporting the target itself.
 */
for (const width of [1280, 320] as const) {
  test(`focus lands on the navigation target and is not obscured at ${width}px`, {
    timeout: 180_000,
  }, async (ctx) => {
    assertOutFreshness("out", REPO_ROOT);
    const { server, origin } = await startStaticServer(OUT_DIR);
    const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
    const browser = await chromium.launch(executablePath ? { executablePath } : {});
    try {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(`${origin}/papers/${PAPER}/`, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1400);

      // The outline collapses groups, so later links are genuinely not visible and clicking one
      // times out. Take the first VISIBLE link past s0 -- s0 is already where the page starts, so
      // following it would move nothing and the lane would pass without a navigation.
      const all = page.locator(".reader-outline nav a[data-reader-anchor]");
      const count = await all.count();
      let anchor: string | null = null;
      let index = -1;
      for (let i = 0; i < count; i += 1) {
        const candidate = all.nth(i);
        if (!(await candidate.isVisible())) continue;
        const value = await candidate.getAttribute("data-reader-anchor");
        if (value && value !== "s0") {
          anchor = value;
          index = i;
          break;
        }
      }
      assert.notEqual(anchor, null, `no visible outline link past s0 among ${count}`);
      await all.nth(index).click();
      await page.waitForTimeout(1100);

      const focused = await page.evaluate(() => {
        const active = document.activeElement;
        if (active === null || active === document.body) return null;
        const box = active.getBoundingClientRect();
        const style = getComputedStyle(active);
        // What is PAINTED across the target's first line, which is what "obscured" means. Three
        // points, because a header or a gutter can cover one edge and not the middle.
        const y = Math.max(2, Math.min(box.top + 6, window.innerHeight - 2));
        const painted = [0.1, 0.5, 0.9].map((fraction) => {
          const x = Math.max(2, Math.min(box.left + box.width * fraction, window.innerWidth - 2));
          const el = document.elementFromPoint(x, y);
          if (el === null) return "(nothing)";
          return el === active || active.contains(el)
            ? "target"
            : `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`;
        });
        return {
          tag: active.tagName.toLowerCase(),
          id: active.id,
          tabindex: active.getAttribute("tabindex"),
          top: Math.round(box.top),
          height: Math.round(box.height),
          isAnchor: active.tagName.toLowerCase() === "a",
          display: style.display,
          painted,
        };
      });
      assert.ok(focused, "nothing is focused after following an outline link");
      const f = focused as {
        tag: string;
        id: string;
        tabindex: string | null;
        top: number;
        height: number;
        isAnchor: boolean;
        display: string;
        painted: string[];
      };
      ctx.diagnostic(
        `${width}px: focus ${f.tag}#${f.id} tabindex=${f.tabindex} top=${f.top} h=${f.height} painted=${JSON.stringify(f.painted)}`,
      );

      // FOCUS LANDED ON THE TARGET, not on the link. The second assertion is the one that matters:
      // leaving focus on the anchor is the browser's own default, so without it this lane would
      // pass for an implementation that did nothing.
      assert.equal(f.id, anchor, `focus is on #${f.id}, not the chosen target #${String(anchor)}`);
      assert.equal(
        f.isAnchor,
        false,
        "focus stayed on the link, which is the default this criterion exists to override",
      );
      assert.equal(
        f.tabindex,
        "-1",
        "the target is not programmatically focusable, so focus cannot be moved to it",
      );

      // NOT OBSCURED: on screen, with a real box, and nothing painted over its first line.
      assert.ok(
        f.top >= 0 && f.top < 900,
        `the focused target sits at top ${f.top}, outside the viewport`,
      );
      assert.ok(
        f.height > 0 && f.display !== "none",
        `the focused target has no box (${f.height}px, display ${f.display})`,
      );
      assert.deepEqual(
        f.painted,
        ["target", "target", "target"],
        `something is painted over the focused target: ${f.painted.join(", ")}`,
      );
    } finally {
      await browser.close();
      await new Promise<void>((done) => server.close(() => done()));
    }
  });
}
