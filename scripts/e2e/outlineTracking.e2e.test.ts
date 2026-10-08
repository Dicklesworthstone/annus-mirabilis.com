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
