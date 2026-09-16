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

const WEBGL_DISABLING_CHROMIUM_ARGS = ["--disable-3d-apis", "--disable-webgl", "--disable-webgl2"] as const;

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
    description: "Desktop Chromium with JavaScript disabled; reading checks run against the rendered document.",
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
    throw new Error(`unknown lane "${name}"; known lanes: ${LANES.map((candidate) => candidate.name).join(", ")}`);
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
  function guardPointerAction<Args extends unknown[]>(actionName: string, fn: (...args: Args) => void) {
    return (...args: Args): void => {
      if (lane.keyboardOnly) {
        throw new Error(`lane "${lane.name}" is keyboard-only; a pointer action ("${actionName}") is not permitted`);
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
