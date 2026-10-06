import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { chromium } from "playwright";
import { checkOutFreshness } from "../outFreshness.ts";

/**
 * WITHOUT JAVASCRIPT, NO VISIBLE CONTROL IS STILL CLICKABLE AND DEAD (am-nojs-dead-controls-3agt).
 *
 * AGENTS.md: "No-JavaScript readers get real links, never hydration-dependent buttons." The bead measured 166
 * such buttons on /papers/brownian-motion/s4/ and 73 on relativity §3 in 2026-09-24, and the repair landed in
 * two parts that are both in the tree now: `NOSCRIPT_CONTROLS_CSS`, a `button:enabled{display:none!important}`
 * rule the root layout puts in a head `<noscript>`, and components that render a hydration-only control
 * DISABLED so it stays visible and readable as the legend it replaces.
 *
 * What was missing is this: the bead's third criterion, a Playwright check in both modes with a planted
 * hydration-only button. Without it the 0 is a measurement somebody took once.
 *
 * THE PREDICATE IS `:enabled`, NOT THE `.disabled` PROPERTY, and that distinction is the whole reason this
 * file reads the way it does. Measured 2026-10-06 against the built export: reading `button.disabled` reported
 * FIFTEEN dead controls across these ten routes - eight "Step n = 0..5" and two axis choices on Brownian §4,
 * two speed presets and two "Restore" buttons on mass-energy. Every one of them sits inside a
 * `<fieldset disabled>`, so it is `:disabled` in CSS, it is unclickable in the browser, and the noscript rule
 * is right not to hide it - while its own `.disabled` property is `false`, because the attribute is on the
 * fieldset. The property reading invented fifteen findings that were already inert. With `:enabled` the count
 * is 0 on all ten routes.
 *
 * That is the shape AGENTS.md records as a count whose population is not the one being described, and it is
 * worth the paragraph because the wrong instrument here does not under-report: it manufactures work.
 */

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

/** The pages the bead names: four paper pages, three section pages, three laboratories. */
const ROUTES = [
  "/papers/brownian-motion/",
  "/papers/special-relativity/",
  "/papers/light-quanta/",
  "/papers/mass-energy/",
  "/papers/brownian-motion/s4/",
  "/papers/special-relativity/s3/",
  "/papers/light-quanta/s1/",
  "/lab/bm-01/",
  "/lab/sr-03/",
  "/lab/lq-08/",
];

/**
 * A control a reader can press that nothing can answer.
 *
 * `:enabled` for the reason in the docblock. A button inside a form is still counted: no form on this site has
 * an action, so submitting one does nothing either, and excluding them would be excusing the same defect by
 * where it sits. A declarative button - `popovertarget`, `command`, `commandfor` - DOES work with scripting
 * off and is excluded by kind rather than by guess.
 */
const COUNT_DEAD_CONTROLS_BODY = `() => {
  const dead = [];
  for (const b of document.querySelectorAll("button, input[type=button], input[type=submit]")) {
    if (!b.matches(":enabled")) continue;
    if (b.hasAttribute("popovertarget") || b.hasAttribute("command") || b.hasAttribute("commandfor")) continue;
    const cs = getComputedStyle(b);
    const r = b.getBoundingClientRect();
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    if (r.width === 0 || r.height === 0) continue;
    dead.push({
      cls: b.getAttribute("class") ?? "",
      text: (b.textContent ?? "").trim().slice(0, 60),
    });
  }
  return dead;
}`;

/**
 * Called, not merely evaluated.
 *
 * `page.evaluate(string)` treats its argument as an EXPRESSION, so passing the arrow function's source returned
 * the function itself and every assertion read `undefined.length`. The invocation is explicit here so the next
 * reader does not have to rediscover it.
 */
const COUNT_DEAD_CONTROLS = `(${COUNT_DEAD_CONTROLS_BODY})()`;

function serveOut() {
  const root = resolve("out");
  const server = createServer(async (req, res) => {
    let file = resolve(
      root,
      `.${decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname)}`,
    );
    if ((await stat(file).catch(() => null))?.isDirectory()) file = resolve(file, "index.html");
    try {
      res.setHeader("Content-Type", MIME_TYPES[extname(file)] ?? "application/octet-stream");
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  return server;
}

async function withServer(run) {
  const server = serveOut();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
  }
}

/** One JSONL line per route, with the AGENTS.md fields that apply here. */
async function writeLog(logRunId, rows) {
  const dir = join("artifacts", "test-logs", "nojs-controls");
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, `${logRunId}.jsonl`),
    `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`,
    "utf8",
  );
  return join(dir, `${logRunId}.jsonl`);
}

describe("no-JavaScript controls (am-nojs-dead-controls-3agt)", () => {
  test("PLANTED: a hydration-only button is flagged, and a disabled one beside it is not", async () => {
    // Through the real predicate, on a page built for the purpose, so the plant cannot be swept into a peer's
    // commit. Four arms: the dead button must be caught; a disabled button must not; a button inside a
    // DISABLED FIELDSET must not, which is the fifteen false positives in one assertion; and a hidden one must
    // not, since a reader cannot press what is not shown.
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.setContent(`
        <button type="button" id="dead">Press me and nothing happens</button>
        <button type="button" disabled>Disabled on purpose</button>
        <fieldset disabled><button type="button">Inside a disabled fieldset</button></fieldset>
        <button type="button" style="display:none">Hidden</button>
      `);
      const found = await page.evaluate(COUNT_DEAD_CONTROLS);
      assert.equal(
        found.length,
        1,
        `expected only the planted button, got ${JSON.stringify(found)}`,
      );
      assert.match(found[0].text, /nothing happens/);
      await context.close();
    } finally {
      await browser.close();
    }
  });

  test("with JavaScript off, no route shows an enabled control, and the count is logged", async (t) => {
    const freshness = checkOutFreshness("out");
    if (!freshness.present) {
      t.skip("out/ is not present; this check reads the built export");
      return;
    }
    assert.ok(freshness.fresh, `out/ is STALE: ${freshness.reason}`);

    const logRunId = `${new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15)}Z-nojs`;
    const rows = [];
    const offenders = [];
    let buttonsSeen = 0;

    await withServer(async (url) => {
      const browser = await chromium.launch();
      try {
        const context = await browser.newContext({
          javaScriptEnabled: false,
          viewport: { width: 1280, height: 900 },
        });
        for (const route of ROUTES) {
          const page = await context.newPage();
          await page.goto(url + route, { waitUntil: "load" });
          const dead = await page.evaluate(COUNT_DEAD_CONTROLS);
          const total = await page.locator("button").count();
          buttonsSeen += total;
          rows.push({
            timestamp: new Date().toISOString(),
            suite: "nojs-controls",
            logRunId,
            testId: `nojs-dead-controls${route.replace(/\//g, "-")}`,
            beadId: "am-nojs-dead-controls-3agt",
            anchor: route,
            expected: 0,
            actual: dead.length,
            outcome: dead.length === 0 ? "passed" : "failed",
            browser: "chromium",
            viewport: "1280x900",
            jsEnabled: false,
            message:
              dead.length === 0
                ? `${total} buttons on the page, none enabled and visible without scripts`
                : `${dead.length} enabled visible control(s): ${dead.map((d) => d.text).join(" | ")}`,
          });
          for (const d of dead) offenders.push(`${route} ${JSON.stringify(d.text)} [${d.cls}]`);
          await page.close();
        }
        await context.close();
      } finally {
        await browser.close();
      }
    });

    const logPath = await writeLog(logRunId, rows);
    console.log(
      `[nojs controls] ${ROUTES.length} routes, ${buttonsSeen} buttons rendered, ${offenders.length} enabled and visible without scripts; log ${logPath}`,
    );
    // Non-vacuity before the verdict: a harness that served 404s, or a selector that matched nothing, would
    // report zero offenders and read exactly like a clean result. The bead's own measurement found 416 buttons
    // on Brownian §4 alone, so a floor of 500 across ten routes is well inside what a real build renders.
    assert.ok(buttonsSeen > 500, `only ${buttonsSeen} buttons seen across ${ROUTES.length} routes`);
    assert.deepEqual(
      offenders,
      [],
      `enabled dead controls without JavaScript:\n${offenders.join("\n")}`,
    );
  });

  test("with JavaScript on, those controls become enabled, so the rule is not hiding them for ever", async (t) => {
    // The other half of the bead's criterion 2. Without it, deleting every control would pass the check above.
    // Brownian §4 is the page the bead names and the one with the largest population.
    const freshness = checkOutFreshness("out");
    if (!freshness.present) {
      t.skip("out/ is not present; this check reads the built export");
      return;
    }
    await withServer(async (url) => {
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await page.goto(`${url}/papers/brownian-motion/s4/`, { waitUntil: "load" });
        // Hydration is what enables them; the reader root says when it has happened.
        await page.locator("[data-reader-root][data-enhanced='true']").waitFor({ timeout: 20000 });
        const enabled = await page.evaluate(COUNT_DEAD_CONTROLS);
        console.log(
          `[nojs controls] with JavaScript on, Brownian s4 shows ${enabled.length} enabled visible controls`,
        );
        // They are no longer dead: the same predicate that found 0 with scripts off finds many with scripts on.
        assert.ok(
          enabled.length > 50,
          `only ${enabled.length} controls became enabled after hydration; the noscript rule may be hiding them permanently`,
        );
      } finally {
        await browser.close();
      }
    });
  });
});
