/**
 * Browser acceptance for the extracted chrome, palette, error boundaries and Open Graph
 * route, in Chromium AND WebKit, against the production build (am-ahyb).
 *
 * This is the one acceptance criterion of `am-scaf-extract-ui-components-c31` that its
 * own code work could not settle: "The theme toggle, command palette shell, error
 * boundaries, and Open Graph route work on the empty site in Chromium and WebKit."
 *
 * Two engines, not one. A criterion naming Chromium and WebKit is not met by a
 * Chromium-only pass, so every check runs on both and each engine reports separately.
 * If an engine cannot launch on this host it is recorded `not-available` with the
 * reason it gave; it never counts as a pass and never disappears into the other lane.
 *
 * Against the built output in `out/`, not a dev server, and not a hand-written fixture:
 * the network check exists precisely to see what a real browser requests at run time,
 * including anything a framework or font pipeline adds after the build.
 * `src/testing/thirdPartyRequests.test.ts` already scans `src/`, `public/` and `out/`
 * statically; this is the half that static scanning cannot do.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { type Browser, chromium, webkit } from "playwright";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";
import {
  appendUiExtractionLog,
  newUiExtractionLogRunId,
} from "../../src/testing/uiExtractionLogging.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = join(REPO_ROOT, "out");
const LOG_RUN_ID = newUiExtractionLogRunId();
const EVIDENCE_DIR = join(
  REPO_ROOT,
  "artifacts",
  "test-logs",
  "ui-extraction",
  LOG_RUN_ID,
  "evidence",
);
const VIEWPORT = { width: 1280, height: 800 } as const;

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

/** PNG magic bytes. The artefact's own identity, independent of any header. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * The two planted defects, served as separate routes rather than written into `out/`.
 *
 * A plant that edits the build directory would race every other pane and could be left
 * behind by a crash. These are the same bytes as the home page with one thing changed,
 * so a check that fails here and passes at `/` has isolated that one thing.
 */
const PLANT_REMOTE_SCRIPT = "/__plant__/remote-script/";
const PLANT_BROKEN_ESCAPE = "/__plant__/broken-escape/";

function homeHtml(): string {
  return readFileSync(join(OUT_DIR, "index.html"), "utf8");
}

function resolveWithinOut(requestPath: string): string | undefined {
  const decoded = decodeURIComponent(requestPath.split("?")[0] ?? "/");
  const candidate = resolve(OUT_DIR, `.${decoded}`);
  if (candidate !== OUT_DIR && !candidate.startsWith(`${OUT_DIR}/`)) return undefined;
  return candidate;
}

/**
 * Serves `out/` the way a static host does, including the part that matters for the
 * error-boundary check: an unknown path answers 404 with the built not-found page,
 * rather than 200 with a soft "not found" body.
 */
function startStaticServer(): Promise<{ baseUrl: string; server: Server }> {
  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === PLANT_REMOTE_SCRIPT || url === PLANT_BROKEN_ESCAPE) {
      const body =
        url === PLANT_REMOTE_SCRIPT
          ? homeHtml().replace(
              "</head>",
              '<script src="https://cdn.example.invalid/tracker.js"></script></head>',
            )
          : homeHtml().replace(/Escape/g, "NoSuchKey");
      res.writeHead(200, { "content-type": CONTENT_TYPES[".html"] as string });
      res.end(body);
      return;
    }

    const direct = resolveWithinOut(url);
    if (direct === undefined) {
      res.writeHead(400, { "content-type": CONTENT_TYPES[".txt"] as string });
      res.end("path escapes the build directory");
      return;
    }
    for (const candidate of [direct, `${direct}.html`, join(direct, "index.html")]) {
      if (existsSync(candidate) && !candidate.endsWith("/")) {
        try {
          const body = readFileSync(candidate);
          const ext = extname(candidate);
          res.writeHead(200, {
            "content-type":
              CONTENT_TYPES[ext] ??
              (body.subarray(0, 8).equals(PNG_SIGNATURE)
                ? "image/png"
                : "application/octet-stream"),
          });
          res.end(body);
          return;
        } catch {
          // fall through to the not-found branch
        }
      }
    }
    const notFoundPage = join(OUT_DIR, "404.html");
    const body = existsSync(notFoundPage) ? readFileSync(notFoundPage) : Buffer.from("Not Found");
    res.writeHead(404, { "content-type": CONTENT_TYPES[".html"] as string });
    res.end(body);
  });
  return new Promise((resolveStart) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      resolveStart({ baseUrl: `http://127.0.0.1:${port}`, server });
    });
  });
}

export interface CheckOutcome {
  readonly check: string;
  readonly ok: boolean;
  readonly message: string;
}

/** Everything a failed check needs for someone to see what the browser saw. */
async function retainEvidence(
  browserName: string,
  check: string,
  page: import("playwright").Page,
  consoleLines: readonly string[],
  requests: readonly string[],
): Promise<string> {
  const dir = join(EVIDENCE_DIR, `${browserName}-${check}`);
  mkdirSync(dir, { recursive: true });
  try {
    await page.screenshot({ path: join(dir, "screenshot.png"), fullPage: true });
    writeFileSync(join(dir, "dom.html"), await page.content(), "utf8");
  } catch (error) {
    writeFileSync(join(dir, "capture-error.txt"), String(error), "utf8");
  }
  writeFileSync(join(dir, "console.log"), consoleLines.join("\n"), "utf8");
  writeFileSync(join(dir, "network.log"), requests.join("\n"), "utf8");
  return dir;
}

async function runChecks(
  browserName: "chromium" | "webkit",
  browser: Browser,
  baseUrl: string,
  options: {
    /** Installed before the first navigation; used to plant a defect in a built asset. */
    readonly prepare?: (page: import("playwright").Page) => Promise<void>;
    /** Distinguishes a plant's entries from the real run's in the same log. */
    readonly logPrefix?: string;
  } = {},
): Promise<CheckOutcome[]> {
  const context = await browser.newContext({ viewport: { ...VIEWPORT } });
  const page = await context.newPage();
  if (options.prepare) await options.prepare(page);
  const consoleLines: string[] = [];
  const requests: string[] = [];
  page.on("console", (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
  page.on("request", (r) => requests.push(r.url()));
  const results: CheckOutcome[] = [];

  const record = async (check: string, run: () => Promise<string>): Promise<void> => {
    const started = performance.now();
    let outcome: CheckOutcome;
    let evidence: string | undefined;
    try {
      outcome = { check, ok: true, message: await run() };
    } catch (error) {
      outcome = {
        check,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
      evidence = await retainEvidence(browserName, check, page, consoleLines, requests);
    }
    results.push(outcome);
    appendUiExtractionLog({
      logRunId: LOG_RUN_ID,
      testId: `am-ahyb/${options.logPrefix ?? ""}${check}`,
      outcome: outcome.ok ? "pass" : "fail",
      durationMs: performance.now() - started,
      message: outcome.message,
      browser: browserName,
      viewport: `${VIEWPORT.width}x${VIEWPORT.height}`,
      jsEnabled: true,
      ...(evidence ? { evidence } : {}),
    });
  };

  // 1. The theme toggle switches AND survives a reload. Two transitions, so the check
  //    cannot pass because the page already sat on the expected theme.
  await record("theme-toggle", async () => {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
    // PORTED FROM THE THREE-RADIO FIELDSET, which 884dfc19 replaced with one switch. The old
    // selector was `fieldset.theme-toggle` and matched nothing from 09:52 onward, so these
    // assertions were red in a lane nobody was running. The property is unchanged: the control
    // must switch the theme, and the theme must survive a reload.
    const control = page.locator('button[role="switch"].theme-switch').first();
    if ((await control.count()) === 0) {
      throw new Error('no button[role="switch"].theme-switch on the built page');
    }
    const read = () => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    const before = await read();

    // Press the CONTROL, which is what a reader presses. The old note here is worth keeping
    // because the reasoning survives the change of control and the measurement does not: driving
    // an input directly is not the same action as activating the affordance, and in WebKit the
    // radio inputs measured 0 x 12 CSS pixels against 13 x 13 in Chromium, so Playwright refused
    // to click them as not visible. That is why the old check clicked the label rather than the
    // input. A switch has no inner input to be tempted by - the button IS the affordance - so the
    // hazard is gone rather than handled, and am-8w0x's zero-area risk is now checked directly on
    // the switch's own parts in the two-engine test below.
    const press = async (expected: string): Promise<void> => {
      await control.click({ timeout: 10_000 });
      await page.waitForFunction(
        (want) => document.documentElement.getAttribute("data-theme") === want,
        expected,
        { timeout: 5000 },
      );
    };

    // TWO TRANSITIONS, DERIVED FROM THE STARTING STATE RATHER THAN ASSUMED. The radio version
    // could name the theme it wanted; a switch only toggles, so pressing it twice from an unknown
    // start is the only way to prove it moves in both directions. Naming a fixed first target
    // would pass whenever the page happened to start on the other one, which is exactly the
    // "cannot pass because the page already sat there" property the original was protecting.
    const DARK = "kramgasse-night";
    const LIGHT = "annalen";
    const start = before === DARK ? DARK : LIGHT;
    const other = start === DARK ? LIGHT : DARK;
    await press(other);
    await press(start);
    // A third press only when the start was light, so the reload check always runs against dark.
    if (start !== DARK) await press(DARK);
    await page.reload({ waitUntil: "domcontentloaded" });
    const afterReload = await read();
    if (afterReload !== DARK) {
      throw new Error(`theme did not persist across reload: expected ${DARK}, got ${afterReload}`);
    }
    return `started ${before ?? "unset"}, toggled to ${other} and back to ${start}, and held ${DARK} across a reload`;
  });

  // 2. The palette opens on the keyboard shortcut and Escape closes it with focus
  //    restored. See the test below this function for why this currently fails.
  await record("command-palette", async () => {
    // The opener is an ANCHOR, a.search-launcher with aria-haspopup="dialog",
    // rendered by SearchLauncher in src/app/layout.tsx. My first version looked
    // for [data-command-palette-trigger] or button[aria-label*="search"], which
    // this component has never carried, and reported "no page mounts it" in both
    // engines - a selector failure wearing the clothes of a product gap. It is
    // the defect class this repository has been sweeping all week and I wrote a
    // fresh instance of it. The selector below is the element the layout renders.
    await page.goto(baseUrl, { waitUntil: "load", timeout: 20_000 });
    const opener = page.locator("a.search-launcher[aria-haspopup='dialog']").first();
    if ((await opener.count()) === 0) {
      throw new Error("no a.search-launcher[aria-haspopup='dialog'] on the built page");
    }
    await opener.focus();
    // launcher.ts accepts either modifier; the engine's platform decides which a
    // reader presses, and both must reach the same handler.
    await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
    const dialog = page.locator("dialog[open], [role='dialog']").first();
    await dialog.waitFor({ state: "visible", timeout: 10_000 });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden", timeout: 10_000 });
    const focusReturned = await page.evaluate(() => {
      const active = document.activeElement;
      return active?.classList.contains("search-launcher") === true;
    });
    if (!focusReturned) {
      const where = await page.evaluate(() => {
        const a = document.activeElement;
        return a === null ? "null" : `${a.tagName.toLowerCase()}.${a.className || "(no class)"}`;
      });
      throw new Error(`Escape closed the palette but focus went to ${where}, not the opener`);
    }
    return "the shortcut opened the palette, Escape closed it, focus returned to a.search-launcher";
  });

  // 3. A nonexistent route is a 404 WITH the not-found page, not a soft 200.
  await record("not-found-404", async () => {
    const response = await page.goto(`${baseUrl}/no-such-route-am-ahyb/`, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
    const status = response?.status();
    if (status !== 404) throw new Error(`expected HTTP 404, got ${String(status)}`);
    const text = (await page.textContent("body")) ?? "";
    if (!/not found|404/i.test(text)) {
      throw new Error("404 status without a not-found page body");
    }
    return "HTTP 404 with the built not-found page";
  });

  // 4. The Open Graph route returns an image. The BYTES are the site's responsibility
  //    and the header is the host's, so both are checked and named separately: in a
  //    static export the content type comes from whatever serves the file.
  await record("open-graph-image", async () => {
    const response = await page.request.get(`${baseUrl}/opengraph-image`);
    if (!response.ok()) throw new Error(`opengraph-image returned HTTP ${response.status()}`);
    const body = await response.body();
    if (!body.subarray(0, 8).equals(PNG_SIGNATURE)) {
      throw new Error(
        `opengraph-image is not a PNG; first bytes ${body.subarray(0, 8).toString("hex")}`,
      );
    }
    const type = response.headers()["content-type"] ?? "";
    if (!type.startsWith("image/")) throw new Error(`content-type was ${type || "absent"}`);
    return `${body.length} bytes, PNG signature, served as ${type}`;
  });

  // 5. What the browser actually requests. The static scan cannot see a font or a
  //    framework chunk fetched at run time; this can.
  await record("no-third-party-requests", async () => {
    requests.length = 0;
    await page.goto(baseUrl, { waitUntil: "load", timeout: 20_000 });
    const foreign = requests.filter((url) => {
      if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("about:"))
        return false;
      return !url.startsWith(baseUrl);
    });
    if (foreign.length > 0) {
      throw new Error(`requests to another origin: ${[...new Set(foreign)].join(", ")}`);
    }
    return `${requests.length} requests, all to the page's own origin`;
  });

  await context.close();
  return results;
}

/** Runs the planted defects and returns which checks each one broke. */
async function runPlant(browser: Browser, baseUrl: string, plantPath: string): Promise<string[]> {
  const context = await browser.newContext({ viewport: { ...VIEWPORT } });
  const page = await context.newPage();
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  const broken: string[] = [];

  await page.goto(`${baseUrl}${plantPath}`, { waitUntil: "load", timeout: 20_000 });
  const foreign = requests.filter(
    (url) => !url.startsWith(baseUrl) && !url.startsWith("data:") && !url.startsWith("blob:"),
  );
  if (foreign.length > 0) broken.push("no-third-party-requests");

  const control = page.locator('button[role="switch"].theme-switch').first();
  if ((await control.count()) === 0) {
    broken.push("theme-toggle");
  } else {
    try {
      // A REACHABILITY CONTROL: the clean page must break nothing, so a target that cannot be
      // found reports "theme-toggle" as broken on every run and the control that proves the plant
      // is doing the work stops working. It was left naming "Slate" when that theme was removed,
      // and it was left on `fieldset.theme-toggle` when 884dfc19 replaced the radios with this
      // switch - twice now, by two different people, and both times only the call site would have
      // said so, because this file skips when out/ is absent.
      //
      // Pressed until dark rather than once. A switch toggles, so a single press from an unknown
      // starting theme reaches dark only half the time, and a probe that is right half the time
      // reports the plant broken on the other half.
      const dark = () =>
        page.waitForFunction(
          () => document.documentElement.getAttribute("data-theme") === "kramgasse-night",
          undefined,
          { timeout: 3000 },
        );
      await control.click({ timeout: 5000 });
      try {
        await dark();
      } catch {
        await control.click({ timeout: 5000 });
        await dark();
      }
    } catch {
      broken.push("theme-toggle");
    }
  }

  await context.close();
  return broken;
}

const ENGINES = [
  { name: "chromium" as const, launcher: chromium },
  { name: "webkit" as const, launcher: webkit },
];

test("am-ahyb: the five extracted-chrome checks, in both engines, against the built site", async (t) => {
  // Freshness before existence, as in the three guards below: a stale out/ fails
  // here rather than logging an absence that did not happen.
  assertOutFreshness();
  if (!existsSync(join(OUT_DIR, "index.html"))) {
    appendUiExtractionLog({
      logRunId: LOG_RUN_ID,
      testId: "am-ahyb/build",
      outcome: "not-available",
      durationMs: 0,
      message: "out/index.html is absent; run bun run build before this lane",
      jsEnabled: true,
    });
    assert.fail(
      "out/index.html is absent, so what a reader meets cannot be checked. Run bun run build. " +
        "This is not-available rather than a pass: a missing artefact is not evidence, and a " +
        "skip here reports green forever on any machine where out/ happens to be missing.",
    );
    return;
  }

  const { baseUrl, server } = await startStaticServer();
  const perEngine = new Map<string, CheckOutcome[]>();
  const unavailable: string[] = [];

  try {
    for (const engine of ENGINES) {
      let browser: Browser;
      try {
        browser = await engine.launcher.launch();
      } catch (error) {
        // Criterion: a lane that cannot run reports not-available WITH THE REASON.
        // It is not folded into the other engine's result and it is not a pass.
        const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
        unavailable.push(`${engine.name}: ${reason}`);
        appendUiExtractionLog({
          logRunId: LOG_RUN_ID,
          testId: "am-ahyb/launch",
          outcome: "not-available",
          durationMs: 0,
          message: `${engine.name} could not launch: ${reason}`,
          browser: engine.name,
          jsEnabled: true,
        });
        continue;
      }
      try {
        perEngine.set(engine.name, await runChecks(engine.name, browser, baseUrl));
      } finally {
        await browser.close();
      }
    }
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }

  // Both engines must have RUN. A criterion naming two engines is not met by one, so a
  // missing engine fails here rather than quietly leaving a single-engine pass behind.
  assert.deepEqual(
    unavailable,
    [],
    `these engines could not run, so the two-engine criterion is unmet:\n${unavailable.join("\n")}`,
  );

  const failures: string[] = [];
  for (const [engineName, outcomes] of perEngine) {
    for (const outcome of outcomes) {
      if (!outcome.ok) failures.push(`${engineName}/${outcome.check}: ${outcome.message}`);
    }
  }
  assert.deepEqual(
    failures,
    [],
    `checks failed on the built site:\n${failures.join("\n")}\n` +
      `Evidence under artifacts/test-logs/ui-extraction/${LOG_RUN_ID}/evidence/.`,
  );
});

/**
 * Removes the palette's keyboard shortcut from the built chunk that binds it.
 *
 * TWO PLANTS FAILED TO FAIL BEFORE THIS ONE, and the reason is worth keeping.
 *
 * The bead asks for "a removed Escape handler fails the palette check only". I
 * wrote that first: rewriting the chunk's `"Escape"!==e.key` guard, which is the
 * handler at CommandPalette.ts:298, changed nothing observable in either engine.
 * Then I targeted focus restoration, `o.focus({preventScroll:!0})` from
 * CommandPalette.ts:146, and that changed nothing either. Both rewrites hit real
 * chunks - the counters proved it - and the palette check stayed green.
 *
 * The cause is the platform. The palette is a native `<dialog>` opened with
 * `showModal()` at CommandPalette.ts:349, so the browser closes it on Escape and
 * returns focus to the element that was focused when it opened, whether or not
 * any script asks. The product's own Escape and focus code is belt and braces
 * over behaviour the platform already guarantees.
 *
 * That is a real limit on what the criterion's Escape clause can prove, and it is
 * reported rather than papered over. What IS the product's alone is the shortcut:
 * `"k"!==e.key.toLowerCase()` in the layout chunk, bound by launcher.ts with no
 * platform fallback. Remove it and the palette cannot open at all.
 *
 * Returns how many responses were rewritten, because a plant that matched nothing
 * would leave every check green and read as proof of robustness.
 */
function breakPaletteShortcut(rewritten: { count: number }) {
  const TARGET = '"k"!==e.key.toLowerCase()';
  return async (page: import("playwright").Page): Promise<void> => {
    await page.route("**/_next/static/chunks/**/*.js", async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (!body.includes(TARGET)) {
        await route.fulfill({ response, body });
        return;
      }
      rewritten.count += 1;
      await route.fulfill({
        response,
        body: body.split(TARGET).join('"am-ahyb-no-such-key"!==e.key.toLowerCase()'),
      });
    });
  };
}

test("am-8w0x: every part of the theme switch has area in both engines", async (t) => {
  // Freshness first, then existence, the convention germanSourceVisible.e2e.test.ts
  // and declaredRoutesBuilt.test.ts already use: an out/ that exists but is 119
  // commits behind is the other way this file goes green for the wrong reason.
  assertOutFreshness();
  if (!existsSync(join(OUT_DIR, "index.html"))) {
    assert.fail(
      "out/index.html is absent, so what a reader meets cannot be checked. Run bun run build. " +
        "This is not-available rather than a pass: a missing artefact is not evidence, and a " +
        "skip here reports green forever on any machine where out/ happens to be missing.",
    );
    return;
  }
  const { baseUrl, server } = await startStaticServer();
  const report: string[] = [];
  /** What each engine saw, compared across engines after the loop. */
  const seen: { engine: string; labels: string[] }[] = [];
  try {
    for (const engine of ENGINES) {
      const browser = await engine.launcher.launch();
      try {
        const context = await browser.newContext({ viewport: { ...VIEWPORT } });
        const page = await context.newPage();
        await page.goto(baseUrl, { waitUntil: "load", timeout: 20_000 });
        // PORTED FROM THE RADIOS (884dfc19). The old query was
        // `fieldset.theme-toggle input` and returned an empty list from 09:52 onward, which the
        // guard below correctly refuses - but only in a lane nobody was running.
        //
        // The subject is unchanged and is NOT "four things are the same size". am-8w0x was
        // WebKit collapsing a control to zero width while Chromium drew it at 13x13, so the
        // property is that every part of the control HAS AREA, in every engine. A switch has
        // three parts a reader depends on - the pressable button, the track it moves along, and
        // the knob that shows which end it is at - and any of them at zero is the same defect.
        const boxes = await page.evaluate(() => {
          const parts = [
            ["switch", 'button[role="switch"].theme-switch'],
            ["track", ".theme-switch-track"],
            ["knob", ".theme-switch-knob"],
          ] as const;
          const out: { label: string; width: number; height: number }[] = [];
          for (const [label, selector] of parts) {
            const el = document.querySelector(selector);
            if (!el) continue;
            const rect = el.getBoundingClientRect();
            out.push({
              label,
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            });
          }
          return out;
        });

        // REACHABILITY BEFORE ANY CLAIM, kept verbatim in spirit from the radio version because
        // it is the guard that matters most: "every part has area" is true of an empty list and
        // of a page that renders no control at all. The old assertion was `=== 4` and went red
        // the day the themes were consolidated (am-r3qt), which is why a cardinality is not
        // written here either - the parts are named below instead, so this cannot silently pass
        // on a page that dropped one of them.
        assert.ok(
          boxes.length > 0,
          `${engine.name}: no part of the theme switch found at all. "Every part has area" is true of an empty list, so this is the empty-population failure rather than a pass.`,
        );
        assert.deepEqual(
          boxes.map((box) => box.label).sort(),
          ["knob", "switch", "track"],
          `${engine.name}: the switch is missing a part. Found ${JSON.stringify(boxes.map((b) => b.label))}. The knob is the state cue and the track is what it moves along; a control missing either renders as something a reader cannot read a state from.`,
        );
        seen.push({ engine: engine.name, labels: boxes.map((box) => box.label) });
        for (const box of boxes) {
          report.push(`${engine.name} "${box.label}": ${box.width}x${box.height}`);
        }

        // AREA, PART BY PART. The radio version compared four instances of one control for equal
        // size; there is one control now, so that comparison has no population and asserting it
        // would be vacuous. What survives is the defect am-8w0x actually was: WebKit collapsed a
        // control to zero width while Chromium drew it at 13x13. Zero area is unclickable and,
        // for the knob, unreadable - it is the cue that says which end the switch is at.
        for (const box of boxes) {
          assert.ok(
            box.width > 0 && box.height > 0,
            `${engine.name}: the switch's ${box.label} rendered ${box.width}x${box.height}, so it has no area. globals.css once sized every theme input at width:100% with min-width:0, which collapsed them to nothing in WebKit and stretched them in Chromium (am-8w0x).`,
          );
        }
        await context.close();
      } finally {
        await browser.close();
      }
    }
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }

  // BOTH ENGINES SAW THE SAME CONTROL. A disagreement here is the defect am-8w0x is about, and
  // it cannot be satisfied by finding nothing in both, because the per-engine guard above already
  // refused that.
  //
  // What is compared is WHICH PARTS each engine found, not their pixel sizes. Cross-engine pixel
  // equality would be a stricter claim than am-8w0x supports and a flaky one: the two engines
  // round and lay out text differently, so a passing run would depend on font metrics. The
  // defect was a part with NO area, which is asserted per engine above where it can name the
  // part that vanished.
  assert.equal(
    seen.length,
    ENGINES.length,
    `only ${seen.length} of ${ENGINES.length} engines reported the theme switch`,
  );
  const [first, ...rest] = seen;
  assert.ok(first, "no engine reported");
  for (const other of rest) {
    assert.deepEqual(
      [...other.labels].sort(),
      [...first.labels].sort(),
      `the engines disagree on which parts of the theme switch exist: ${first.engine} ${JSON.stringify(first.labels)} vs ${other.engine} ${JSON.stringify(other.labels)}.`,
    );
  }

  console.log(
    `theme switch parts (${first.labels.length} per engine, agreed across ${seen.length}):\n  ${report.join("\n  ")}`,
  );
});

test("am-ahyb planted negative: removing the shortcut fails the palette check only", async (t) => {
  // Freshness first, then existence, the convention germanSourceVisible.e2e.test.ts
  // and declaredRoutesBuilt.test.ts already use: an out/ that exists but is 119
  // commits behind is the other way this file goes green for the wrong reason.
  assertOutFreshness();
  if (!existsSync(join(OUT_DIR, "index.html"))) {
    assert.fail(
      "out/index.html is absent, so what a reader meets cannot be checked. Run bun run build. " +
        "This is not-available rather than a pass: a missing artefact is not evidence, and a " +
        "skip here reports green forever on any machine where out/ happens to be missing.",
    );
    return;
  }
  const { baseUrl, server } = await startStaticServer();
  try {
    for (const engine of ENGINES) {
      const browser = await engine.launcher.launch();
      try {
        const rewritten = { count: 0 };
        const outcomes = await runChecks(engine.name, browser, baseUrl, {
          prepare: breakPaletteShortcut(rewritten),
          logPrefix: "plant-no-shortcut/",
        });

        // Reachability, before any claim about what the plant proves: the rewrite
        // has to have hit something. Zero rewrites with everything still passing
        // would look exactly like "removing the handler is harmless".
        assert.ok(
          rewritten.count > 0,
          `${engine.name}: no built chunk contained the shortcut guard, so this plant changed nothing`,
        );

        const failed = outcomes.filter((o) => !o.ok).map((o) => o.check);
        assert.deepEqual(
          failed,
          ["command-palette"],
          `${engine.name}: removing the shortcut must fail the palette check and only that one`,
        );
        const palette = outcomes.find((o) => o.check === "command-palette");
        assert.ok(
          palette?.message.includes("Timeout") || palette?.message.includes("visible"),
          `${engine.name}: the failure must be the dialog never appearing, not some other breakage: ${palette?.message}`,
        );
      } finally {
        await browser.close();
      }
    }
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }
});

test("am-ahyb planted negative: a remote script breaks the network check and nothing else", async (t) => {
  // Freshness first, then existence, the convention germanSourceVisible.e2e.test.ts
  // and declaredRoutesBuilt.test.ts already use: an out/ that exists but is 119
  // commits behind is the other way this file goes green for the wrong reason.
  assertOutFreshness();
  if (!existsSync(join(OUT_DIR, "index.html"))) {
    assert.fail(
      "out/index.html is absent, so what a reader meets cannot be checked. Run bun run build. " +
        "This is not-available rather than a pass: a missing artefact is not evidence, and a " +
        "skip here reports green forever on any machine where out/ happens to be missing.",
    );
    return;
  }
  const { baseUrl, server } = await startStaticServer();
  try {
    for (const engine of ENGINES) {
      let browser: Browser;
      try {
        browser = await engine.launcher.launch();
      } catch (error) {
        assert.fail(
          `${engine.name} could not launch, so this plant is unproven there: ${String(error).split("\n")[0]}`,
        );
      }
      try {
        // Reachability first: the clean page must break nothing, or "only the network
        // check broke" would be true of a plant that changed nothing at all.
        const clean = await runPlant(browser, baseUrl, "/");
        assert.deepEqual(
          clean,
          [],
          `${engine.name}: the unplanted page already fails ${clean.join(", ")}`,
        );

        const broken = await runPlant(browser, baseUrl, PLANT_REMOTE_SCRIPT);
        assert.deepEqual(
          broken,
          ["no-third-party-requests"],
          `${engine.name}: a remote script must fail the network check and only that one`,
        );
      } finally {
        await browser.close();
      }
    }
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }
});
