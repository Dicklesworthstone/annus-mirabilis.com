import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BUILD_DEPENDENT_ROWS,
  runPerformanceBudgets,
  unmeasuredBuildRows,
} from "../run-perf-budgets.ts";
import { readBuildId } from "./browserBudgetArtifact.ts";
import { normalizeAppManifestKey } from "./initialRouteGraph.ts";

describe("Performance Budgets Gate Execution & Negative Tests", () => {
  test("baseline measurement passes all budgets cleanly", async () => {
    // NOT EVIDENCE ABOUT A RELEASE CANDIDATE (am-opd1). This measures whatever `out/` is on disk,
    // and in the verified deploy's gate chain the unit-test lane runs at step 5 while the build runs
    // at step 9 -- so here it measures the tree the PREVIOUS deploy left behind. 6b9ec998 shipped a
    // 256,141-byte reading face against a 250,000-byte budget with this test green, because
    // eaec86a3's tree had passed.
    //
    // It still earns its place: it proves the runner works and catches a local regression once the
    // tree is rebuilt. What it cannot say is anything about the commit being released. That is
    // measured after the build by scripts/deployment-build-budgets.ts, which the deploy calls
    // between `vercel build` and any upload or alias move, and whose refusal is pinned in
    // scripts/deployment-build-budgets.test.ts.
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

describe("a row that reached no measurement prints no number (am-snn0)", () => {
  test("every not-available row reports the sentinel, and never a number", async () => {
    // DRIVEN WITH NO BROWSER ARTIFACT, DELIBERATELY (am-snn0). This used to read the ambient
    // artifacts/budgets directory and assert that six rows were unavailable, which made it depend on
    // whether anyone had run the browser step: once three of those rows could be measured, the test
    // failed on CORRECT work. The property it exists for is unchanged -- a row that reached no
    // measurement prints no number -- so it is now asserted at an input where rows certainly reach
    // none, and the measured direction is asserted beside it as before.
    const noArtifacts = mkdtempSync(join(tmpdir(), "perf-no-browser-"));
    const result = await runPerformanceBudgets({ silent: true, browserBudgetRoot: noArtifacts });
    const rows = Object.entries(result.report.metrics);
    const unavailable = rows.filter(([, m]) => m.status === "not-available");
    // NON-VACUITY FIRST. An empty set here would make the loop below assert nothing while reading as
    // a clean pass.
    expect(unavailable.length).toBeGreaterThan(0);
    for (const [id, m] of unavailable) {
      // Before this, these held 86 ms of latency, 0.03 of layout shift, 65 ms of feedback, 16.6 ms
      // between frames and `true` for visible text. None was observed, and across 1,777 artifacts
      // none ever changed, because nothing produced them but the harness.
      expect(typeof m.actual, `${id} reported a value it never measured`).not.toBe("number");
      expect(m.actual, `${id} must say not-measured`).toBe("not-measured");
    }
    // THE OTHER DIRECTION, so this did not simply blank the column: a row that did reach build
    // output still carries its figure.
    const measured = rows.filter(([, m]) => m.status === "pass" || m.status === "fail");
    expect(measured.length).toBeGreaterThan(0);
    for (const [id, m] of measured) {
      expect(typeof m.actual, `${id} reached a verdict and must report its figure`).toBe("number");
    }
  });

  test("the synthetic figure is MOVED to its note, not deleted", async () => {
    // A diagnostic belongs beside its disclaimer. The bead calls these notes "scrupulously honest"
    // and identifies the `actual` column as the misleading place, so the repair must keep them.
    // Also driven with no browser artifact: the synthetic figure belongs in the note only on a run
    // that HAS no measurement. With an artifact the note carries the real p75 and its population.
    const noArtifacts = mkdtempSync(join(tmpdir(), "perf-no-browser-"));
    const result = await runPerformanceBudgets({ silent: true, browserBudgetRoot: noArtifacts });
    const latency = result.report.metrics["interaction-latency-p75"];
    expect(latency?.status).toBe("not-available");
    expect(latency?.notes ?? "").toContain("synthetic");
    expect(latency?.notes ?? "").toContain("no browser was driven");
    // And the note says WHY there is no measurement and what produces one, rather than only that
    // there is none.
    expect(latency?.notes ?? "").toContain("measure-browser-budgets.mjs");
  });
  /**
   * THE THREE ROWS THAT HAD NEVER REACHED A VERDICT, AND THE ONE WAY THAT COULD GO WRONG (am-snn0).
   *
   * `visible-text-math`, `interaction-latency-p75` and `layout-shift` each had a tested evaluator and
   * a synthetic input, so each reported `not-available` on every run since the harness was written.
   * They now report whatever `scripts/perf/measure-browser-budgets.mjs` observed.
   *
   * Only the artifact's LOCATION is overridden below. The build id still comes from the real `out/`
   * and the artifact still goes through the real reader, so these drive the production path: an
   * over-budget row must turn the gate red, and an artifact from another build must be refused
   * rather than reported. The second is the case that looks like success -- a complete, well-formed
   * record of real measurements, taken against a tree that is no longer there.
   */
  function browserArtifact(buildId: string, overrides: Record<string, unknown> = {}) {
    return {
      schemaVersion: 1,
      toolRunId: "20261010T000000Z-deadbeef",
      timestamp: "2026-10-10T00:00:00.000Z",
      buildId,
      browser: "chromium 999.0 (fixture)",
      viewport: "1280x900",
      routes: ["/", "/papers/mass-energy/"],
      visibleTextMath: {
        ok: true,
        routes: 2,
        mathMlCount: 12,
        katexCount: 20,
        offOriginFonts: 0,
        violations: [],
      },
      interactionLatency: {
        p75LatencyMs: 32,
        interactionCount: 94,
        rawEntryCount: 1523,
        budgetMs: 200,
        overBudget: false,
      },
      layoutShift: {
        maxSessionWindowScore: 0.044,
        sessionWindowsCount: 1,
        worstRoute: "/",
        budgetScore: 0.1,
        overBudget: false,
      },
      ...overrides,
    };
  }

  function writeBrowserArtifact(body: unknown): string {
    const root = mkdtempSync(join(tmpdir(), "perf-browser-"));
    mkdirSync(join(root, "artifacts", "budgets"), { recursive: true });
    writeFileSync(
      join(root, "artifacts", "budgets", "browser-20261010T000000Z-deadbeef.json"),
      `${JSON.stringify(body)}\n`,
      "utf8",
    );
    return root;
  }

  test("a usable browser artifact gives the three rows real verdicts instead of not-available", async () => {
    const buildId = readBuildId("out");
    expect(buildId).not.toBeNull();
    const root = writeBrowserArtifact(browserArtifact(buildId as string));
    const result = await runPerformanceBudgets({ silent: true, browserBudgetRoot: root });
    for (const id of ["visible-text-math", "interaction-latency-p75", "layout-shift"]) {
      const row = result.report.metrics[id];
      expect(row?.status).toBe("pass");
    }
    // The numbers are the artifact's, not the harness's synthetic ones (which were 86 and 0.03).
    expect(result.report.metrics["interaction-latency-p75"]?.actual).toBe(32);
    expect(result.report.metrics["layout-shift"]?.actual).toBe(0.044);
    expect(result.ok).toBe(true);
  });

  test("PLANTED: an over-budget layout shift in the artifact turns the gate red", async () => {
    const buildId = readBuildId("out") as string;
    const root = writeBrowserArtifact(
      browserArtifact(buildId, {
        layoutShift: {
          maxSessionWindowScore: 0.37,
          sessionWindowsCount: 3,
          worstRoute: "/papers/brownian-motion/s4/",
          budgetScore: 0.1,
          overBudget: true,
        },
      }),
    );
    const result = await runPerformanceBudgets({ silent: true, browserBudgetRoot: root });
    expect(result.failedMetrics).toContain("layout-shift");
    expect(result.ok).toBe(false);
  });

  test("PLANTED: an over-budget p75 in the artifact turns the gate red", async () => {
    const buildId = readBuildId("out") as string;
    const root = writeBrowserArtifact(
      browserArtifact(buildId, {
        interactionLatency: {
          p75LatencyMs: 264,
          interactionCount: 94,
          rawEntryCount: 1523,
          budgetMs: 200,
          overBudget: true,
        },
      }),
    );
    const result = await runPerformanceBudgets({ silent: true, browserBudgetRoot: root });
    expect(result.failedMetrics).toContain("interaction-latency-p75");
    expect(result.ok).toBe(false);
  });

  test("PLANTED: a visible-text-math violation in the artifact turns the gate red", async () => {
    const buildId = readBuildId("out") as string;
    const root = writeBrowserArtifact(
      browserArtifact(buildId, {
        visibleTextMath: {
          ok: false,
          routes: 2,
          mathMlCount: 0,
          katexCount: 20,
          offOriginFonts: 1,
          violations: ["/: initial HTML includes KaTeX markup but lacks <math> (MathML) element"],
        },
      }),
    );
    const result = await runPerformanceBudgets({ silent: true, browserBudgetRoot: root });
    expect(result.failedMetrics).toContain("visible-text-math");
    expect(result.ok).toBe(false);
  });

  test("an artifact naming ANOTHER build is refused, and the rows stay not-available", async () => {
    // The dangerous case: an over-budget row from a build that is no longer on disk must neither
    // fail the gate nor pass it. It is not a measurement of this build at all.
    const root = writeBrowserArtifact(
      browserArtifact("A_BUILD_THAT_IS_NOT_ON_DISK", {
        layoutShift: {
          maxSessionWindowScore: 0.9,
          sessionWindowsCount: 4,
          worstRoute: "/",
          budgetScore: 0.1,
          overBudget: true,
        },
      }),
    );
    const result = await runPerformanceBudgets({ silent: true, browserBudgetRoot: root });
    for (const id of ["visible-text-math", "interaction-latency-p75", "layout-shift"]) {
      expect(result.report.metrics[id]?.status).toBe("not-available");
      expect(result.report.metrics[id]?.actual).toBe("not-measured");
    }
    expect(result.failedMetrics).not.toContain("layout-shift");
    expect(result.ok).toBe(true);
  });

  test("with no artifact at all the three rows are not-available, as before this change", async () => {
    const root = mkdtempSync(join(tmpdir(), "perf-browser-none-"));
    const result = await runPerformanceBudgets({ silent: true, browserBudgetRoot: root });
    for (const id of ["visible-text-math", "interaction-latency-p75", "layout-shift"]) {
      expect(result.report.metrics[id]?.status).toBe("not-available");
    }
    expect(result.ok).toBe(true);
  });

  test("a partial artifact reports the row it carries and leaves the others not-available", async () => {
    // A run that drove fewer than 20 interactions writes no latency row, because the evaluator
    // refuses. That must not discard the layout-shift measurement it did take.
    const buildId = readBuildId("out") as string;
    const full = browserArtifact(buildId) as Record<string, unknown>;
    delete full.interactionLatency;
    delete full.visibleTextMath;
    const root = writeBrowserArtifact(full);
    const result = await runPerformanceBudgets({ silent: true, browserBudgetRoot: root });
    expect(result.report.metrics["layout-shift"]?.status).toBe("pass");
    expect(result.report.metrics["interaction-latency-p75"]?.status).toBe("not-available");
    expect(result.report.metrics["visible-text-math"]?.status).toBe("not-available");
  });
});
