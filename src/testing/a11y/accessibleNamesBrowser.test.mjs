import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import { describe, test } from "node:test";
import { chromium } from "playwright";
import { checkOutFreshness } from "../outFreshness.ts";

/**
 * Acceptance test for accessible names across form controls (am-qt1j).
 *
 * AC1: No <label> in src/ contains a <select>, <textarea>, or value-bearing <input>.
 * AC2: For at least one control per affected component, the computed accessible name
 *      equals the visible label text exactly, verified in a real browser against out/.
 * AC3: scripts/test-trajectory-browser.mjs passes end to end.
 * AC4: getByLabel(..., { exact: true }) stays exact without relaxation.
 */

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
};

describe("browser accessible-name verification (am-qt1j)", () => {
  test("planted negative: nested controls corrupt exact accessible-name resolution", async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(`
        <div class="good">
          <label for="good-ctrl">Time unit</label>
          <select id="good-ctrl"><option>s</option><option>ms</option></select>
        </div>
        <div class="bad">
          <label for="bad-ctrl">Nested unit
            <select id="bad-ctrl"><option>s</option><option>ms</option></select>
          </label>
        </div>
      `);

      // Unnested control resolves with exact: true and is not nested inside label
      const good = page.getByLabel("Time unit", { exact: true });
      assert.equal(await good.count(), 1);
      assert.equal(await good.evaluate((el) => el.closest("label")), null);

      // Planted negative: nested select inside label fails exact accessible name resolution
      const badExact = page.getByLabel("Nested unit", { exact: true });
      assert.equal(
        await badExact.count(),
        0,
        "Planted negative: nested select must corrupt exact label match",
      );
      const badElement = page.locator("#bad-ctrl");
      assert.notEqual(
        await badElement.evaluate((el) => el.closest("label")),
        null,
        "Planted negative: bad control is inside label",
      );
    } finally {
      await browser.close();
    }
  });

  test("computed accessible name equals visible label exactly across 29 affected components in out/", async (t) => {
    const freshness = checkOutFreshness("out");
    if (!freshness.present) {
      t.skip("out/ directory not present; skipping static build checks");
      return;
    }
    if (!freshness.fresh) {
      assert.fail(`Static build directory "out" is STALE: ${freshness.reason}`);
    }

    const root = resolve("out");

    const server = createServer(async (req, res) => {
      let file = resolve(
        root,
        `.${decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname)}`,
      );
      if ((await stat(file).catch(() => null))?.isDirectory()) {
        file = resolve(file, "index.html");
      }
      try {
        res.setHeader("Content-Type", MIME_TYPES[extname(file)] ?? "application/octet-stream");
        res.end(await readFile(file));
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    await new Promise((resolveListening) => server.listen(0, "127.0.0.1", resolveListening));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const url = `http://127.0.0.1:${address.port}`;

    const targets = [
      { route: "/lab/brownian-data/", label: "Time unit" },
      { route: "/lab/brownian-data/", label: "Position unit" },
      { route: "/lab/brownian-data/", label: "Or paste CSV text" },
      { route: "/lab/bm-01/", label: "Signed coordinate" },
      { route: "/lab/bm-01/", label: "Coordinates in the total distance" },
      { route: "/lab/bm-01/", label: "Statistic to compare over time" },
      { route: "/lab/bm-01/", label: "Trial seed (unsigned 64-bit integer)" },
      { route: "/lab/bm-05/", label: "Step law" },
      { route: "/lab/bm-05/", label: "Observe after (whole steps)" },
      { route: "/lab/bm-05/", label: "Trial seed (unsigned 64-bit integer)" },
      { route: "/lab/bm-07/", label: "Which displacements" },
      { route: "/lab/bm-07/", label: "Observed coordinates" },
      { route: "/lab/bm-07/", label: "Molecular-number interval" },
      { route: "/lab/bm-08/", label: "Frame spacing (s)" },
      { route: "/lab/bm-08/", label: "Observed coordinates" },
      { route: "/lab/bm-08/", label: "Pair-interval noise procedure" },
      { route: "/lab/lq-03/", label: "Horizontal coordinate" },
      { route: "/lab/lq-03/", label: "Axis scale" },
      { route: "/lab/lq-03/", label: "Density convention" },
      { route: "/lab/sr-04/", label: "Frame speed v (fraction of c, |v/c| ≤ 0.95)" },
      { route: "/lab/sr-06/", label: "Frame speed v/c" },
      { route: "/lab/sr-06/", label: "Moving-frame speed w/c" },
      { route: "/lab/sr-11/", label: "Mirror velocity β = v/c" },
      { route: "/lab/sr-11/", label: "Description frame" },
      { route: "/lab/sr-13/", label: "Initial speed β = v/c" },
      { route: "/lab/sr-13/", label: "Force convention" },
      { route: "/lab/sr-13/", label: "Mass language" },
      { route: "/lab/sr-13/", label: "Historical dataset overlay" },
      { route: "/papers/brownian-motion/", label: "Passage detail" },
    ];

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      let currentRoute = "";
      for (const target of targets) {
        if (target.route !== currentRoute) {
          await page.goto(`${url}${target.route}`);
          currentRoute = target.route;
          // Instruments keep their advanced controls in a closed "Experiment settings" drawer
          // (ad178896 onward). A label inside a closed <details> is not rendered, so its
          // innerText is "" and the visible-text check below would compare nothing. Open every
          // drawer first, as a reader would, then check the label and name really match.
          const opened = await page.$$eval("details.experiment-settings", (drawers) => {
            for (const d of drawers) d.open = true;
            return drawers.length;
          });
          if (opened > 0) await page.waitForTimeout(50);
        }
        const locator = page.getByLabel(target.label, { exact: true });
        const count = await locator.count();
        assert.ok(
          count >= 1,
          `Expected control with exact label "${target.label}" on ${target.route}, found ${count}`,
        );
        const element = locator.first();
        const isNested = await element.evaluate((el) => el.closest("label") !== null);
        assert.equal(
          isNested,
          false,
          `Control with label "${target.label}" on ${target.route} is nested inside <label>`,
        );
        const visibleText = await element.evaluate(
          (el) => el.labels?.[0]?.innerText?.trim() ?? el.labels?.[0]?.textContent?.trim(),
        );
        assert.equal(
          visibleText,
          target.label,
          `Visible label text mismatch for control "${target.label}" on ${target.route}`,
        );
      }
    } finally {
      await browser.close();
      await new Promise((resolveClose) => server.close(resolveClose));
    }
  });
});
