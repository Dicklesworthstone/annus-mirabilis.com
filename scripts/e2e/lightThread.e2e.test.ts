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
import { chromium, type Route, webkit } from "playwright";
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
        // THE SETTING IS NAMED WITH THE GREEK GLYPH, WHICH IS CORRECT COPY (am-enpr). This read
        // `includes("beta")` and could never match: the refusal says "The observer speed β must be
        // between −0.999999 and 0.999999. These are this instrument's admission bounds." AGENTS.md
        // asks reader-facing text to prefer the paper's own notation, and the control is labelled β,
        // so the ASCII spelling would be the wrong thing to require. Both forms are accepted because
        // the claim being made is that the refusal NAMES the setting it refused, not which alphabet
        // it names it in; the "admission bounds" assertion above already pins the wording.
        assert.ok(
          /β|beta/i.test(refusalText),
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

/**
 * THE PLANTED NEGATIVE FOR am-fd1f, AND WHY IT TAKES THREE CASES RATHER THAN ONE.
 *
 * The assertion this guards is that the INSTRUMENT answers an out-of-bounds setting, in its
 * own authored sentence, rather than the browser answering with "Value must be less than or
 * equal to 0.999999". Two independent things make that true, and a plant that removes either
 * one alone proves nothing, because the other still delivers the sentence:
 *
 *   - the form carries `noValidate`, so constraint validation never intercepts the submit and
 *     the submit handler runs the evaluator;
 *   - every control carries `onInvalid`, so if validity IS ever reported the handler suppresses
 *     the native bubble and routes the refusal through the same evaluator.
 *
 * THE PREVIOUS VERSION OF THIS TEST STRIPPED `onInvalid` ALONE AND ASSERTED NO REFUSAL APPEARED.
 * That is false of this design and the test was red for 49 of its runs while nothing it protects
 * was broken: with `noValidate` on the form, `onInvalid` is not in the submit path at all, so
 * removing it cannot stop the instrument answering. The red was additionally unreadable, because
 * the plant's own regex -- `onInvalid:IDENT,` -- assumed a minified shape, and a plant that fails
 * to land produces exactly the same red as the defect it is hunting.
 *
 * So each guard is removed alone, where the instrument must STILL answer, and then both together,
 * where the browser must take over. The third case is am-fd1f reproduced: the state in which the
 * authored sentence was unit-tested and unreachable. Six observations, two engines by three cases,
 * and each case prints what it removed from the served bytes before any verdict is read.
 */
test("light-thread planted negative: the instrument's voice needs both guards, and without them the browser answers", async (t) => {
  requireBuiltRoute();
  const { baseUrl, server } = await startStaticServer();
  /**
   * Renaming cannot miss on the shape of a value, which deleting it did. Each guard names every
   * spelling it is served under: `noValidate` reaches the browser through the DOCUMENT -- the
   * payload carries it camelCased, and renaming the chunk's copy alone leaves the form with its
   * attribute -- while `onInvalid` is bound in the chunk and keeps its colon, because the bare word
   * also names React's own event registry and renaming that consistently would leave the handler
   * firing under a new name.
   */
  // THE REPLACEMENT MUST NOT CONTAIN THE TOKEN, which is why each is a one-letter substitution
  // rather than a suffix. Renaming `noValidate` to `noValidateRemovedByThePlant` leaves the token as
  // a substring of its own replacement, so the "did any survive" count below counted every rename as
  // a survivor and the plant refused itself. Same length, first letter changed, nothing else moves.
  const GUARDS = {
    noValidate: [
      ["noValidate", "zoValidate"],
      ["novalidate", "zovalidate"],
    ],
    onInvalid: [["onInvalid:", "znInvalid:"]],
  } as const;
  const CASES = [
    { name: "noValidate stripped", strip: ["noValidate"], answers: "instrument" },
    { name: "onInvalid stripped", strip: ["onInvalid"], answers: "instrument" },
    { name: "both stripped", strip: ["noValidate", "onInvalid"], answers: "browser" },
  ] as const;
  const observed: string[] = [];
  try {
    for (const engine of ENGINES) {
      const browser = await engine.launcher.launch();
      try {
        for (const probe of CASES) {
          const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
          const page = await context.newPage();
          // The wiring removed from the SHIPPED chunk, not from source: a source plant is
          // invisible to a test that reads out/, and rebuilding to plant is not available
          // here because the panes share one .next.
          const edit = { files: 0, removed: 0, survived: 0 };
          const rewrite = async (route: Route) => {
            const response = await route.fetch();
            const body = await response.text();
            let served = body;
            let removed = 0;
            for (const key of probe.strip)
              for (const [token, renamed] of GUARDS[key]) {
                removed += served.split(token).length - 1;
                served = served.replaceAll(token, renamed);
              }
            if (removed === 0) {
              await route.fulfill({ response, body });
              return;
            }
            edit.files += 1;
            edit.removed += removed;
            for (const key of probe.strip)
              for (const [token] of GUARDS[key]) edit.survived += served.split(token).length - 1;
            await route.fulfill({ response, body: served });
          };
          // The DOCUMENT as well as the chunks. This test rewrote only the chunks and could
          // therefore never remove noValidate at all, which is half of why it was red.
          await page.route(`**${ROUTE}`, rewrite);
          await page.route("**/_next/static/chunks/**/*.js", rewrite);

          await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: "load", timeout: 20_000 });
          await page
            .locator("form[aria-label='Light-thread settings'] fieldset:not([disabled])")
            .waitFor({ timeout: 10_000 });

          // REACHABILITY BEFORE THE CLAIM, on the bytes that were SERVED rather than on the
          // bytes that were inspected. A chunk that merely contained the token, and that the
          // rewrite then failed to change, used to satisfy this.
          assert.ok(
            edit.removed > 0,
            `${engine.name}/${probe.name}: no served chunk carried ${probe.strip.join(" or ")}, so this plant changed nothing`,
          );
          assert.equal(
            edit.survived,
            0,
            `${engine.name}/${probe.name}: ${edit.survived} binding(s) survived the rewrite across ${edit.files} chunk(s), so the page may still have its guard`,
          );

          await page.locator("input[name='beta']").fill("2");
          await page.getByRole("button", { name: "Apply settings" }).click();

          // The instrument's own sentence, by its words rather than by any element being
          // present: the browser's bubble is not in the DOM at all, so "an alert exists" and
          // "the instrument answered" are different questions.
          const instrumentSpoke = await page
            .locator("section.laboratory [role='alert']")
            .filter({ hasText: /admission bounds/ })
            .count();
          observed.push(
            `${engine.name}/${probe.name}: removed ${edit.removed} binding(s) from ${edit.files} chunk(s); instrument sentence ${instrumentSpoke > 0 ? "shown" : "absent"}`,
          );
          if (probe.answers === "instrument") {
            assert.ok(
              instrumentSpoke > 0,
              `${engine.name}/${probe.name}: the other guard must still deliver the instrument's sentence; removing one is not meant to silence it`,
            );
          } else {
            assert.equal(
              instrumentSpoke,
              0,
              `${engine.name}/${probe.name}: with neither guard the instrument cannot be the one answering, so the assertion in the refusal test is not testing them`,
            );
          }

          // In every case the control itself still refuses the value, so none of this trades
          // the bound away: the plant removes who SAYS so, never what is enforced.
          const nativeMessage = await page
            .locator("input[name='beta']")
            .evaluate((node) => (node as HTMLInputElement).validationMessage);
          assert.notEqual(
            nativeMessage,
            "",
            `${engine.name}/${probe.name}: the control stopped enforcing the bound`,
          );
          await context.close();
        }
      } finally {
        await browser.close();
      }
    }
    // The denominator, printed: three cases in each of two engines, none skipped.
    assert.equal(observed.length, ENGINES.length * CASES.length, "every case must have been run");
    t.diagnostic(observed.join(" | "));
    console.log(`light-thread guard plants:\n  ${observed.join("\n  ")}`);
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
