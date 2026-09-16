/**
 * Playwright End-to-End Acceptance Test Configuration
 * (am-test-e2e-harness-bqmh requirements 2 and 12).
 *
 * Configures projects for all eleven browser-acceptance lanes:
 * desktop, tablet, touch-320, webkit-real, keyboard-only, reduced-motion,
 * zoom-400, text-200, no-webgl, js-disabled, and print.
 */

import { LANES } from "./scripts/e2e/lanes.ts";

export default {
  testDir: "./src/testing/e2e",
  testMatch: "**/*.test.ts",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    actionTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: LANES.map((lane) => ({
    name: lane.name,
    use: {
      browserName: lane.browser,
      viewport: lane.viewport,
      deviceScaleFactor: lane.deviceScaleFactor ?? 1,
      hasTouch: lane.hasTouch ?? false,
      isMobile: lane.isMobile ?? false,
      reducedMotion: lane.reducedMotion ?? "no-preference",
      javaScriptEnabled: lane.javaScriptEnabled ?? true,
      ...(lane.chromiumArgs ? { launchOptions: { args: [...lane.chromiumArgs] } } : {}),
    },
  })),
};
