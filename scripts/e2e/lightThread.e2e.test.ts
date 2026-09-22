/**
 * Browser exercise of /lab/light-thread in Chromium AND WebKit (am-ahyb harness reuse).
 *
 * The route landed with unit tests and no browser or accessibility exercise at all.
 * This drives the claims the page makes about itself, in two engines, against the
 * production build. What it does NOT cover is listed at the end of this comment and
 * in the bead, because a lane that quietly tests a subset reads as a lane that tested
 * the whole thing.
 *
 * Exercised here:
 *  - the <noscript> claim, with JavaScript actually disabled: "The default worked
 *    example and all its numbers are readable without JavaScript";
 *  - "One accepted, instance-scoped snapshot supplies every displayed quantity",
 *    tested where it can fail: changing beta alone is an OBSERVER change, so the
 *    source-frame readings across table 1 must not move while the moving-frame
 *    readings in tables 2 and 3 do, and the invariant masses must stay put;
 *  - the refusal path: an out-of-bounds setting must raise the alert AND leave the
 *    last accepted worked example displayed, not blank it and not silently clamp;
 *  - the three .tableWrap scroll regions, measured at 320 and 1280.
 *
 * Not exercised: the physics itself (the reference evaluators own that and have their
 * own fixtures), the bookmark/popstate restore, the predict-mode details element, and
 * the print stylesheet.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = join(REPO_ROOT, "out");
const ROUTE = "/lab/light-thread/";

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function startStaticServer(): Promise<{ baseUrl: string; server: Server }> {
  const server = createServer((req, res) => {
    const requested = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    const direct = resolve(OUT_DIR, `.${requested}`);
    if (direct !== OUT_DIR && !direct.startsWith(`${OUT_DIR}/`)) {
      res.writeHead(400, { "content-type": CONTENT_TYPES[".txt"] as string });
      res.end("path escapes the build directory");
      return;
    }
    for (const candidate of [direct, `${direct}.html`, join(direct, "index.html")]) {
      if (existsSync(candidate) && !candidate.endsWith("/")) {
        try {
          const body = readFileSync(candidate);
          res.writeHead(200, {
            "content-type": CONTENT_TYPES[extname(candidate)] ?? "application/octet-stream",
          });
          res.end(body);
          return;
        } catch {
          // fall through
        }
      }
    }
    const notFound = join(OUT_DIR, "404.html");
    res.writeHead(404, { "content-type": CONTENT_TYPES[".html"] as string });
    res.end(existsSync(notFound) ? readFileSync(notFound) : Buffer.from("Not Found"));
  });
  return new Promise((done) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      done({ baseUrl: `http://127.0.0.1:${port}`, server });
    });
  });
}

const ENGINES = [
  { name: "chromium" as const, launcher: chromium },
  { name: "webkit" as const, launcher: webkit },
];

/** Every displayed quantity, keyed by its canonical id, as the reader sees it. */
async function readQuantities(page: import("playwright").Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const out: Record<string, string> = {};
    for (const node of document.querySelectorAll("[data-quantity-id]")) {
      out[node.getAttribute("data-quantity-id") ?? ""] = (node.textContent ?? "").trim();
    }
    return out;
  });
}

/**
 * Refuses rather than skips, and separates the two reasons the route can be
 * missing. A skip reports green forever on any machine where out/ happens to be
 * missing, which is how a stale assertion in this directory stayed invisible
 * until the node lane could finally start (am-ii21).
 *
 * Freshness first: a build behind HEAD is refused with its own message, so "the
 * route postdates the build" is answered by rebuilding rather than by passing.
 * If out/ is FRESH and the route is still absent, that is a real defect -
 * declaredRoutesBuilt.test.ts exists to catch exactly that - and it fails here
 * too rather than being waved through.
 */
function requireBuiltRoute(): void {
  assertOutFreshness();
  if (existsSync(join(OUT_DIR, "lab", "light-thread", "index.html"))) return;
  assert.fail(
    `${ROUTE} is not in out/, so what a reader meets cannot be checked. Run bun run build. ` +
      "This is not-available rather than a pass: out/ is fresh, so the route is genuinely " +
      "absent from the build rather than merely older than it.",
  );
}

test("light-thread: the worked example is readable with JavaScript disabled, in both engines", async (t) => {
  requireBuiltRoute();
  const { baseUrl, server } = await startStaticServer();
  try {
    for (const engine of ENGINES) {
      const browser = await engine.launcher.launch();
      try {
        // The page's own noscript claim: "The default worked example and all its
        // numbers are readable without JavaScript." Disabled for real, not emulated.
        const context = await browser.newContext({
          javaScriptEnabled: false,
          viewport: { width: 1280, height: 800 },
        });
        const page = await context.newPage();
        await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: "domcontentloaded", timeout: 20_000 });

        const quantities = await readQuantities(page);
        const ids = Object.keys(quantities);
        assert.ok(
          ids.length >= 17,
          `expected every declared quantity in the static HTML, found ${ids.length}: ${ids.join(", ")}`,
        );
        for (const [id, text] of Object.entries(quantities)) {
          assert.notEqual(text, "", `${id} rendered empty without JavaScript`);
        }

        // "all its numbers" means numbers, not placeholders.
        const unreadable = Object.entries(quantities).filter(
          ([, text]) => !/[0-9]/.test(text) || /NaN|undefined|—/.test(text),
        );
        assert.deepEqual(
          unreadable,
          [],
          `${engine.name}: these read as placeholders without JavaScript`,
        );

        const body = (await page.textContent("body")) ?? "";
        assert.ok(
          body.includes("Changing settings or restoring a bookmark requires JavaScript"),
          `${engine.name}: the no-script notice is not shown to a no-script reader`,
        );
        await context.close();
      } finally {
        await browser.close();
      }
    }
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }
});

test("light-thread: changing the observer moves the moving-frame readings and nothing else", async (t) => {
  requireBuiltRoute();
  const { baseUrl, server } = await startStaticServer();
  try {
    for (const engine of ENGINES) {
      const browser = await engine.launcher.launch();
      try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
        const page = await context.newPage();
        await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: "load", timeout: 20_000 });
        const form = page.locator("form[aria-label='Light-thread settings']");
        await form.locator("fieldset:not([disabled])").waitFor({ timeout: 10_000 });

        const before = await readQuantities(page);
        const versionBefore = await page.getAttribute(
          "[data-snapshot-version]",
          "data-snapshot-version",
        );

        // beta alone: an observer change. The emitted pulse is untouched, so the
        // source-frame readings must not move. This is the doctrine the page states
        // in its own words - "Changing only beta changes the observer, not the
        // emitted pulse" - and the only version of this check that can fail.
        await page.locator("input[name='beta']").fill("0.2");
        await page.getByRole("button", { name: "Apply settings" }).click();
        await page.waitForFunction(
          (previous) =>
            document
              .querySelector("[data-snapshot-version]")
              ?.getAttribute("data-snapshot-version") !== previous,
          versionBefore,
          { timeout: 10_000 },
        );
        const after = await readQuantities(page);

        const SOURCE_FRAME = [
          "frequencyStationary",
          "energyStationary",
          "quantumEnergyStationary",
          "quantumRatioStationary",
          "pulseEnergyEquivalent",
          "pulseInvariantMass",
          "pairEnergyStationary",
          "pairInvariantMass",
          "bodyMassLoss",
        ];
        const MOVING_FRAME = [
          "frequencyFactor",
          "energyFactor",
          "frequencyMoving",
          "energyMoving",
          "quantumEnergyMoving",
          "oppositePulseEnergyMoving",
          "pairEnergyMoving",
        ];
        // quantumRatioMoving is deliberately in NEITHER list. The page states that
        // E prime over h nu prime equals E over h nu "apart from numerical
        // rounding", so it is invariant in principle and may still move in its last
        // digit. Asserting either way would be asserting a rounding artefact.

        // Reachability before the claim: the readings this asserts about must exist,
        // or "nothing moved" would be true of a page that displays nothing.
        for (const id of [...SOURCE_FRAME, ...MOVING_FRAME]) {
          assert.ok(id in before, `${engine.name}: ${id} is not displayed, so this proves nothing`);
        }

        const movedThatShouldNot = SOURCE_FRAME.filter((id) => before[id] !== after[id]);
        assert.deepEqual(
          movedThatShouldNot,
          [],
          `${engine.name}: an observer change altered source-frame readings: ${movedThatShouldNot
            .map((id) => `${id} ${before[id]} -> ${after[id]}`)
            .join("; ")}`,
        );

        const stuckThatShouldMove = MOVING_FRAME.filter((id) => before[id] === after[id]);
        assert.deepEqual(
          stuckThatShouldMove,
          [],
          `${engine.name}: these moving-frame readings did not follow beta from 0.6 to 0.2: ${stuckThatShouldMove.join(", ")}`,
        );

        // Scoped to the laboratory: the page carries five polite live regions, four
        // of them global chrome (the search launcher, the notebook, the theme group
        // and one more), so an unscoped [role="status"] is ambiguous by five.
        const status = await page
          .locator("section.laboratory [role='status']")
          .first()
          .textContent();
        assert.ok(
          (status ?? "").includes("same accepted settings"),
          `${engine.name}: the polite announcement did not report the accepted change, got "${status}"`,
        );
        await context.close();
      } finally {
        await browser.close();
      }
    }
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }
});

test("light-thread: a refused setting alerts and leaves the accepted example displayed", async (t) => {
  requireBuiltRoute();
  const { baseUrl, server } = await startStaticServer();
  const refusalRoute: string[] = [];
  try {
    for (const engine of ENGINES) {
      const browser = await engine.launcher.launch();
      try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
        const page = await context.newPage();
        await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: "load", timeout: 20_000 });
        await page
          .locator("form[aria-label='Light-thread settings'] fieldset:not([disabled])")
          .waitFor({ timeout: 10_000 });

        const before = await readQuantities(page);
        const beta = page.locator("input[name='beta']");

        // Above the admission bound of 0.999999. The input also carries max, so the
        // browser's own validity check may intercept first; either way the reader
        // must not be shown stale numbers under a new label.
        await beta.fill("2");
        await page.getByRole("button", { name: "Apply settings" }).click();

        // THE INSTRUMENT MUST ANSWER, not the widget (am-fd1f). This assertion used
        // to accept either, because either was what happened: every control carries
        // min and max, so constraint validation ran first, the form never submitted,
        // and the reader was told "Value must be less than or equal to 0.999999" by
        // the browser in BOTH engines. The instrument's own sentence - "These are
        // this instrument's admission bounds" - was authored, unit-tested and
        // unreachable. AGENTS.md draws that line: the bounds are numerical admission
        // limits, not claims of physical impossibility, and a widget cannot say so.
        const alert = page.locator("section.laboratory [role='alert']").first();
        await alert.waitFor({ state: "visible", timeout: 10_000 });
        const refusalText = (await alert.textContent()) ?? "";
        assert.ok(
          refusalText.includes("admission bounds"),
          `${engine.name}: the page refused but not in the instrument's words, got "${refusalText}"`,
        );
        assert.ok(
          refusalText.includes("beta"),
          `${engine.name}: the refusal must name the setting it refused, got "${refusalText}"`,
        );

        // The control's protection is not traded away for the instrument's voice:
        // suppressing the native bubble does not make the form valid, so the value
        // must still never reach the model.
        const nativeMessage = await beta.evaluate(
          (node) => (node as HTMLInputElement).validationMessage,
        );
        assert.notEqual(
          nativeMessage,
          "",
          `${engine.name}: the control stopped enforcing the bound; the instrument speaking must not replace that`,
        );
        refusalRoute.push(`${engine.name}: "${refusalText.slice(0, 72)}"`);

        // The claim that matters either way: the last accepted worked example is
        // still on screen. A refusal that blanks the readings, or one that quietly
        // clamps and relabels, both fail here.
        const after = await readQuantities(page);
        assert.deepEqual(
          after,
          before,
          `${engine.name}: a refused setting changed the displayed readings`,
        );
        await context.close();
      } finally {
        await browser.close();
      }
    }
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }
  console.log(`light-thread refusal answered by:\n  ${refusalRoute.join("\n  ")}`);
  assert.equal(refusalRoute.length, 2, "both engines must have been asked");
});

test("light-thread planted negative: without the invalid handler the widget answers again", async (t) => {
  requireBuiltRoute();
  const { baseUrl, server } = await startStaticServer();
  try {
    for (const engine of ENGINES) {
      const browser = await engine.launcher.launch();
      try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
        const page = await context.newPage();

        // The wiring removed from the SHIPPED chunk, not from source: a source plant
        // is invisible to a test that reads out/, and rebuilding to plant is not
        // available here because the panes share one .next. Stripping `onInvalid:M,`
        // from the served bytes reproduces exactly the state am-fd1f recorded.
        const rewritten = { count: 0 };
        await page.route("**/_next/static/chunks/**/*.js", async (route) => {
          const response = await route.fetch();
          const body = await response.text();
          if (!body.includes("onInvalid:")) {
            await route.fulfill({ response, body });
            return;
          }
          rewritten.count += 1;
          await route.fulfill({
            response,
            body: body.replace(/onInvalid:[A-Za-z_$][\w$]*,/g, ""),
          });
        });

        await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: "load", timeout: 20_000 });
        await page
          .locator("form[aria-label='Light-thread settings'] fieldset:not([disabled])")
          .waitFor({ timeout: 10_000 });

        // Reachability before the claim: the rewrite must have hit something, or
        // "the instrument stays silent" is true of a plant that changed nothing.
        assert.ok(
          rewritten.count > 0,
          `${engine.name}: no served chunk carried an onInvalid binding, so this plant changed nothing`,
        );

        await page.locator("input[name='beta']").fill("2");
        await page.getByRole("button", { name: "Apply settings" }).click();

        const alerted = await page
          .locator("section.laboratory [role='alert']")
          .first()
          .isVisible()
          .catch(() => false);
        assert.equal(
          alerted,
          false,
          `${engine.name}: the instrument answered without its handler, so the assertion above is not testing the wiring`,
        );
        const nativeMessage = await page
          .locator("input[name='beta']")
          .evaluate((node) => (node as HTMLInputElement).validationMessage);
        assert.notEqual(
          nativeMessage,
          "",
          `${engine.name}: with the handler gone the browser must be the one answering`,
        );
        await context.close();
      } finally {
        await browser.close();
      }
    }
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }
});

test("light-thread: the three table-scroll regions, measured at 320 and 1280", async (t) => {
  requireBuiltRoute();
  const { baseUrl, server } = await startStaticServer();
  const report: string[] = [];
  try {
    for (const engine of ENGINES) {
      const browser = await engine.launcher.launch();
      try {
        for (const width of [320, 1280]) {
          const context = await browser.newContext({ viewport: { width, height: 900 } });
          const page = await context.newPage();
          await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: "load", timeout: 20_000 });
          const measured = await page.evaluate(() =>
            [...document.querySelectorAll("[class*='tableWrap']")].map((node) => ({
              caption: (node.querySelector("caption")?.textContent ?? "").trim().slice(0, 44),
              scrollWidth: node.scrollWidth,
              clientWidth: node.clientWidth,
              tabIndex: (node as HTMLElement).tabIndex,
            })),
          );

          // The measurement has to be real before any verdict is drawn from it.
          assert.ok(measured.length > 0, `${engine.name} @${width}: no tableWrap region found`);
          for (const region of measured) {
            assert.ok(
              region.clientWidth > 0,
              `${engine.name} @${width}: "${region.caption}" measured zero width, so its numbers mean nothing`,
            );
            report.push(
              `${engine.name} @${width}px "${region.caption}": ${region.scrollWidth}/${region.clientWidth}` +
                ` (${region.scrollWidth > region.clientWidth ? "OVERFLOWS" : "fits"}, tabIndex ${region.tabIndex})`,
            );
          }
          await context.close();
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }

  // Reported, not asserted. The .tableWrap class is unregistered in the
  // scrollable-regions ratchet and pane30 holds that item; a second assertion here
  // would be a second owner for one defect. These numbers are the evidence it needs.
  console.log(`light-thread tableWrap measurements:\n  ${report.join("\n  ")}`);
  assert.equal(report.length, 12, "expected 3 regions x 2 viewports x 2 engines");
});
