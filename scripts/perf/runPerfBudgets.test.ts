import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import {
  BUILD_DEPENDENT_ROWS,
  runPerformanceBudgets,
  unmeasuredBuildRows,
} from "../run-perf-budgets.ts";
import { normalizeAppManifestKey } from "./initialRouteGraph.ts";

describe("Performance Budgets Gate Execution & Negative Tests", () => {
  test("baseline measurement passes all budgets cleanly", async () => {
    const result = await runPerformanceBudgets({ silent: true });
    expect(result.ok).toBe(true);
    expect(result.failedMetrics).toHaveLength(0);
    expect(result.report.outcome).toBe("pass");
    expect(result.report.conditions.hardware).toBeDefined();
    expect(result.report.conditions.calibrationState).toBe("provisional");
    expect(result.report.routes.length).toBeGreaterThan(0);
    for (const r of result.report.routes) {
      expect(r.totalTransferBytes).toBeGreaterThan(r.scriptTransferBytes);
    }
  });

  test("row 1 measures every page route under /papers/ in the build's manifest", async () => {
    // It measured "/papers/brownian-motion" alone, so "/papers/[paper]" and every section and face
    // page had no JavaScript budget. Read from the same manifest the gate reads.
    const manifestPath = ".next/app-build-manifest.json";
    expect(existsSync(manifestPath)).toBe(true);
    const pages = (JSON.parse(readFileSync(manifestPath, "utf8")) as { pages: object }).pages;
    const expected = Object.keys(pages)
      .filter((key) => /(^|\/)page$/.test(key))
      .map(normalizeAppManifestKey)
      .filter((route) => route.startsWith("/papers/"));
    // Not vacuous: the three papers' shared route and Brownian's own are both among them.
    expect(expected).toContain("/papers/[paper]");
    expect(expected).toContain("/papers/brownian-motion");
    const result = await runPerformanceBudgets({ silent: true });
    const measured = result.report.routes.map((r) => r.route);
    for (const route of expected) expect(measured).toContain(route);
  });

  test("fails on planted violation for Row 1: Initial Route JS budget (> 204,800 bytes)", async () => {
    const result = await runPerformanceBudgets({ plantViolationRow: 1, silent: true });
    expect(result.ok).toBe(false);
    expect(result.failedMetrics).toContain("initial-route-js");
  });

  test("fails on planted violation for Row 2: Reading Face HTML budget (> 250,000 bytes)", async () => {
    const result = await runPerformanceBudgets({ plantViolationRow: 2, silent: true });
    expect(result.ok).toBe(false);
    expect(result.failedMetrics).toContain("reading-face-html");
  });

  test("fails on planted violation for Row 3: Visible Text and Math (missing MathML)", async () => {
    const result = await runPerformanceBudgets({ plantViolationRow: 3, silent: true });
    expect(result.ok).toBe(false);
    expect(result.failedMetrics).toContain("visible-text-math");
  });

  test("fails on planted violation for Row 4: Interaction Latency p75 (> 200 ms)", async () => {
    const result = await runPerformanceBudgets({ plantViolationRow: 4, silent: true });
    expect(result.ok).toBe(false);
    expect(result.failedMetrics).toContain("interaction-latency-p75");
  });

  test("fails on planted violation for Row 5: Cumulative Layout Shift (> 0.1)", async () => {
    const result = await runPerformanceBudgets({ plantViolationRow: 5, silent: true });
    expect(result.ok).toBe(false);
    expect(result.failedMetrics).toContain("layout-shift");
  });

  test("fails on planted violation for Row 6: Instrument Feedback (> 100 ms)", async () => {
    const result = await runPerformanceBudgets({ plantViolationRow: 6, silent: true });
    expect(result.ok).toBe(false);
    expect(result.failedMetrics).toContain("instrument-feedback");
  });

  test("fails on planted violation for Row 7: Animation Frame Timing (> 33.4 ms median)", async () => {
    const result = await runPerformanceBudgets({ plantViolationRow: 7, silent: true });
    expect(result.ok).toBe(false);
    expect(result.failedMetrics).toContain("animation-frame-rate");
  });

  test("fails when throttled physics digest differs from unthrottled digest", async () => {
    const result = await runPerformanceBudgets({ plantViolationPhysics: true, silent: true });
    expect(result.ok).toBe(false);
    expect(result.failedMetrics).toContain("animation-frame-rate");
  });
});

/**
 * The floor (am-7bkr). Kept as a PURE unit beside the lane that runs the script, because the
 * behavioural half needs a built out/ and this half must stay readable on a tree that has none.
 *
 * The race this exists for: a build finishing inside a central-verify window left the script
 * reading out/ mid-write. overallPassed was `failedMetrics.length === 0` alone, so a run whose
 * build-dependent rows dropped out and whose survivors happened to be under budget would have
 * reported "pass". Measured on a settled tree, three consecutive unplanted runs each reported
 * 2 of 8 rows measured; the floor names those two rather than asserting the number 2, so adding
 * a browser-driven row later cannot leave it passing at two.
 */
describe("build-dependent row floor (am-7bkr)", () => {
  const ok = { status: "pass" as const };
  const bad = { status: "fail" as const };
  const gone = { status: "not-available" as const };

  test("names the two rows the floor covers, so the set is auditable rather than implied", () => {
    expect([...BUILD_DEPENDENT_ROWS]).toEqual(["initial-route-js", "reading-face-html"]);
  });

  test("a settled run with both rows measured clears the floor", () => {
    // A FAILED budget is still a verdict: the floor is about measurement, not about passing.
    expect(unmeasuredBuildRows({ "initial-route-js": ok, "reading-face-html": bad })).toEqual([]);
  });

  test("a row that reached no verdict is reported, and so is a row missing entirely", () => {
    expect(unmeasuredBuildRows({ "initial-route-js": ok, "reading-face-html": gone })).toEqual([
      "reading-face-html",
    ]);
    expect(unmeasuredBuildRows({ "initial-route-js": ok })).toEqual(["reading-face-html"]);
    expect(unmeasuredBuildRows({})).toEqual(["initial-route-js", "reading-face-html"]);
  });

  test("the six structurally unavailable rows do not enter the floor", () => {
    // They are hardcoded not-available in this harness unless a plant flag makes them
    // measurable, so including them would make the floor permanently red and therefore ignored.
    expect(
      unmeasuredBuildRows({
        "initial-route-js": ok,
        "reading-face-html": ok,
        "visible-text-math": gone,
        "interaction-latency-p75": gone,
        "layout-shift": gone,
        "instrument-feedback": gone,
        "animation-frame-rate": gone,
        "resource-lifecycle": gone,
      }),
    ).toEqual([]);
  });
});
