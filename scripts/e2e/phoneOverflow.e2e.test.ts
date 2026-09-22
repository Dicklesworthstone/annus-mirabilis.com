/**
 * The layout viewport invariant at real phone widths, measured against the BUILT site.
 *
 * `document.documentElement.scrollWidth === clientWidth`. When it does not hold the reader gets
 * horizontal scroll: the column drifts sideways, the right edge of every line is off screen, and
 * pinch-zoom fights the page. It is the single cheapest signal that a layout only works because
 * the viewport is wide.
 *
 * WHY AGAINST out/ AND NOT A FIXTURE. src/testing/styles/computedStylesLayout.test.ts already
 * injects globals.css into a hand-written page and measures a button there. That is a fixture
 * check: it proves the rule computes, on markup the test wrote itself. Every defect this file was
 * written from survived that class of check, because each came from the INTERACTION between real
 * content and a real container - a 64 character sha256 inside a grid item whose min-width is
 * auto, a five column table inside a 342px block, a flex row of buttons with no flex-wrap. None
 * of those is visible in a stylesheet, and none is visible in a fixture whose content the author
 * chose. They are only visible in the artefact a reader actually receives.
 *
 * WHY IT REFUSES A STALE BUILD RATHER THAN SKIPPING. A page that never loaded reports no
 * overflow, and so does a page that is fine; an absent or stale out/ would make this file green
 * for the wrong reason, permanently. assertOutFreshness turns both into a failure that names the
 * cause. This is the same proposition as the 2026-09-21 correction inside outFreshness.ts, one
 * step earlier in the chain.
 *
 * WHY A SINGLE-THREADED SERVER WOULD BE WORSE THAN NO TEST. Measured while writing this: serving
 * out/ with a single-threaded static server reset 591 of 616 page loads under a browser's
 * parallel asset fetches. The sweep reported "2 violations" and looked clean; it had measured 25
 * pages of 616. Node's http server handles concurrent sockets, and the measured pair count below
 * is printed so a collapsed denominator is visible rather than silent.
 *
 * WHY IT COPIES out/ BEFORE MEASURING. In this shared checkout a peer rebuilds out/ several times
 * an hour, and `next build` empties the directory before it refills it. The first run of this test
 * loaded /notation/ at 320px and got a 404 for the same route at 360px, mid-rebuild. Refusing on
 * that would have been a refusal on a condition that is permanently true here, which is the exact
 * shape of the failure outFreshness.ts records: a gate that reads like diligence and is really an
 * off switch. So the pages are copied once, the copy is checked for a single Next build id, and
 * every measurement runs against that immutable snapshot. Two build ids means the copy caught a
 * rebuild in progress and the test says so instead of measuring a mixture.
 *
 * WHY KNOWN_OVERFLOWING IS A RATCHET AND NOT A SUPPRESSION. Those routes overflow today for
 * causes named beside each one, and several sit behind decisions that are not mine to take (see
 * the orphaned-stylesheet note on am-read-page-anatomy-l0b). Listing them as "expected to pass"
 * would be a lie and deleting them from the route set would hide them. So the test asserts they
 * STILL overflow: repairing one turns this file RED and the message says to promote it to
 * MUST_FIT. A fix cannot land silently and the list cannot quietly rot.
 */

import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const OUT_DIR = join(REPO_ROOT, "out");

/**
 * Copies the routes under test out of the shared build directory so a peer's `next build` cannot
 * empty it underneath the measurement, and proves the copy is one build rather than two halves.
 */
function pinRoutes(routes: readonly string[]): string {
  const pinned = mkdtempSync(join(tmpdir(), "phone-overflow-"));
  cpSync(join(OUT_DIR, "_next"), join(pinned, "_next"), { recursive: true });
  for (const dir of ["fonts", "search"]) {
    if (existsSync(join(OUT_DIR, dir))) {
      cpSync(join(OUT_DIR, dir), join(pinned, dir), { recursive: true });
    }
  }
  const buildIds = new Set<string>();
  for (const route of routes) {
    if (route === "/") {
      // Copying OUT_DIR itself would pull the whole build in behind the home page.
      cpSync(join(OUT_DIR, "index.html"), join(pinned, "index.html"));
    } else {
      cpSync(join(OUT_DIR, route), join(pinned, route), { recursive: true });
    }
    const html = readFileSync(join(pinned, route, "index.html"), "utf8");
    const id = /\\"b\\":\\"([^\\"]+)\\"/.exec(html)?.[1];
    assert.ok(
      id,
      `No Next build id found in ${route}; the copy cannot be checked for a mid-rebuild tear, so its measurements would be unverifiable.`,
    );
    buildIds.add(id);
  }
  assert.ok(
    buildIds.size <= 1,
    `The copied pages carry ${buildIds.size} different Next build ids (${[...buildIds].join(", ")}), so out/ was rebuilt during the copy and these pages are a mixture of two builds. Re-run; do not read the numbers.`,
  );
  return pinned;
}

/**
 * Three widths, not one. 320 is the narrowest viewport the lane matrix commits to and the one
 * `touch-320` in scripts/e2e/lanes.ts names; 360 is the commonest Android width; 390 is the
 * iPhone logical width. They are not interchangeable: /notation/ overflowed at all three, while
 * /lab/bm-03/ overflowed only at 320. A single width would have reported either as the other.
 */
const PHONE_WIDTHS = [320, 360, 390] as const;

/** Routes that must fit. Each was measured overflowing and was repaired; the cause is named. */
const MUST_FIT: readonly { readonly route: string; readonly why: string }[] = [
  {
    route: "/notation/",
    why: "entries-grid 1fr track blew out to 511.281px inside a 342px grid (unbreakable dotted quantity ids and a sha256), and modern-symbols-table had no scroll container",
  },
  {
    route: "/lab/me-02/",
    why: ".predict-mode-tabs was display:flex with no flex-wrap, so its buttons ran off the page at 320 and 360 while fitting at 390",
  },
  // A control that was never broken. If the harness ever stops measuring, this passes for the
  // same wrong reason as everything else, which is why the planted negative below exists too.
  { route: "/", why: "control: the home page fits and always has" },
];

/**
 * Routes measured overflowing at one or more phone widths, with the cause. Asserted to STILL
 * overflow, so a repair reports itself here instead of landing unnoticed.
 */
const KNOWN_OVERFLOWING: readonly { readonly route: string; readonly cause: string }[] = [
  {
    route: "/foundations/logarithms/",
    cause:
      "table.data-table is 453px inside a 358px block. .construction-table-wrap declares overflow-x:auto and computes VISIBLE, because src/components/foundations/foundations.css is imported by nothing and none of its 26 classes reach the built CSS",
  },
  {
    route: "/foundations/taylor-expansion/",
    cause: "same orphaned foundations.css as /foundations/logarithms/",
  },
  {
    route: "/lab/sr-01/",
    cause: "table.event-ledger is 410px wide with no scroll container",
  },
  {
    route: "/foundations/partial-derivatives/",
    cause: "same orphaned foundations.css; table.data-table 341px inside a 320px viewport",
  },
];

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
};

function startStaticServer(rootDir: string): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    const rawUrl = (req.url ?? "/").split("?")[0] ?? "/";
    let filePath = join(rootDir, decodeURIComponent(rawUrl));
    try {
      if (existsSync(filePath) && statSync(filePath).isDirectory()) {
        filePath = join(filePath, "index.html");
      }
    } catch {
      /* fall through to the 404 below */
    }
    if (!filePath.startsWith(rootDir) || !existsSync(filePath)) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(200, {
      "content-type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(readFileSync(filePath));
  });
  return new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      resolveServer({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

interface Measurement {
  readonly route: string;
  readonly width: number;
  readonly scrollWidth: number;
  readonly clientWidth: number;
  readonly overflows: boolean;
}

test("the layout viewport invariant holds at phone widths on the built site", async (t) => {
  const freshness = assertOutFreshness("out", REPO_ROOT);
  if (freshness.dirtyStaticSources && freshness.dirtyStaticSources.length > 0) {
    // Reported, never suppressed: out/ is the artefact, and a peer's unsaved edit is not in it.
    t.diagnostic(
      `out/ predates ${freshness.dirtyStaticSources.length} uncommitted static source(s); this measures the BUILT artefact, not the working tree`,
    );
  }

  const routes = [...MUST_FIT.map((r) => r.route), ...KNOWN_OVERFLOWING.map((r) => r.route)];
  // A gate over an empty population reports conformance it never established.
  assert.ok(
    routes.length >= 6,
    `Route set collapsed to ${routes.length}; this gate establishes nothing below 6 routes.`,
  );
  for (const route of routes) {
    assert.ok(
      existsSync(join(OUT_DIR, route, "index.html")),
      `Route ${route} is not in the build, so measuring it would prove nothing. Rebuild, or correct the route.`,
    );
  }

  const pinnedDir = pinRoutes(routes);
  const { server, origin } = await startStaticServer(pinnedDir);
  const browser = await chromium.launch();
  const measurements: Measurement[] = [];
  try {
    for (const width of PHONE_WIDTHS) {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      for (const route of routes) {
        const response = await page.goto(`${origin}${route}`, { waitUntil: "load" });
        assert.ok(
          response?.ok(),
          `${route} at ${width}px did not load (${response?.status()}); an unloaded page reports no overflow and would read as a pass.`,
        );
        await page.waitForTimeout(350);
        const measured = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        measurements.push({
          route,
          width,
          ...measured,
          overflows: measured.scrollWidth > measured.clientWidth,
        });
      }
      await context.close();
    }

    // The instrument must be able to fail. Without this, every assertion below is a claim about
    // a measurement that has never been observed going red on this page in this run.
    const plantContext = await browser.newContext({
      viewport: { width: 320, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const plantPage = await plantContext.newPage();
    await plantPage.goto(`${origin}/`, { waitUntil: "load" });
    const clean = await plantPage.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.equal(
      clean.scrollWidth,
      clean.clientWidth,
      "Planted negative needs a clean baseline on / at 320px before the plant means anything.",
    );
    await plantPage.evaluate(() => {
      const bar = document.createElement("div");
      bar.style.cssText = "width:900px;height:8px;";
      document.body.appendChild(bar);
    });
    await plantPage.waitForTimeout(200);
    const planted = await plantPage.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(
      planted.scrollWidth > planted.clientWidth,
      `PLANTED NEGATIVE DID NOT FIRE: a 900px block on a 320px viewport left scrollWidth ${planted.scrollWidth} vs clientWidth ${planted.clientWidth}. The measurement cannot detect overflow, so every other assertion in this file is vacuous.`,
    );
    await plantContext.close();
  } finally {
    await browser.close();
    server.close();
  }

  t.diagnostic(
    `measured ${measurements.length} route/width pairs (${routes.length} routes x ${PHONE_WIDTHS.length} widths: ${PHONE_WIDTHS.join(", ")}px)`,
  );
  assert.equal(
    measurements.length,
    routes.length * PHONE_WIDTHS.length,
    "Some route/width pairs were not measured; a partial sweep cannot establish the invariant.",
  );

  for (const entry of MUST_FIT) {
    for (const width of PHONE_WIDTHS) {
      const m = measurements.find((x) => x.route === entry.route && x.width === width);
      assert.ok(m, `No measurement for ${entry.route} at ${width}px.`);
      assert.equal(
        m.scrollWidth,
        m.clientWidth,
        `${entry.route} overflows at ${width}px: scrollWidth ${m.scrollWidth} vs clientWidth ${m.clientWidth} (+${m.scrollWidth - m.clientWidth}px). Was repaired for: ${entry.why}`,
      );
    }
  }

  for (const entry of KNOWN_OVERFLOWING) {
    const overflowing = measurements.filter((x) => x.route === entry.route && x.overflows);
    assert.ok(
      overflowing.length > 0,
      `${entry.route} no longer overflows at any of ${PHONE_WIDTHS.join(", ")}px. If you repaired it, MOVE IT to MUST_FIT in this file so the invariant is enforced instead of merely expected. Recorded cause: ${entry.cause}`,
    );
  }
});
