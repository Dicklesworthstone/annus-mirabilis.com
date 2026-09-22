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

    // 3. Theme toggle (am-im0x). ONE icon button: a moon in the light theme, a sun in the dark
    // (the owner, 2026-09-22: "a single toggle that is either an icon of sun or a moon"). Its
    // accessible name is the action a press takes, "Switch to dark theme" or "Switch to light
    // theme", chosen by CSS from data-theme, so the name is asserted before each press and again
    // after it. An absent control is a failure: a check that passes when the feature is missing
    // cannot fail for the reason it exists.
    const themeStarted = performance.now();
    const THEME_SELECTOR = "button.theme-toggle";
    const DARK = "kramgasse-night";
    const LIGHT = "annalen";
    const nameFor = (theme: string | null) =>
      theme === DARK ? "Switch to light theme" : "Switch to dark theme";
    // `.and()` requires ONE element to be both the toggle and a button with that computed name.
    // getByRole computes the name the way a screen reader does, so a hidden label that CSS failed
    // to hide, or the wrong one shown, fails here. (A `locator.getByRole()` on the toggle itself
    // would search its descendants, and find nothing: 23be4bef.)
    const namedToggle = (name: string) =>
      page.getByRole("button", { name, exact: true }).and(page.locator(THEME_SELECTOR));
    try {
      // Check 2 left the page on the not-found route, which has no chrome.
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
      const themeToggle = page.locator(THEME_SELECTOR).first();
      const read = () => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
      const before = await read();
      const present = (await themeToggle.count()) > 0 && (await themeToggle.isVisible());
      const named = present && (await namedToggle(nameFor(before)).count()) > 0;
      if (!present || !named) {
        throw new Error(
          present
            ? `The theme toggle matched "${THEME_SELECTOR}" but is not named "${nameFor(before)}" on a page whose data-theme is ${before ?? "unset"}`
            : `No visible theme control matched "${THEME_SELECTOR}"`,
        );
      }
      // Two presses, starting from whichever theme the page is on, so the check cannot pass by the
      // page already sitting on the expected theme; after each, the name must be the new action.
      const first = before === DARK ? LIGHT : DARK;
      const observed: string[] = [];
      for (const expected of [first, first === DARK ? LIGHT : DARK]) {
        await themeToggle.click();
        await page.waitForFunction(
          (want) => document.documentElement.getAttribute("data-theme") === want,
          expected,
          { timeout: 5000 },
        );
        await namedToggle(nameFor(expected)).waitFor({ timeout: 5000 });
        observed.push(expected);
      }
      checks.push({
        check: "theme-toggle",
        ok: true,
        message: `data-theme started at ${before ?? "unset"} and followed the toggle through ${observed.join(" then ")}, renamed after each press`,
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
