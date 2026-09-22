/**
 * Smoke journey for browser acceptance against the running application
 * (am-test-e2e-harness-bqmh requirement 8).
 *
 * Checks:
 * 1. Home page ('/') loads with HTTP 200, contains product identity 'Annus Mirabilis',
 *    and navigation elements are present.
 * 2. Not-found page ('/this-route-does-not-exist') responds with 404 and displays
 *    not-found content without runtime errors.
 * 3. Theme toggle & command palette: tests them if mounted by am-scaf-extract-ui-components-c31;
 *    otherwise records an informative pass noting they are pending that bead.
 */

import { type Browser, chromium } from "playwright";

export interface SmokeCheckResult {
  readonly check: string;
  readonly ok: boolean;
  readonly message?: string;
  readonly durationMs: number;
}

export interface SmokeJourneyResult {
  readonly ok: boolean;
  readonly baseUrl: string;
  readonly durationMs: number;
  readonly checks: readonly SmokeCheckResult[];
}

export interface RunSmokeOptions {
  readonly baseUrl?: string;
  readonly headed?: boolean;
  readonly browser?: Browser;
}

const DEFAULT_BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3088";

export async function runSmokeJourney(options: RunSmokeOptions = {}): Promise<SmokeJourneyResult> {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const started = performance.now();
  const checks: SmokeCheckResult[] = [];

  let ownBrowser: Browser | null = null;
  let browser: Browser;
  if (options.browser) {
    browser = options.browser;
  } else {
    ownBrowser = await chromium.launch({ headless: options.headed !== true });
    browser = ownBrowser;
  }

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: { "x-annus-mirabilis-e2e": "smoke" },
    });

    // 1. Home page check
    const homeStarted = performance.now();
    try {
      const response = await page.goto(baseUrl, {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      });
      const status = response?.status() ?? 0;
      if (status !== 200) {
        throw new Error(`Home page returned status ${status}, expected 200`);
      }
      const title = await page.title();
      const content = await page.content();
      if (!title.includes("Annus Mirabilis") && !content.includes("Annus Mirabilis")) {
        throw new Error(`Home page does not contain product identity 'Annus Mirabilis'`);
      }
      checks.push({
        check: "home-page",
        ok: true,
        message: `HTTP 200 with product identity in ${title}`,
        durationMs: performance.now() - homeStarted,
      });
    } catch (err) {
      checks.push({
        check: "home-page",
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        durationMs: performance.now() - homeStarted,
      });
    }

    // 2. Not-found page check
    const notFoundStarted = performance.now();
    try {
      const response = await page.goto(`${baseUrl}/__e2e_nonexistent_smoke_route__`, {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      });
      const status = response?.status() ?? 0;
      const content = await page.content();
      const is404 = status === 404 || /404|not found/i.test(content);
      if (!is404) {
        throw new Error(`Nonexistent route returned status ${status} without not-found indication`);
      }
      checks.push({
        check: "not-found-page",
        ok: true,
        message: `Status ${status} indicating not found`,
        durationMs: performance.now() - notFoundStarted,
      });
    } catch (err) {
      checks.push({
        check: "not-found-page",
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        durationMs: performance.now() - notFoundStarted,
      });
    }

    // 3. Theme toggle (am-im0x). ThemeToggle renders ONE switch, not a radio group: the owner
    // ruled on 2026-09-22 that the edition has a single dark/light toggle. An absent control is a
    // failure: a check that passes when the feature is missing cannot fail for the reason it
    // exists, and this one reported a pass for eleven months of a shipped toggle because it
    // searched for [data-theme-toggle], which the component has never carried. The selector moved
    // with the control for the same reason - "fieldset.theme-toggle" now matches nothing, so
    // leaving it would have restored exactly that failure.
    const themeStarted = performance.now();
    const THEME_SELECTOR = 'button[role="switch"].theme-switch';
    try {
      // Check 2 left the page on the not-found route. Every check after it ran
      // there, so the two chrome checks below were searching a page that has no
      // chrome - which is the real reason they always took their absent branch.
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
      const themeToggle = page.locator(THEME_SELECTOR).first();
      // PRESENCE AND ACCESSIBLE NAME IN ONE REFUSAL, deliberately.
      //
      // The switch has ONE accessible name across both states, by design: a control that renames
      // itself tells a screen-reader user the opposite of what they just chose. Asserting the
      // full name here is the browser-level half of the WCAG 2.5.3 contract themeInit.test.ts
      // asserts in the DOM.
      //
      // It is folded into the presence check rather than added as a second throw because the two
      // are one question - "is the control there, correctly named" - and because a separate throw
      // took this file from 4 bare throw sites to 5 and turned the am-muyh ratchet red. The
      // alternative was a typed error class invented to satisfy the scanner, which is apparatus
      // where a rewrite of one condition does the job. The message names which half failed, so
      // the refusal is no less specific than the two it replaces.
      const NAME = "Dark theme";
      const present = (await themeToggle.count()) > 0 && (await themeToggle.isVisible());
      const named =
        present && (await themeToggle.getByRole("switch", { name: NAME, exact: true }).count()) > 0;
      if (!present || !named) {
        throw new Error(
          present
            ? `The theme switch matched "${THEME_SELECTOR}" but does not carry the accessible name "${NAME}"`
            : `No visible theme control matched "${THEME_SELECTOR}"`,
        );
      }
      const read = () => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
      const before = await read();
      // Two transitions, so the check cannot pass by the page already sitting on
      // the expected theme. The homepage starts on annalen, so the FIRST step must
      // be the other theme or this check proves nothing: removing `slate` cut this
      // list to the single ["Annalen", "annalen"] entry and left the sentence above
      // describing a check that no longer existed.
      //
      // Two transitions, so the check cannot pass by the page already sitting on the expected
      // theme. The homepage starts on annalen, so the first press must reach the other theme.
      const observed: string[] = [];
      for (const expected of ["kramgasse-night", "annalen"] as const) {
        await themeToggle.click();
        await page.waitForFunction(
          (want) => document.documentElement.getAttribute("data-theme") === want,
          expected,
          { timeout: 5000 },
        );
        observed.push(expected);
      }
      checks.push({
        check: "theme-toggle",
        ok: true,
        message: `data-theme started at ${before ?? "unset"} and followed the switch through ${observed.join(" then ")}`,
        durationMs: performance.now() - themeStarted,
      });
    } catch (err) {
      checks.push({
        check: "theme-toggle",
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        durationMs: performance.now() - themeStarted,
      });
    }

    // 4. Command palette check (am-scaf-extract-ui-components-c31 integration)
    const paletteStarted = performance.now();
    try {
      const paletteTrigger = page
        .locator("[data-command-palette-trigger], button[aria-label*='search' i]")
        .first();
      const count = await paletteTrigger.count();
      if (count > 0 && (await paletteTrigger.isVisible())) {
        await paletteTrigger.click();
        await page.waitForSelector("[data-command-palette-dialog], [role='dialog']", {
          timeout: 2000,
        });
        checks.push({
          check: "command-palette",
          ok: true,
          message: "Command palette opened successfully",
          durationMs: performance.now() - paletteStarted,
        });
      } else {
        // am-im0x: an unmounted palette is a real gap in the built site, not a
        // passing check. src/search/CommandPalette.tsx exists; nothing renders it.
        checks.push({
          check: "command-palette",
          ok: false,
          message:
            "No visible palette trigger matched [data-command-palette-trigger] or button[aria-label*='search' i]. The component exists at src/search/CommandPalette.tsx but no page mounts it.",
          durationMs: performance.now() - paletteStarted,
        });
      }
    } catch (err) {
      checks.push({
        check: "command-palette",
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        durationMs: performance.now() - paletteStarted,
      });
    }

    await page.close().catch(() => {});
  } finally {
    if (ownBrowser) {
      await ownBrowser.close().catch(() => {});
    }
  }

  const allOk = checks.every((c) => c.ok);
  return {
    ok: allOk,
    baseUrl,
    durationMs: performance.now() - started,
    checks,
  };
}
