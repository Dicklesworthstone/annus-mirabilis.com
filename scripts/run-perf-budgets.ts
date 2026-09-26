import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import * as os from "node:os";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync, constants as zlibConstants } from "node:zlib";
import { loadCommittedProfiles } from "../src/testing/perfProfiles.ts";
import { measureReadingFace, READING_FACE_BUDGET_BYTES } from "./measure-reading-face.ts";
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
  loadReadingFaceRecords,
  measureBuiltReadingFaces,
  READING_FACE_RECORDS_PATH,
  readingFaceVerdict,
} from "./perf/readingFaces.ts";
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

/**
 * The rows whose verdict comes from build output, and therefore the rows whose absence means the
 * run could not measure rather than that a budget was met (am-7bkr).
 *
 * DERIVED FROM THE CORPUS, not chosen. On a settled tree built immediately before measuring, three
 * consecutive unplanted runs of this script each reported exactly:
 *
 *   2 of 8 rows reached real build output; 6 reported not-available: visible-text-math,
 *   interaction-latency-p75, layout-shift, instrument-feedback, animation-frame-rate,
 *   resource-lifecycle
 *
 * The other six are not-available BY CONSTRUCTION in this harness: five are hardcoded unavailable
 * unless a plantViolationRow flag makes them measurable, and resource-lifecycle is unconditional.
 * A floor expressed as a NUMBER would therefore be satisfied by any two rows and would silently
 * keep passing if a browser-driven row were added later, so the floor names its rows instead.
 */
export const BUILD_DEPENDENT_ROWS = ["initial-route-js", "reading-face-html"] as const;

/**
 * The build-dependent rows that reached no verdict. Non-empty means the run is UNMEASURABLE and
 * must refuse, rather than report a budget outcome computed over whatever survived.
 *
 * This is the hole the am-7bkr race exposed: overallPassed read failedMetrics.length === 0 alone,
 * so a run where the build-dependent rows dropped out and nothing failed reported outcome "pass".
 * A false PASS is available whenever the surviving rows happen to be the ones under budget.
 */
/**
 * HTML and CSS are compressed at brotli quality 9, not the default 11. Measured on 2026-09-24:
 * out/papers/brownian-motion/index.html (1,578 KB) is 73,438 B at q11 in 1,629 ms, and 80,948 B
 * at q9 in 26 ms. q11 made each budget run seconds slower, and the tests call it repeatedly. So
 * this figure is up to about 10% above the q11 size, never below it; the JS chunks keep q11.
 */
function brotliStaticBytes(buf: Buffer): number {
  return brotliCompressSync(buf, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 9 } }).length;
}

export function unmeasuredBuildRows(
  metrics: Readonly<Record<string, { readonly status?: "pass" | "fail" | "not-available" }>>,
): readonly string[] {
  return BUILD_DEPENDENT_ROWS.filter(
    (id) => (metrics[id]?.status ?? "not-available") === "not-available",
  );
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
  const notAvailableMetrics: string[] = [];

  function recordMetric(
    id: string,
    passed: boolean,
    budget: unknown,
    actual: unknown,
    unit: string,
    notes?: string,
    status?: "pass" | "fail" | "not-available",
  ) {
    // A not-available row reached no verdict. It is never `passed`, so nothing downstream can
    // read it as coverage, and it is not a failure either, so it does not turn the chain red for
    // a measurement this process cannot take. It is counted and named separately instead.
    const unavailable = status === "not-available";
    const effectivePassed = unavailable ? false : passed;
    const resolved: "pass" | "fail" | "not-available" = unavailable
      ? "not-available"
      : passed
        ? "pass"
        : "fail";
    if (notes !== undefined) {
      metrics[id] = { id, budget, actual, unit, passed: effectivePassed, notes, status: resolved };
    } else {
      metrics[id] = { id, budget, actual, unit, passed: effectivePassed, status: resolved };
    }
    if (unavailable) {
      notAvailableMetrics.push(id);
    } else if (!passed) {
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
  /**
   * The route's own HTML plus every stylesheet it links, brotli-compressed, read from the built
   * `out/`. With the route's JavaScript this is the page's static transfer. Fonts and images are
   * excluded, and a note says so. Until 2026-09-24 the total was the script bytes plus a constant
   * 25,000 labelled "estimated HTML/CSS transfer", reported beside real measurements
   * (am-perf-total-transfer-is-a-constant-qfe1). Returns null when the HTML was not built, so an
   * absent page is reported as unmeasured, never estimated.
   */
  function readRouteHtmlCssBytes(rootDir: string, route: string): number | null {
    // A pattern route such as /papers/[paper] is measured on its first built instance, in sorted
    // order, so the figure is always one real page's transfer, never an average or a guess.
    let dir = resolve(rootDir, "out");
    for (const segment of route.split("/").filter(Boolean)) {
      if (/^\[.+\]$/.test(segment)) {
        const instances = existsSync(dir)
          ? readdirSync(dir, { withFileTypes: true })
              .filter((e) => e.isDirectory() && existsSync(resolve(dir, e.name, "index.html")))
              .map((e) => e.name)
              .sort()
          : [];
        const first = instances.find((name) => !name.startsWith("_"));
        if (first === undefined) return null;
        dir = resolve(dir, first);
      } else {
        dir = resolve(dir, segment);
      }
    }
    const htmlPath = resolve(dir, "index.html");
    if (!existsSync(htmlPath)) return null;
    const html = readFileSync(htmlPath);
    let bytes = brotliStaticBytes(html);
    const hrefs = new Set<string>();
    for (const m of html
      .toString("utf8")
      .matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g)) {
      if (m[1]) hrefs.add(m[1]);
    }
    for (const href of hrefs) {
      const cssPath = resolve(rootDir, "out", href.replace(/^\//, "").split("?")[0] ?? "");
      if (existsSync(cssPath)) bytes += brotliStaticBytes(readFileSync(cssPath));
    }
    return bytes;
  }

  function readRouteChunkSizes(
    rootDir: string,
    manifest: AppBuildManifest,
    route: string,
  ): {
    sizes: Record<string, { raw: number; gzip: number; brotli: number }>;
    contents: Record<string, string>;
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
    // Contents, not only sizes. A byte total cannot tell a 30 kB chunk of reader code from a
    // 30 kB chunk of Three.js, so a size-only row passes while a forbidden import sits in the
    // initial graph. checkInitialRouteGraph already looks for node_modules/three/,
    // node_modules/pdfjs-dist/, .wasm filenames and the other forbidden signatures; it just
    // needs to be given something to look at.
    const contents: Record<string, string> = {};
    const missing: string[] = [];
    for (const chunk of chunks) {
      const chunkPath = resolve(rootDir, ".next", chunk);
      let read = measuredChunks.get(chunkPath);
      if (!read) {
        if (!existsSync(chunkPath)) {
          missing.push(chunk);
          continue;
        }
        const buf = readFileSync(chunkPath);
        read = {
          size: {
            raw: buf.byteLength,
            gzip: gzipSync(buf).length,
            brotli: brotliCompressSync(buf).length,
          },
          content: buf.toString("utf8"),
        };
        measuredChunks.set(chunkPath, read);
      }
      sizes[chunk] = read.size;
      contents[chunk] = read.content;
    }
    return { sizes, contents, missing };
  }
  /*
    Each chunk is compressed once per run, however many routes list it. Row 1 measures every paper
    route, and most chunks are shared by all of them; brotli at its default quality compressed the
    same framework chunks once per route and took the gate's own test past its 5 s limit.
  */
  const measuredChunks = new Map<
    string,
    { size: { raw: number; gzip: number; brotli: number }; content: string }
  >();

  // -------------------------------------------------------------------------
  // Row 1: Initial reading route JavaScript budget (<= 204,800 bytes)
  // -------------------------------------------------------------------------
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
  /*
    EVERY READING ROUTE, NOT ONE OF THEM. This measured "/", "/papers" and
    "/papers/brownian-motion". Brownian motion has its own app route, so "/papers/[paper]" (light
    quanta, special relativity, mass-energy), every section page and every face page shipped with
    no JavaScript budget at all. Measured on live b73d967a they load the same entry scripts as
    Brownian today (169,594 bytes brotli for a module browser; the 41,343-byte polyfills chunk is
    noModule), so nothing is hidden now, but nothing would have noticed them diverging. Every page
    route under /papers/ in the build's manifest is measured, so a route added later is too. With
    no manifest the list falls back to the three, and the rows below say no build was measured.
  */
  const paperPageRoutes = Object.keys(appManifest.pages)
    .filter((key) => /(^|\/)page$/.test(key))
    .map(normalizeAppManifestKey)
    .filter((route) => route.startsWith("/papers/"))
    .sort();
  const measuredRoutes = [
    "/",
    "/papers",
    ...(paperPageRoutes.length > 0 ? paperPageRoutes : ["/papers/brownian-motion"]),
  ];

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
        chunkContents: measured.contents,
      });
      if (!res.byteAccounting) {
        // Unreachable while sizes are supplied; fail rather than substitute.
        row1Passed = false;
        routeNotes.push(`${route}: byte accounting unavailable despite supplied chunk sizes`);
        continue;
      }
      scriptBytes = res.byteAccounting.effectiveBytes;
      const htmlCssBytes = readRouteHtmlCssBytes(root, route);
      if (htmlCssBytes === null) {
        totalBytes = scriptBytes;
        routeNotes.push(
          `${route}: total transfer is JavaScript only; out/ holds no HTML for this route`,
        );
      } else {
        totalBytes = scriptBytes + htmlCssBytes;
      }
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
  // The budget is for the LARGEST paper's reading face with every reading rendered,
  // so the row measures the built pages and takes the maximum. It used to measure
  // "<p>Einstein 1905 Brownian motion paper text</p>".repeat(500) - 500 copies of one
  // sentence, which gzips to 203 bytes against a 250,000 byte budget and can never
  // fail. The real Brownian face is 246,244 bytes gzipped, 98% of budget (am-uxh9).
  //
  // THE ROW LOOKED IN THE WRONG PLACE AND SO MEASURED NOTHING. It read
  // `.next/server/app/papers` for `*.html` at the top level. next.config sets `output: "export"`,
  // so the build emits static HTML to `out/`, and `.next/server/app` holds no .html at all -
  // measured: zero, anywhere beneath it. The row therefore took its "no built reading face" branch
  // on every run and failed. Failing was the honest response to an unmeasured budget, and it is why
  // this gate was red; but the budget itself went unevaluated, and the comment above quoting
  // 246,244 bytes describes a measurement this code has not been able to take.
  //
  // The faces are `out/papers/<paper>/index.html`. The per-section pages beneath them
  // (`out/papers/<paper>/s4/index.html`) are not the reading face and are not measured.
  //
  // STALENESS IS DELIBERATELY NOT CHECKED HERE. out/ can describe an older commit, and a first
  // draft of this fix called checkOutFreshness to refuse that. It was backed out: the same call
  // returned fresh under `bun test` and stale under a direct invocation, so the gate's verdict
  // depended on its runner, which is a worse failure than the one it was meant to prevent. out/
  // freshness is already enforced separately in the node lane (src/testing/outFreshness.ts).
  //
  // EVERY FACE, SINCE DISPATCH 254. Measuring only out/papers/<paper>/index.html left every /view/
  // face unmeasured: on live 2026-09-26 relativity's German face was 305,480 bytes gzipped and its
  // gloss 789,888, while this row passed. scripts/perf/readingFaces.ts now lists the default page,
  // every out/papers/<paper>/view/<face>/, and each section's gloss page. A face over the budget
  // that perf/readingFaceRecords.json records, with its size and reason, fails when it grows past
  // that size; any other face over 250,000 fails. The budget itself is unchanged.
  const readingFaceDir = resolve(root, "out/papers");
  const measuredFaces = measureBuiltReadingFaces(root);

  if (opts.plantViolationRow === 2) {
    const planted = measureReadingFace(randomBytes(300_000).toString("base64"));
    recordMetric(
      "reading-face-html",
      !planted.overBudget,
      planted.budgetBytes,
      planted.gzipBytes,
      "bytes",
      `Planted violation: ${planted.gzipBytes} bytes gzipped (raw ${planted.rawBytes})`,
    );
  } else if (measuredFaces.length === 0) {
    // No build, so nothing to measure. This must NOT read as a pass: a budget row
    // that reports success without opening a page is the defect this row had.
    recordMetric(
      "reading-face-html",
      false,
      READING_FACE_BUDGET_BYTES,
      0,
      "bytes",
      `No built reading face found under ${relative(root, readingFaceDir)}; run the production build before this gate. Measuring nothing is not passing.`,
    );
  } else {
    const verdict = readingFaceVerdict(measuredFaces, loadReadingFaceRecords(root));
    // The row's value is a face the budget holds: on a pass, the largest face not recorded (so
    // "within budget" is literally true of it), and on a failure, the worst failing face.
    const shown = verdict.ok ? verdict.heldToBudget : verdict.worstFailure;
    recordMetric(
      "reading-face-html",
      verdict.ok,
      READING_FACE_BUDGET_BYTES,
      shown?.gzipBytes ?? 0,
      "bytes",
      verdict.ok
        ? `${verdict.measured} built reading faces, each within ${READING_FACE_BUDGET_BYTES} bytes gzipped or its recorded size (${READING_FACE_RECORDS_PATH}); the largest held to the budget is ${shown?.name ?? "none"} at ${shown?.gzipBytes ?? 0}, and the largest recorded ${verdict.largest?.name ?? "none"} at ${verdict.largest?.gzipBytes ?? 0}.`
        : `${verdict.failures.length} of ${verdict.measured} built reading faces fail: ${verdict.failures.join("; ")}`,
    );
  }

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
    visibleTextResult.ok
      ? "MathML and R1 present (evaluated against an inline sample, not a built page)"
      : visibleTextResult.violations.join("; "),
    opts.plantViolationRow === 3 ? undefined : ("not-available" as const),
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
      `p75 latency ${interactionLatencyResult.p75LatencyMs} ms across ${interactionLatencyResult.interactionCount} synthetic interactions; no browser was driven`,
      opts.plantViolationRow === 4 ? undefined : ("not-available" as const),
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
    `Max window shift score ${layoutShiftResult.maxSessionWindowScore} from a synthetic shift list; no page was rendered`,
    opts.plantViolationRow === 5 ? undefined : ("not-available" as const),
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
    `Total feedback time ${instrumentFeedbackResult.maxFeedbackMs} ms from synthetic marks; no instrument was operated`,
    opts.plantViolationRow === 6 ? undefined : ("not-available" as const),
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
    `Median frame interval ${frameTimingResult.medianMs} ms, tail fraction ${(frameTimingResult.longFraction * 100).toFixed(1)}%; physics digest matched=${physicsCheck.matched}; intervals are synthetic, no frames were rendered`,
    opts.plantViolationRow === 7 || opts.plantViolationPhysics
      ? undefined
      : ("not-available" as const),
  );

  // -------------------------------------------------------------------------
  // Row 8: Resource lifecycle (external check, am-plat-resource-stress-9zgu)
  // -------------------------------------------------------------------------
  // This row asserted true with a hardcoded "no-leak" on both sides and measured nothing at all.
  // The external contract it names is not read here, so this process has no basis for a verdict.
  recordMetric(
    "resource-lifecycle",
    false,
    "no-leak",
    "not-measured",
    "status",
    "Resource lifecycle is checked by am-plat-resource-stress-9zgu, which this process does not run or read. No verdict is reached here.",
    "not-available" as const,
  );

  // -------------------------------------------------------------------------
  // Generate & Write PerfReport
  // -------------------------------------------------------------------------
  // A not-available row is not a failure, so it does not turn the chain red for a measurement this
  // process cannot take. It is also not a pass, so the summary states the coverage plainly rather
  // than letting eight green-looking rows imply eight measurements.
  // The floor, before any verdict is computed: a run that could not measure its build-dependent
  // rows has nothing to say about the budgets, and saying "pass" is the failure mode this exists
  // for. Named rows rather than a count, for the reason recorded on BUILD_DEPENDENT_ROWS.
  const unmeasured = unmeasuredBuildRows(metrics);
  const overallPassed = failedMetrics.length === 0 && unmeasured.length === 0;
  const measuredCount = Object.keys(metrics).length - notAvailableMetrics.length;
  if (unmeasured.length > 0) {
    console.error(
      `[run-perf-budgets] REFUSED: ${unmeasured.length} build-dependent row(s) reached no verdict: ` +
        `${unmeasured.join(", ")}. This run measured nothing it can be held to; it is not a budget ` +
        `result. Rebuild out/ and re-run, and do not run this while a build is writing.`,
    );
  }
  console.log(
    `[run-perf-budgets] ${measuredCount} of ${Object.keys(metrics).length} rows reached real build output; ` +
      `${notAvailableMetrics.length} reported not-available` +
      (notAvailableMetrics.length > 0 ? `: ${notAvailableMetrics.join(", ")}` : ""),
  );
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
