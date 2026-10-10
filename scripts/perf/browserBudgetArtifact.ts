/**
 * THE JOIN BETWEEN THE BROWSER AND THE BUDGET ROWS THAT HAVE NEVER REACHED ONE (am-snn0).
 *
 * am-snn0's first acceptance criterion: "Each of the five unmeasured budgets either drives a real
 * browser, renders a real page, operates a real instrument and counts real frames, or is removed
 * from `perf/profiles.json` with a written reason and a named bead for reinstating it."
 *
 * Three of the five already had everything but the browser. `visibleTextMath.ts`,
 * `interactionLatency.ts` and `layoutShift.ts` are pure, tested evaluators that implement their
 * catalogued methods exactly -- nearest-rank p75 with a 20-sample refusal, session windows with a
 * 1 s gap and a 5 s cap -- and `run-perf-budgets.ts` fed all three a SYNTHETIC input and marked the
 * result `not-available`. Both halves were present and nothing joined them.
 *
 * This module is the join's honest half: the shape of what a browser run records, and the reader
 * that decides whether a recorded run may be believed. The driver is
 * `scripts/perf/measure-browser-budgets.mjs`; the consumer is `scripts/run-perf-budgets.ts`.
 *
 * WHY EVERY ROW IS OPTIONAL. A run that drove 11 interactions has not measured p75 latency, because
 * the method demands 20 and the evaluator refuses fewer. The honest record of that run carries a
 * layout-shift row and NO latency row, and the harness then reports latency `not-available` while
 * giving layout shift a real verdict. An all-or-nothing artifact would either discard a real
 * measurement or publish a number the method does not admit, and this project has already been bitten
 * by the second: four synthetic figures sat in the `actual` column across 1,777 artifacts.
 *
 * WHY STALENESS IS CHECKED ON THE BUILD ID RATHER THAN A TIMESTAMP. The rows measure a built page, so
 * an artifact describes the build it was driven against and no other. Next writes a fresh random build
 * id per build and the static export carries it as the one directory under `out/_next/static/` that is
 * not `chunks`, `css` or `media`, so the key is read from the measured tree itself rather than from a
 * metadata file that can go stale -- `out/release.json` has named a six-day-old commit after a clean
 * build, which is exactly the failure a timestamp comparison would inherit.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const BROWSER_BUDGET_SCHEMA_VERSION = 1;
/** Artifacts sit beside the perf reports they feed, distinguished by this prefix. */
export const BROWSER_BUDGET_PREFIX = "browser-";
export const BROWSER_BUDGET_DIR = "artifacts/budgets";
/** The one command that produces an artifact, named in every unusable note. */
export const BROWSER_BUDGET_COMMAND =
  "node --experimental-strip-types scripts/perf/measure-browser-budgets.mjs";

/** Directories Next writes under `out/_next/static/` that are not the build id. */
const NOT_A_BUILD_ID = new Set(["chunks", "css", "media"]);

export type VisibleTextMathRow = Readonly<{
  ok: boolean;
  routes: number;
  mathMlCount: number;
  katexCount: number;
  offOriginFonts: number;
  violations: readonly string[];
}>;

export type InteractionLatencyRow = Readonly<{
  p75LatencyMs: number;
  interactionCount: number;
  rawEntryCount: number;
  budgetMs: number;
  overBudget: boolean;
}>;

export type LayoutShiftRow = Readonly<{
  maxSessionWindowScore: number;
  sessionWindowsCount: number;
  worstRoute: string;
  budgetScore: number;
  overBudget: boolean;
}>;

export type BrowserBudgetArtifact = Readonly<{
  schemaVersion: number;
  toolRunId: string;
  timestamp: string;
  /** The build id of the `out/` tree this run was driven against. */
  buildId: string;
  /** Engine and version, as the driver read them, so a verdict names what produced it. */
  browser: string;
  /** Viewport the rows were driven at, as `<width>x<height>`. */
  viewport: string;
  routes: readonly string[];
  visibleTextMath?: VisibleTextMathRow;
  interactionLatency?: InteractionLatencyRow;
  layoutShift?: LayoutShiftRow;
}>;

export type BrowserBudgetSource =
  | Readonly<{ usable: true; artifact: BrowserBudgetArtifact; path: string }>
  | Readonly<{
      usable: false;
      reason: "no-build" | "absent" | "malformed" | "stale";
      note: string;
    }>;

/**
 * The build id of a static export, read from the tree itself: the single directory under
 * `out/_next/static/` that is not one of Next's fixed asset directories. Null when `out/` is absent
 * or when the shape is not the one this reader understands, which is reported rather than guessed --
 * a wrong build id would silently accept a stale artifact, the one error this check exists to stop.
 */
export function readBuildId(outDir: string): string | null {
  const staticDir = join(outDir, "_next", "static");
  if (!existsSync(staticDir)) return null;
  const candidates = readdirSync(staticDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !NOT_A_BUILD_ID.has(e.name))
    .map((e) => e.name);
  // Exactly one, or the shape is not understood. Two would mean a stale directory survived a
  // rebuild and either could be the measured one.
  return candidates.length === 1 ? (candidates[0] ?? null) : null;
}

function isStringArray(v: unknown): v is readonly string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function finite(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Whether a parsed object is an artifact this reader may believe. Every field a consumer reports is
 * required; an optional ROW is either absent or complete, never half-present, because a row missing
 * its count would report a budget verdict over an unknown population.
 */
export function validateArtifact(value: unknown): readonly string[] {
  const problems: string[] = [];
  if (typeof value !== "object" || value === null) return ["not an object"];
  const a = value as Record<string, unknown>;
  if (a.schemaVersion !== BROWSER_BUDGET_SCHEMA_VERSION) {
    problems.push(
      `schemaVersion is ${String(a.schemaVersion)}, expected ${BROWSER_BUDGET_SCHEMA_VERSION}`,
    );
  }
  for (const key of ["toolRunId", "timestamp", "buildId", "browser", "viewport"]) {
    if (typeof a[key] !== "string" || (a[key] as string).length === 0) {
      problems.push(`${key} is missing or not a non-empty string`);
    }
  }
  if (!isStringArray(a.routes) || a.routes.length === 0) {
    problems.push("routes is missing or not a non-empty array of strings");
  }

  const vtm = a.visibleTextMath;
  if (vtm !== undefined) {
    const r = vtm as Record<string, unknown>;
    if (typeof r.ok !== "boolean") problems.push("visibleTextMath.ok is not a boolean");
    for (const k of ["routes", "mathMlCount", "katexCount", "offOriginFonts"]) {
      if (!finite(r[k])) problems.push(`visibleTextMath.${k} is not a finite number`);
    }
    if (!isStringArray(r.violations))
      problems.push("visibleTextMath.violations is not a string array");
  }

  const lat = a.interactionLatency;
  if (lat !== undefined) {
    const r = lat as Record<string, unknown>;
    for (const k of ["p75LatencyMs", "interactionCount", "rawEntryCount", "budgetMs"]) {
      if (!finite(r[k])) problems.push(`interactionLatency.${k} is not a finite number`);
    }
    if (typeof r.overBudget !== "boolean")
      problems.push("interactionLatency.overBudget is not a boolean");
  }

  const cls = a.layoutShift;
  if (cls !== undefined) {
    const r = cls as Record<string, unknown>;
    for (const k of ["maxSessionWindowScore", "sessionWindowsCount", "budgetScore"]) {
      if (!finite(r[k])) problems.push(`layoutShift.${k} is not a finite number`);
    }
    if (typeof r.worstRoute !== "string") problems.push("layoutShift.worstRoute is not a string");
    if (typeof r.overBudget !== "boolean") problems.push("layoutShift.overBudget is not a boolean");
  }

  if (vtm === undefined && lat === undefined && cls === undefined) {
    problems.push("no row is present, so the run measured nothing");
  }
  return problems;
}

/** Artifact file names under the budgets directory, newest-looking last (the ids sort by time). */
export function browserArtifactPaths(rootDir: string): readonly string[] {
  const dir = join(rootDir, BROWSER_BUDGET_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith(BROWSER_BUDGET_PREFIX) && f.endsWith(".json"))
    .sort()
    .map((f) => join(dir, f));
}

/**
 * The newest browser-budget artifact that describes the build now in `out/`, or the reason there is
 * none. Newest is decided by file mtime rather than by the sortable id in the name, because a name
 * can be written by hand and an mtime is what the filesystem observed.
 */
export function loadBrowserBudgets(rootDir: string, outDir?: string): BrowserBudgetSource {
  const out = outDir ?? join(rootDir, "out");
  const buildId = readBuildId(out);
  if (buildId === null) {
    return {
      usable: false,
      reason: "no-build",
      note: `no build id under ${join(out, "_next", "static")}, so no artifact can be matched to a build; run \`bun run build\` first`,
    };
  }
  const paths = [...browserArtifactPaths(rootDir)].sort(
    (a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs,
  );
  if (paths.length === 0) {
    return {
      usable: false,
      reason: "absent",
      note: `no browser-budget artifact in ${join(rootDir, BROWSER_BUDGET_DIR)}; no browser was driven. Run \`${BROWSER_BUDGET_COMMAND}\``,
    };
  }
  const malformed: string[] = [];
  const staleIds: string[] = [];
  for (const path of paths) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      malformed.push(`${path}: ${(error as Error).message}`);
      continue;
    }
    const problems = validateArtifact(parsed);
    if (problems.length > 0) {
      malformed.push(`${path}: ${problems.join("; ")}`);
      continue;
    }
    const artifact = parsed as BrowserBudgetArtifact;
    if (artifact.buildId !== buildId) {
      staleIds.push(`${path} names build ${artifact.buildId}`);
      continue;
    }
    return { usable: true, artifact, path };
  }
  if (staleIds.length > 0) {
    return {
      usable: false,
      reason: "stale",
      note: `${staleIds.length} browser-budget artifact(s) describe another build, none the current ${buildId}: ${staleIds[0]}. Re-run \`${BROWSER_BUDGET_COMMAND}\` against this build`,
    };
  }
  return {
    usable: false,
    reason: "malformed",
    note: `${malformed.length} browser-budget artifact(s) could not be read: ${malformed[0]}`,
  };
}
