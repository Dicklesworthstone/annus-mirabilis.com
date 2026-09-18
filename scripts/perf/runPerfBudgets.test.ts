import { describe, expect, test } from "bun:test";
import { runPerformanceBudgets } from "../run-perf-budgets.ts";

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
