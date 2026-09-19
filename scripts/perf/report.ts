import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface PerfReportConditions {
  hardware: string;
  browser: string;
  browserVersion: string;
  viewport: { width: number; height: number; deviceScaleFactor?: number };
  networkProfile: string;
  cacheState: "cold" | "warm";
  calibrationState: "provisional" | "measured" | "none";
  buildRevision: string;
}

export interface RouteTransferSummary {
  route: string;
  scriptTransferBytes: number;
  totalTransferBytes: number;
  encoding?: string;
  /**
   * Per-route byte accounting, carried into the report so a reader can audit the
   * budget decision from the artifact alone (am-lj8r). Before this, the report
   * recorded only the derived scriptTransferBytes, so nothing in the emitted
   * JSON showed which encoding was compared, what the raw and gzip figures were,
   * or that a byte-budget violation had been raised at all.
   */
  byteAccounting?: {
    rawBytes: number;
    gzipBytes: number;
    brotliBytes: number;
    /** The figure actually compared against the budget, in `encoding`. */
    compressedBytes: number;
    budgetBytes: number;
    overBudget: boolean;
    chunkCount: number;
  };
  /** Route-graph violations, e.g. { kind: "byte-budget", ... }, as raised by checkInitialRouteGraph. */
  violations?: readonly unknown[];
}

export interface MetricReportEntry {
  id: string;
  budget: unknown;
  actual: unknown;
  unit: string;
  passed: boolean;
  notes?: string;
}

export interface PerfReport {
  toolRunId: string;
  logRunId: string;
  timestamp: string;
  conditions: PerfReportConditions;
  routes: RouteTransferSummary[];
  metrics: Record<string, MetricReportEntry>;
  outcome: "pass" | "fail";
}

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_BUDGETS_ARTIFACTS_DIR = join(here, "../../artifacts/budgets");

export function validatePerfReport(report: PerfReport): void {
  if (!report.logRunId || typeof report.logRunId !== "string") {
    throw new Error("PerfReport missing required logRunId");
  }
  if (!report.toolRunId || typeof report.toolRunId !== "string") {
    throw new Error("PerfReport missing required toolRunId");
  }

  const c = report.conditions;
  if (!c) throw new Error("PerfReport missing conditions object");
  if (!c.hardware) throw new Error("PerfReport missing hardware condition");
  if (!c.browser) throw new Error("PerfReport missing browser condition");
  if (!c.browserVersion) throw new Error("PerfReport missing browserVersion condition");
  if (
    !c.viewport ||
    typeof c.viewport.width !== "number" ||
    typeof c.viewport.height !== "number"
  ) {
    throw new Error("PerfReport missing viewport dimensions");
  }
  if (!c.networkProfile) throw new Error("PerfReport missing networkProfile condition");
  if (!c.cacheState) throw new Error("PerfReport missing cacheState condition");
  if (!c.calibrationState) throw new Error("PerfReport missing calibrationState condition");
  if (!c.buildRevision) throw new Error("PerfReport missing buildRevision condition");

  if (!Array.isArray(report.routes)) {
    throw new Error("PerfReport routes must be an array");
  }
  for (const r of report.routes) {
    if (typeof r.scriptTransferBytes !== "number" || typeof r.totalTransferBytes !== "number") {
      throw new Error(`Route ${r.route} must report total transfer separately from JavaScript`);
    }
  }
}

export function writePerfReport(report: PerfReport, dir = DEFAULT_BUDGETS_ARTIFACTS_DIR): string {
  validatePerfReport(report);
  mkdirSync(dir, { recursive: true });
  const filename = `perf-${report.toolRunId}.json`;
  const fullPath = join(dir, filename);
  writeFileSync(fullPath, JSON.stringify(report, null, 2), "utf8");
  return fullPath;
}
