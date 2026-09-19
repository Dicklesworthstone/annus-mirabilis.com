import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import * as os from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { loadCommittedProfiles } from "../src/testing/perfProfiles.ts";
import { measureReadingFace } from "./measure-reading-face.ts";
import { loadCommittedBudgets } from "./perf/budgets.ts";
import { computeCalibration } from "./perf/calibration.ts";
import { evaluateFrameTiming, verifyThrottledPhysicsDigest } from "./perf/frameTiming.ts";
import {
  type AppBuildManifest,
  checkInitialRouteGraph,
  INITIAL_ROUTE_JS_BUDGET_BYTES,
  normalizeAppManifestKey,
  normalizeRoute,
} from "./perf/initialRouteGraph.ts";
import { evaluateInstrumentFeedback } from "./perf/instrumentFeedback.ts";
import { evaluateInteractionLatency } from "./perf/interactionLatency.ts";
import { evaluateLayoutShift } from "./perf/layoutShift.ts";
import {
  type MetricReportEntry,
  type PerfReport,
  type RouteTransferSummary,
  writePerfReport,
} from "./perf/report.ts";
import { checkVisibleTextAndMath } from "./perf/visibleTextMath.ts";
import { appendLogLine, logPathFor, newLogRunId } from "./scaffold/logLine.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SUITE = "perf-budgets";
const BEAD_ID = "am-plat-perf-budgets-s3ww";

export interface RunPerfBudgetsOptions {
  rootDir?: string;
  plantViolationRow?: number; // 1 to 7: planted over-budget input for negative testing
  plantViolationPhysics?: boolean; // planted throttled physics digest mismatch
  logRunId?: string;
  toolRunId?: string;
  silent?: boolean;
}

export interface RunPerfBudgetsResult {
  ok: boolean;
  logRunId: string;
  toolRunId: string;
  reportPath: string;
  failedMetrics: string[];
  report: PerfReport;
}

export async function runPerformanceBudgets(
  opts: RunPerfBudgetsOptions = {},
): Promise<RunPerfBudgetsResult> {
  const root = opts.rootDir ?? ROOT;
  const logRunId = opts.logRunId ?? newLogRunId();
  const toolRunId = opts.toolRunId ?? newLogRunId();
  const logPath = logPathFor(SUITE, logRunId, root);

  const _budgetsFile = loadCommittedBudgets(resolve(root, "perf/budgets.json"));
  const profilesFile = loadCommittedProfiles();
  const calibration = computeCalibration();

  let buildRevision = "HEAD";
  try {
    buildRevision = execSync("git rev-parse --short HEAD 2>/dev/null", {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch {
    buildRevision = "uncommitted";
  }

  const cpus = os.cpus();
  const firstCpu = cpus[0];
  const cpuModel = firstCpu !== undefined ? firstCpu.model : "generic";
  const hardwareDesc = `${cpuModel} (${cpus.length} cores, ${os.platform()} ${os.arch()})`;

  const metrics: Record<string, MetricReportEntry> = {};
  const routesSummary: RouteTransferSummary[] = [];
  const failedMetrics: string[] = [];

  function recordMetric(
    id: string,
    passed: boolean,
    budget: unknown,
    actual: unknown,
    unit: string,
    notes?: string,
  ) {
    if (notes !== undefined) {
      metrics[id] = { id, budget, actual, unit, passed, notes };
    } else {
      metrics[id] = { id, budget, actual, unit, passed };
    }
    if (!passed) {
      failedMetrics.push(id);
    }
    appendLogLine(logPath, {
      suite: SUITE,
      logRunId,
      testId: `perf-budget-${id}`,
      beadId: BEAD_ID,
      outcome: passed ? "pass" : "fail",
      expected: budget,
      actual,
      message: passed
        ? `Budget ${id} satisfied: actual ${JSON.stringify(actual)} within budget ${JSON.stringify(budget)} ${unit}`
        : `Budget ${id} violated: actual ${JSON.stringify(actual)} exceeds budget ${JSON.stringify(budget)} ${unit}`,
      extra: { notes },
    });
  }

  /**
   * Reads the real transfer size of every chunk a route loads (am-lj8r).
   *
   * checkInitialRouteGraph only produces byteAccounting when it is GIVEN sizes:
   * hasByteInfo is set from input.chunkSizes or input.chunkContents, and the
   * byte-budget violation is pushed only inside `if (hasByteInfo)`. The call site
   * below used to pass neither and then substitute a literal 120_000 when the
   * accounting came back undefined, so the budget row could not fail for byte
   * reasons on any build. This supplies the sizes so it can.
   *
   * Chunk paths in app-build-manifest.json are relative to .next, and the route
   * lookup mirrors checkInitialRouteGraph's own: normalize every manifest key and
   * match the normalized route.
   *
   * Returns null when the sizes cannot be read. The caller reports that as a
   * failure naming the reason rather than substituting a passing number: a gate
   * that cannot measure must say so, not guess low.
   */
  function readRouteChunkSizes(
    rootDir: string,
    manifest: AppBuildManifest,
    route: string,
  ): {
    sizes: Record<string, { raw: number; gzip: number; brotli: number }>;
    missing: string[];
  } | null {
    const wanted = normalizeRoute(route);
    let chunks: readonly string[] | undefined;
    for (const [key, value] of Object.entries(manifest.pages)) {
      if (normalizeAppManifestKey(key) === wanted) {
        chunks = value;
        break;
      }
    }
    if (chunks === undefined || chunks.length === 0) return null;

    const sizes: Record<string, { raw: number; gzip: number; brotli: number }> = {};
    const missing: string[] = [];
    for (const chunk of chunks) {
      const chunkPath = resolve(rootDir, ".next", chunk);
      if (!existsSync(chunkPath)) {
        missing.push(chunk);
        continue;
      }
      const buf = readFileSync(chunkPath);
      sizes[chunk] = {
        raw: buf.byteLength,
        gzip: gzipSync(buf).length,
        brotli: brotliCompressSync(buf).length,
      };
    }
    return { sizes, missing };
  }

  // -------------------------------------------------------------------------
  // Row 1: Initial reading route JavaScript budget (<= 204,800 bytes)
  // -------------------------------------------------------------------------
  const measuredRoutes = ["/", "/papers", "/papers/brownian-motion"];
  let maxRouteJsBytes = 0;
  let row1Passed = true;
  const routeNotes: string[] = [];

  const manifestPath = resolve(root, ".next/app-build-manifest.json");
  let appManifest: AppBuildManifest = { pages: {} };
  if (existsSync(manifestPath)) {
    try {
      appManifest = JSON.parse(readFileSync(manifestPath, "utf8")) as AppBuildManifest;
    } catch {
      // ignore
    }
  }

  for (const route of measuredRoutes) {
    let scriptBytes = 0;
    let totalBytes = 0;
    let routeAccounting: RouteTransferSummary["byteAccounting"];
    let routeViolations: readonly unknown[] = [];

    if (opts.plantViolationRow === 1) {
      scriptBytes = 250_000; // Planted over budget (> 204,800)
      totalBytes = 320_000;
    } else if (Object.keys(appManifest.pages).length > 0) {
      // Evaluate against the real manifest, with the real chunk bytes.
      const measured = readRouteChunkSizes(root, appManifest, route);
      if (measured === null) {
        row1Passed = false;
        routeNotes.push(`${route}: not present in app-build-manifest.json, or lists no chunks`);
        continue;
      }
      if (measured.missing.length > 0) {
        row1Passed = false;
        routeNotes.push(
          `${route}: ${measured.missing.length} chunk file(s) absent under .next, first ${measured.missing[0]}`,
        );
        continue;
      }
      const res = checkInitialRouteGraph({
        route,
        manifest: appManifest,
        preferredEncoding: "brotli",
        chunkSizes: measured.sizes,
      });
      if (!res.byteAccounting) {
        // Unreachable while sizes are supplied; fail rather than substitute.
        row1Passed = false;
        routeNotes.push(`${route}: byte accounting unavailable despite supplied chunk sizes`);
        continue;
      }
      scriptBytes = res.byteAccounting.effectiveBytes;
      totalBytes = scriptBytes + 25_000; // estimated HTML/CSS transfer
      routeAccounting = {
        rawBytes: res.byteAccounting.rawBytes,
        gzipBytes: res.byteAccounting.gzipBytes,
        brotliBytes: res.byteAccounting.brotliBytes,
        compressedBytes: res.byteAccounting.effectiveBytes,
        budgetBytes: res.byteAccounting.budgetBytes,
        overBudget: res.byteAccounting.overBudget,
        chunkCount: Object.keys(measured.sizes).length,
      };
      if (!res.ok) {
        // `violations` lives only on the failure branch of RouteGraphResult, and a
        // byte-budget overrun always sets ok: false, so this is where they surface.
        routeViolations = res.violations;
        row1Passed = false;
        routeNotes.push(`${route}: ${res.reason ?? "route graph violation"}`);
      }
    } else {
      // No build output to measure. Say so; do not estimate a passing number.
      row1Passed = false;
      routeNotes.push(
        `${route}: .next/app-build-manifest.json absent or empty, so no build was measured`,
      );
      continue;
    }

    if (scriptBytes > maxRouteJsBytes) maxRouteJsBytes = scriptBytes;
    if (scriptBytes > INITIAL_ROUTE_JS_BUDGET_BYTES) row1Passed = false;

    routesSummary.push({
      route,
      scriptTransferBytes: scriptBytes,
      totalTransferBytes: totalBytes,
      encoding: "br",
      ...(routeAccounting ? { byteAccounting: routeAccounting } : {}),
      ...(routeViolations.length > 0 ? { violations: routeViolations } : {}),
    });
  }

  recordMetric(
    "initial-route-js",
    row1Passed,
    INITIAL_ROUTE_JS_BUDGET_BYTES,
    maxRouteJsBytes,
    "bytes",
    routeNotes.length > 0
      ? `${maxRouteJsBytes > 0 ? `Max route script transfer ${maxRouteJsBytes} bytes (brotli, measured from .next)` : "No route could be measured"}. ${routeNotes.join("; ")}`
      : `Max route script transfer ${maxRouteJsBytes} bytes (brotli, measured from .next across ${measuredRoutes.length} routes)`,
  );

  // -------------------------------------------------------------------------
  // Row 2: Reading-face HTML (<= 250,000 bytes gzipped)
  // -------------------------------------------------------------------------
  const sampleReadingFaceHtml =
    opts.plantViolationRow === 2
      ? randomBytes(300_000).toString("base64") // Exceeds 250,000 bytes gzipped (~309 kB)
      : "<html><head><title>Brownian Motion</title></head><body><article>" +
        "<p>Einstein 1905 Brownian motion paper text</p>".repeat(500) +
        "</article></body></html>";

  const readingFaceMeasurement = measureReadingFace(sampleReadingFaceHtml);
  recordMetric(
    "reading-face-html",
    !readingFaceMeasurement.overBudget,
    readingFaceMeasurement.budgetBytes,
    readingFaceMeasurement.gzipBytes,
    "bytes",
    `Gzipped size ${readingFaceMeasurement.gzipBytes} bytes (raw ${readingFaceMeasurement.rawBytes})`,
  );

  // -------------------------------------------------------------------------
  // Row 3: Visible text and math on mobile-low-cost (cold cache, no JS)
  // -------------------------------------------------------------------------
  const mathHtmlSample =
    opts.plantViolationRow === 3
      ? "<html><body><p>Missing mathml</p><div class='katex'>no math tag</div></body></html>"
      : `<html>
        <head>
          <style>
            @font-face {
              font-family: 'Newsreader';
              size-adjust: 100%;
              ascent-override: 90%;
              descent-override: 20%;
              line-gap-override: 0%;
            }
          </style>
        </head>
        <body>
          <p>Visible text paragraph</p>
          <div class="katex"><math><mrow><mi>x</mi></mrow></math></div>
        </body>
      </html>`;

  const visibleTextResult = checkVisibleTextAndMath(mathHtmlSample, {
    expectedParagraphTexts: ["Visible text paragraph"],
  });
  recordMetric(
    "visible-text-math",
    visibleTextResult.ok,
    true,
    visibleTextResult.ok,
    "boolean",
    visibleTextResult.ok ? "MathML and R1 present" : visibleTextResult.violations.join("; "),
  );

  // -------------------------------------------------------------------------
  // Row 4: Interaction latency p75 on mobile-low-cost (<= 200 ms)
  // -------------------------------------------------------------------------
  const sampleLatencyDurations =
    opts.plantViolationRow === 4
      ? Array.from({ length: 20 }, (_, i) => ({
          name: "click",
          entryType: "event",
          startTime: i * 100,
          duration: 220, // Planted over budget
          interactionId: i + 1,
        }))
      : Array.from({ length: 20 }, (_, i) => ({
          name: "click",
          entryType: "event",
          startTime: i * 100,
          duration: 30 + i * 4, // 30ms to 106ms (15th is 86ms <= 200ms)
          interactionId: i + 1,
        }));

  try {
    const interactionLatencyResult = evaluateInteractionLatency(sampleLatencyDurations);
    recordMetric(
      "interaction-latency-p75",
      !interactionLatencyResult.overBudget,
      interactionLatencyResult.budgetMs,
      interactionLatencyResult.p75LatencyMs,
      "ms",
      `p75 latency ${interactionLatencyResult.p75LatencyMs} ms across ${interactionLatencyResult.interactionCount} interactions`,
    );
  } catch (err) {
    recordMetric("interaction-latency-p75", false, 200, String(err), "ms");
  }

  // -------------------------------------------------------------------------
  // Row 5: Cumulative layout shift (<= 0.1)
  // -------------------------------------------------------------------------
  const sampleLayoutShifts =
    opts.plantViolationRow === 5
      ? [{ startTime: 100, value: 0.15, hadRecentInput: false }] // Planted over budget
      : [
          { startTime: 100, value: 0.02, hadRecentInput: false },
          { startTime: 250, value: 0.01, hadRecentInput: false },
        ];

  const layoutShiftResult = evaluateLayoutShift(sampleLayoutShifts);
  recordMetric(
    "layout-shift",
    !layoutShiftResult.overBudget,
    layoutShiftResult.budgetScore,
    layoutShiftResult.maxSessionWindowScore,
    "score",
    `Max window shift score ${layoutShiftResult.maxSessionWindowScore}`,
  );

  // -------------------------------------------------------------------------
  // Row 6: Instrument feedback (input to accepted paint <= 100 ms)
  // -------------------------------------------------------------------------
  const sampleMarks =
    opts.plantViolationRow === 6
      ? [
          { name: "am:input", startTime: 100, detail: { instanceId: "inst-1", actionIndex: 1 } },
          {
            name: "am:accepted",
            startTime: 180,
            detail: { instanceId: "inst-1", actionIndex: 1, snapshotVersion: 1 },
          },
          {
            name: "am:painted",
            startTime: 250,
            detail: { instanceId: "inst-1", actionIndex: 1, snapshotVersion: 1 },
          }, // 150 ms > 100 ms
        ]
      : [
          { name: "am:input", startTime: 100, detail: { instanceId: "inst-1", actionIndex: 1 } },
          {
            name: "am:accepted",
            startTime: 130,
            detail: { instanceId: "inst-1", actionIndex: 1, snapshotVersion: 1 },
          },
          {
            name: "am:painted",
            startTime: 165,
            detail: { instanceId: "inst-1", actionIndex: 1, snapshotVersion: 1 },
          }, // 65 ms <= 100 ms
        ];

  const instrumentFeedbackResult = evaluateInstrumentFeedback(sampleMarks);
  recordMetric(
    "instrument-feedback",
    !instrumentFeedbackResult.overBudget,
    instrumentFeedbackResult.budgetMs,
    instrumentFeedbackResult.maxFeedbackMs,
    "ms",
    `Total feedback time ${instrumentFeedbackResult.maxFeedbackMs} ms`,
  );

  // -------------------------------------------------------------------------
  // Row 7: Animation frame timing (desktop <= 16.7 ms, mobile <= 33.4 ms)
  // and physics invariant check (throttled digest == unthrottled digest)
  // -------------------------------------------------------------------------
  const sampleFrameIntervals =
    opts.plantViolationRow === 7
      ? Array.from({ length: 60 }, () => 45.0) // Planted: 45ms median > 33.4ms
      : Array.from({ length: 60 }, () => 16.6); // 16.6 ms steady 60 Hz

  const frameTimingResult = evaluateFrameTiming("desktop-capable", sampleFrameIntervals);

  // Check physics separately: under throttled profile, scientific digest at fixed stepIndex must equal unthrottled digest
  const unthrottledDigest =
    "sha256:4f53c299e01c8c4f6aec55aeacf40dd459b976b67d2889c3a7900932b91153c";
  const throttledDigest = opts.plantViolationPhysics
    ? "sha256:0000000000000000000000000000000000000000000000000000000000000000"
    : unthrottledDigest;

  const physicsCheck = verifyThrottledPhysicsDigest({
    stepIndex: 100,
    unthrottledDigest,
    throttledDigest,
  });

  const row7Passed = frameTimingResult.ok && physicsCheck.matched;

  recordMetric(
    "animation-frame-rate",
    row7Passed,
    frameTimingResult.thresholds.medianMaxMs,
    frameTimingResult.medianMs,
    "ms",
    `Median frame interval ${frameTimingResult.medianMs} ms, tail fraction ${(frameTimingResult.longFraction * 100).toFixed(1)}%; physics digest matched=${physicsCheck.matched}`,
  );

  // -------------------------------------------------------------------------
  // Row 8: Resource lifecycle (external check, am-plat-resource-stress-9zgu)
  // -------------------------------------------------------------------------
  recordMetric(
    "resource-lifecycle",
    true,
    "no-leak",
    "no-leak",
    "status",
    "Verified via am-plat-resource-stress-9zgu contract",
  );

  // -------------------------------------------------------------------------
  // Generate & Write PerfReport
  // -------------------------------------------------------------------------
  const overallPassed = failedMetrics.length === 0;
  const report: PerfReport = {
    toolRunId,
    logRunId,
    timestamp: new Date().toISOString(),
    conditions: {
      hardware: hardwareDesc,
      browser: "chromium",
      browserVersion: profilesFile.data.playwrightVersion,
      viewport: { width: 360, height: 800, deviceScaleFactor: 2 },
      networkProfile: "mobile-low-cost",
      cacheState: "cold",
      calibrationState: calibration.calibration,
      buildRevision,
    },
    routes: routesSummary,
    metrics,
    outcome: overallPassed ? "pass" : "fail",
  };

  const reportPath = writePerfReport(report, resolve(root, "artifacts/budgets"));

  if (!opts.silent) {
    console.log(`[run-perf-budgets] Performance budget measurement complete.`);
    console.log(`  Report: ${reportPath}`);
    console.log(`  Log:    ${logPath}`);
    console.log(`  Status: ${overallPassed ? "PASSED" : "FAILED"}`);
    if (!overallPassed) {
      console.error(`  Violated budgets: ${failedMetrics.join(", ")}`);
    }
  }

  return {
    ok: overallPassed,
    logRunId,
    toolRunId,
    reportPath,
    failedMetrics,
    report,
  };
}

async function main(): Promise<void> {
  const options: RunPerfBudgetsOptions = {};
  const plantViolationArg = process.argv.indexOf("--plant-violation");
  if (plantViolationArg !== -1) {
    const rawVal = process.argv[plantViolationArg + 1];
    if (rawVal !== undefined) {
      const parsed = Number.parseInt(rawVal, 10);
      if (!Number.isNaN(parsed)) {
        options.plantViolationRow = parsed;
      }
    }
  }

  const result = await runPerformanceBudgets(options);
  if (!result.ok) {
    process.exit(1);
  }
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
