/**
 * The eleven browser-acceptance lanes (am-test-e2e-harness-bqmh requirement
 * 2): desktop, tablet, a 320px touch viewport, a real WebKit lane, keyboard
 * only, reduced motion, two high-zoom variants, no WebGL, JavaScript
 * disabled, and print.
 *
 * Lane definitions are plain data with a structural shape, not
 * `@playwright/test` `Project` objects: `@playwright/test` (the test
 * runner) is not yet a dependency of this repository (see
 * src/testing/log/playwright.ts), only the browser-automation library
 * `playwright`. A real `playwright.config.ts` maps each `LaneDefinition`
 * below onto a Playwright project once that dependency decision is made;
 * until then, this module's pure validators and `createLaneActions` are
 * exercised directly with fixed fixtures.
 */

import { type Browser, type BrowserContext, chromium, type Page, webkit } from "playwright";

export type BrowserEngine = "chromium" | "webkit" | "firefox";

export interface LaneViewport {
  readonly width: number;
  readonly height: number;
}

export interface LaneDefinition {
  readonly name: string;
  readonly description: string;
  readonly browser: BrowserEngine;
  readonly viewport: LaneViewport;
  readonly deviceScaleFactor?: number;
  readonly hasTouch?: boolean;
  readonly isMobile?: boolean;
  readonly reducedMotion?: "reduce" | "no-preference";
  readonly javaScriptEnabled?: boolean;
  readonly keyboardOnly?: boolean;
  readonly disableWebGL?: boolean;
  /** Chromium launch args backing `disableWebGL`; present only when it is true. */
  readonly chromiumArgs?: readonly string[];
  /** A stylesheet injected before content loads (the `text-200` lane's WCAG 1.4.4 reflow case). */
  readonly injectedStylesheet?: string;
  readonly media?: "screen" | "print";
}

const DESKTOP_VIEWPORT: LaneViewport = { width: 1440, height: 900 };

/** Matches PAPER_E2E_VIEWPORTS.phone in scripts/e2e/paper-e2e-contract.ts: 320 CSS px wide. */
const TOUCH_320_VIEWPORT: LaneViewport = { width: 320, height: 800 };

const WEBGL_DISABLING_CHROMIUM_ARGS = [
  "--disable-3d-apis",
  "--disable-webgl",
  "--disable-webgl2",
] as const;

const TEXT_200_STYLESHEET = "html { font-size: 200% !important; }";

export const LANES: readonly LaneDefinition[] = Object.freeze([
  {
    name: "desktop",
    description: "Desktop Chromium at 1440x900.",
    browser: "chromium",
    viewport: DESKTOP_VIEWPORT,
  },
  {
    name: "tablet",
    description: "Tablet WebKit at 768x1024 with touch.",
    browser: "webkit",
    viewport: { width: 768, height: 1024 },
    hasTouch: true,
  },
  {
    name: "touch-320",
    description: "Chromium mobile emulation with touch, exactly 320 CSS pixels wide.",
    browser: "chromium",
    viewport: TOUCH_320_VIEWPORT,
    hasTouch: true,
    isMobile: true,
  },
  {
    name: "webkit-real",
    description: "A real WebKit/Safari lane at 1280x800.",
    browser: "webkit",
    viewport: { width: 1280, height: 800 },
  },
  {
    name: "keyboard-only",
    description: "Desktop Chromium; actions only through the keyboard, focus order asserted.",
    browser: "chromium",
    viewport: DESKTOP_VIEWPORT,
    keyboardOnly: true,
  },
  {
    name: "reduced-motion",
    description: "Desktop Chromium with reducedMotion: reduce.",
    browser: "chromium",
    viewport: DESKTOP_VIEWPORT,
    reducedMotion: "reduce",
  },
  {
    name: "zoom-400",
    description: "320x256 CSS pixels at device scale factor 4 (the WCAG reflow case).",
    browser: "chromium",
    viewport: { width: 320, height: 256 },
    deviceScaleFactor: 4,
  },
  {
    name: "text-200",
    description: "Desktop Chromium with the root font size doubled by an injected stylesheet.",
    browser: "chromium",
    viewport: DESKTOP_VIEWPORT,
    injectedStylesheet: TEXT_200_STYLESHEET,
  },
  {
    name: "no-webgl",
    description: "Chromium with 3D APIs disabled; getContext('webgl'/'webgl2') must return null.",
    browser: "chromium",
    viewport: DESKTOP_VIEWPORT,
    disableWebGL: true,
    chromiumArgs: WEBGL_DISABLING_CHROMIUM_ARGS,
  },
  {
    name: "js-disabled",
    description:
      "Desktop Chromium with JavaScript disabled; reading checks run against the rendered document.",
    browser: "chromium",
    viewport: DESKTOP_VIEWPORT,
    javaScriptEnabled: false,
  },
  {
    name: "print",
    description: "Print media emulation and PDF output in Chromium.",
    browser: "chromium",
    viewport: DESKTOP_VIEWPORT,
    media: "print",
  },
]);

export function laneByName(name: string): LaneDefinition {
  const lane = LANES.find((candidate) => candidate.name === name);
  if (!lane) {
    throw new Error(
      `unknown lane "${name}"; known lanes: ${LANES.map((candidate) => candidate.name).join(", ")}`,
    );
  }
  return lane;
}

export interface LaneActionDelegate {
  press(key: string): void;
  type(text: string): void;
  click(): void;
  drag(): void;
}

export interface LaneActions {
  press(key: string): void;
  type(text: string): void;
  click(): void;
  drag(): void;
}

/**
 * Wraps a page's real action methods so the keyboard-only lane throws on any
 * pointer action instead of silently performing it — the contract primitives
 * (`operateInstrument`, `enterValue`, ...) call through this wrapper rather
 * than a raw Playwright locator, so a journey authored for another lane
 * cannot accidentally pass the keyboard-only lane by using a pointer.
 */
export function createLaneActions(lane: LaneDefinition, delegate: LaneActionDelegate): LaneActions {
  function guardPointerAction<Args extends unknown[]>(
    actionName: string,
    fn: (...args: Args) => void,
  ) {
    return (...args: Args): void => {
      if (lane.keyboardOnly) {
        throw new Error(
          `lane "${lane.name}" is keyboard-only; a pointer action ("${actionName}") is not permitted`,
        );
      }
      fn(...args);
    };
  }
  return {
    press: delegate.press.bind(delegate),
    type: delegate.type.bind(delegate),
    click: guardPointerAction("click", delegate.click.bind(delegate)),
    drag: guardPointerAction("drag", delegate.drag.bind(delegate)),
  };
}

export interface LaneSession {
  readonly lane: LaneDefinition;
  readonly browser: Browser;
  readonly context: BrowserContext;
  readonly page: Page;
  readonly actions: LaneActions;
  close(): Promise<void>;
}

export interface LaunchLaneOptions {
  headless?: boolean;
  baseURL?: string;
}

export async function launchLaneSession(
  lane: LaneDefinition,
  options: LaunchLaneOptions = {},
): Promise<LaneSession> {
  const isChromium = lane.browser === "chromium";
  const launcher = isChromium ? chromium : webkit;
  const launchArgs = lane.chromiumArgs ? [...lane.chromiumArgs] : undefined;

  const browser = await launcher.launch({
    headless: options.headless ?? true,
    args: launchArgs,
  });

  const context = await browser.newContext({
    viewport: lane.viewport,
    deviceScaleFactor: lane.deviceScaleFactor,
    hasTouch: lane.hasTouch,
    isMobile: lane.isMobile,
    reducedMotion: lane.reducedMotion ?? "no-preference",
    javaScriptEnabled: lane.javaScriptEnabled ?? true,
    baseURL: options.baseURL,
  });

  const page = await context.newPage();

  if (lane.media) {
    await page.emulateMedia({ media: lane.media });
  }

  if (lane.injectedStylesheet) {
    const css = lane.injectedStylesheet;
    await page.addInitScript((styleContent) => {
      const style = document.createElement("style");
      style.textContent = styleContent;
      document.head?.appendChild(style);
    }, css);
  }

  const delegate: LaneActionDelegate = {
    press: (key: string) => {
      void page.keyboard.press(key);
    },
    type: (text: string) => {
      void page.keyboard.type(text);
    },
    click: () => {
      void page.mouse.click(lane.viewport.width / 2, lane.viewport.height / 2);
    },
    drag: () => {
      void page.mouse.down();
      void page.mouse.up();
    },
  };

  const actions = createLaneActions(lane, delegate);

  return {
    lane,
    browser,
    context,
    page,
    actions,
    close: async () => {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}

export interface FixtureJourneyLaneResult {
  readonly ok: boolean;
  readonly lane: string;
  readonly message?: string;
}

export async function runFixtureJourneyOnLane(
  lane: LaneDefinition,
  fixtureServerUrl: string,
  options: LaunchLaneOptions = {},
): Promise<FixtureJourneyLaneResult> {
  const session = await launchLaneSession(lane, options);
  try {
    const sectionUrl = `${fixtureServerUrl}/fixture-section.html#s1-p2-s1`;
    await session.page.goto(sectionUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });

    await session.page.waitForSelector("[data-reader-root]", { state: "attached", timeout: 15_000 });
    await session.page.waitForSelector("#s1-p2-s1, [data-anchor='s1-p2-s1']", { state: "attached", timeout: 15_000 });

    const mathCount = await session.page.locator("math").count();
    if (mathCount === 0) {
      throw new Error(`Lane ${lane.name}: MathML element <math> not found in fixture section`);
    }

    const textContent = await session.page.locator("[data-reader-root]").textContent();
    if (!textContent || !textContent.includes("Osmotic Pressure")) {
      throw new Error(`Lane ${lane.name}: Fixture section text not read correctly`);
    }

    // Lane-specific assertions
    if (lane.javaScriptEnabled === false) {
      // AC 5: The JavaScript-disabled lane reads fixture section text and equation MathML from the static document.
      return {
        ok: true,
        lane: lane.name,
        message: "Static document successfully read text and equation MathML with JS disabled",
      };
    }

    if (lane.disableWebGL) {
      // AC 6: The no-WebGL lane confirms WebGL is unavailable and the page stays usable.
      const hasWebgl = await session.page.evaluate(() => {
        const canvas = document.createElement("canvas");
        return !!(canvas.getContext("webgl") || canvas.getContext("webgl2") || canvas.getContext("experimental-webgl"));
      });
      if (hasWebgl) {
        throw new Error(`Lane ${lane.name}: WebGL context is available despite disabling flags`);
      }
      const isUsable = (await session.page.locator("a, button").count()) > 0;
      if (!isUsable) {
        throw new Error(`Lane ${lane.name}: Page is not usable`);
      }
    }

    // Interaction steps for interactive lanes
    if (lane.keyboardOnly) {
      let clickFailed = false;
      try {
        session.actions.click();
      } catch (err) {
        if (err instanceof Error && err.message.includes("keyboard-only")) {
          clickFailed = true;
        }
      }
      if (!clickFailed) {
        throw new Error(`Lane ${lane.name}: Pointer action was not rejected in keyboard-only lane`);
      }
      await session.page.keyboard.press("Tab");
      const activeTag = await session.page.evaluate(() => document.activeElement?.tagName);
      if (!activeTag || activeTag === "BODY") {
        throw new Error(`Lane ${lane.name}: Keyboard Tab navigation did not focus an element`);
      }
    } else {
      const term = session.page.locator("[data-term-id='viscosity']").first();
      await term.click();
      await session.page.waitForSelector("[data-active-term='viscosity']", { timeout: 5000 });

      const parallelLink = session.page.locator("a[href*='view=parallel']").first();
      if ((await parallelLink.count()) > 0) {
        await parallelLink.click();
        await session.page.waitForSelector("[data-reader-root][data-view='parallel']", { timeout: 5000 });
      }

      const sourceLink = session.page.locator("a[href*='view=source']").first();
      if ((await sourceLink.count()) > 0) {
        await sourceLink.click();
        await session.page.waitForSelector("[data-reader-root][data-view='source']", { timeout: 5000 });
      }
    }

    // Navigate to selftest instrument
    const selftestUrl = `${fixtureServerUrl}/harness-selftest.html?mode=apparatus`;
    await session.page.goto(selftestUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await session.page.waitForSelector("[data-instrument-id='harness-selftest:apparatus']", {
      state: "attached",
      timeout: 15_000,
    });

    const input = session.page.locator("#selftest-input").first();
    if ((await input.count()) > 0) {
      await input.fill("42");
      await input.dispatchEvent("change");
      const rev = await session.page.getAttribute(
        "[data-instrument-id='harness-selftest:apparatus']",
        "data-input-revision",
      );
      if (Number(rev) < 1) {
        throw new Error(`Lane ${lane.name}: Instrument data-input-revision not updated`);
      }
    }

    return {
      ok: true,
      lane: lane.name,
      message: `Completed full fixture journey on ${lane.name}`,
    };
  } finally {
    await session.close();
  }
}

