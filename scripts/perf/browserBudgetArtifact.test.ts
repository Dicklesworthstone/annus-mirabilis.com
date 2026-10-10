/**
 * THE READER THAT DECIDES WHETHER A BROWSER RUN MAY BE BELIEVED (am-snn0).
 *
 * Every case here is about the same hazard from a different side: a budget row that reports a verdict
 * it did not measure. The reader's job is to say "no measurement" loudly in each of the four ways one
 * can be missing -- no build to match against, no artifact, an artifact describing another build, an
 * artifact that cannot be parsed -- because the harness turns `usable: false` into `not-available`
 * and `usable: true` into a verdict that can fail a release.
 *
 * THE STALE CASE IS THE ONE THAT MATTERS and it is the only one that looks like success. An absent
 * file is obvious; an artifact from the previous build is a complete, well-formed record of real
 * measurements, and believing it reports last build's latency as this build's.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BROWSER_BUDGET_SCHEMA_VERSION,
  type BrowserBudgetArtifact,
  browserArtifactPaths,
  loadBrowserBudgets,
  readBuildId,
  validateArtifact,
} from "./browserBudgetArtifact.ts";

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "browser-budgets-"));
}

/** A built export whose `out/_next/static/` carries one build id and Next's three asset dirs. */
function fakeBuild(root: string, buildId: string | null, extraIds: readonly string[] = []): string {
  const out = join(root, "out");
  const staticDir = join(out, "_next", "static");
  for (const name of ["chunks", "css", "media"])
    mkdirSync(join(staticDir, name), { recursive: true });
  if (buildId !== null) mkdirSync(join(staticDir, buildId), { recursive: true });
  for (const id of extraIds) mkdirSync(join(staticDir, id), { recursive: true });
  return out;
}

function artifact(overrides: Partial<BrowserBudgetArtifact> = {}): BrowserBudgetArtifact {
  return {
    schemaVersion: BROWSER_BUDGET_SCHEMA_VERSION,
    toolRunId: "20261010T000000Z-abcdef01",
    timestamp: "2026-10-10T00:00:00.000Z",
    buildId: "BUILD_A",
    browser: "chromium 999.0",
    viewport: "1280x900",
    routes: ["/", "/papers/mass-energy/"],
    layoutShift: {
      maxSessionWindowScore: 0.04,
      sessionWindowsCount: 1,
      worstRoute: "/",
      budgetScore: 0.1,
      overBudget: false,
    },
    ...overrides,
  };
}

function writeArtifact(root: string, name: string, body: unknown, mtimeSeconds?: number): string {
  const dir = join(root, "artifacts", "budgets");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, `${typeof body === "string" ? body : JSON.stringify(body)}\n`, "utf8");
  if (mtimeSeconds !== undefined) utimesSync(path, mtimeSeconds, mtimeSeconds);
  return path;
}

describe("readBuildId", () => {
  test("reads the one directory that is not chunks, css or media", () => {
    const root = tempRoot();
    const out = fakeBuild(root, "l7MwvvL_CIgNw9HE7Q9d4");
    expect(readBuildId(out)).toBe("l7MwvvL_CIgNw9HE7Q9d4");
  });

  test("is null when there is no build, so no artifact can be matched to one", () => {
    const root = tempRoot();
    expect(readBuildId(join(root, "out"))).toBeNull();
  });

  test("is null when two candidates survive, rather than picking one", () => {
    // A stale directory left beside a fresh one: either could be the measured build, and guessing
    // wrong is exactly the stale-artifact acceptance this key exists to prevent.
    const root = tempRoot();
    const out = fakeBuild(root, "BUILD_A", ["BUILD_B"]);
    expect(readBuildId(out)).toBeNull();
  });
});

describe("validateArtifact", () => {
  test("accepts a complete artifact with one row", () => {
    expect(validateArtifact(artifact())).toEqual([]);
  });

  test("rejects a different schema version", () => {
    const problems = validateArtifact({ ...artifact(), schemaVersion: 2 });
    expect(problems.some((p) => p.includes("schemaVersion"))).toBe(true);
  });

  test("rejects an artifact with no row, because the run measured nothing", () => {
    const { layoutShift: _dropped, ...withoutRows } = artifact();
    expect(validateArtifact(withoutRows)).toEqual([
      "no row is present, so the run measured nothing",
    ]);
  });

  test("rejects a half-present row, which would report a verdict over an unknown population", () => {
    const problems = validateArtifact({
      ...artifact(),
      interactionLatency: { p75LatencyMs: 32, budgetMs: 200, overBudget: false },
    });
    expect(problems.some((p) => p.includes("interactionLatency.interactionCount"))).toBe(true);
    expect(problems.some((p) => p.includes("interactionLatency.rawEntryCount"))).toBe(true);
  });

  test("rejects an empty route list", () => {
    const problems = validateArtifact({ ...artifact(), routes: [] });
    expect(problems.some((p) => p.includes("routes"))).toBe(true);
  });

  test("rejects a non-object", () => {
    expect(validateArtifact(null)).toEqual(["not an object"]);
    expect(validateArtifact("{}")).toEqual(["not an object"]);
  });
});

describe("loadBrowserBudgets", () => {
  test("returns the artifact that names the current build", () => {
    const root = tempRoot();
    fakeBuild(root, "BUILD_A");
    writeArtifact(root, "browser-20261010T000000Z-aaaaaaaa.json", artifact());
    const source = loadBrowserBudgets(root);
    expect(source.usable).toBe(true);
    if (source.usable) expect(source.artifact.buildId).toBe("BUILD_A");
  });

  test("no-build when there is nothing to match against", () => {
    const root = tempRoot();
    writeArtifact(root, "browser-20261010T000000Z-aaaaaaaa.json", artifact());
    const source = loadBrowserBudgets(root);
    expect(source.usable).toBe(false);
    if (!source.usable) expect(source.reason).toBe("no-build");
  });

  test("absent when no browser artifact has been written, and names the command", () => {
    const root = tempRoot();
    fakeBuild(root, "BUILD_A");
    const source = loadBrowserBudgets(root);
    expect(source.usable).toBe(false);
    if (!source.usable) {
      expect(source.reason).toBe("absent");
      expect(source.note).toContain("measure-browser-budgets.mjs");
    }
  });

  test("STALE: a complete artifact from another build is refused, not believed", () => {
    const root = tempRoot();
    fakeBuild(root, "BUILD_B");
    writeArtifact(root, "browser-20261010T000000Z-aaaaaaaa.json", artifact({ buildId: "BUILD_A" }));
    const source = loadBrowserBudgets(root);
    expect(source.usable).toBe(false);
    if (!source.usable) {
      expect(source.reason).toBe("stale");
      expect(source.note).toContain("BUILD_A");
      expect(source.note).toContain("BUILD_B");
    }
  });

  test("malformed when the newest file is not readable JSON", () => {
    const root = tempRoot();
    fakeBuild(root, "BUILD_A");
    writeArtifact(root, "browser-20261010T000000Z-aaaaaaaa.json", "{ not json");
    const source = loadBrowserBudgets(root);
    expect(source.usable).toBe(false);
    if (!source.usable) expect(source.reason).toBe("malformed");
  });

  test("prefers the matching build over a NEWER artifact describing another one", () => {
    // Recency is not the question; which build was measured is. A newer run against a different
    // build must not shadow a valid record of this one.
    const root = tempRoot();
    fakeBuild(root, "BUILD_A");
    writeArtifact(
      root,
      "browser-20261010T000000Z-aaaaaaaa.json",
      artifact({ buildId: "BUILD_A" }),
      1_000,
    );
    writeArtifact(
      root,
      "browser-20261011T000000Z-bbbbbbbb.json",
      artifact({ buildId: "BUILD_Z" }),
      9_000,
    );
    const source = loadBrowserBudgets(root);
    expect(source.usable).toBe(true);
    if (source.usable) expect(source.artifact.buildId).toBe("BUILD_A");
  });

  test("takes the newest of two artifacts for the same build", () => {
    const root = tempRoot();
    fakeBuild(root, "BUILD_A");
    writeArtifact(root, "browser-a.json", artifact({ toolRunId: "older" }), 1_000);
    writeArtifact(root, "browser-b.json", artifact({ toolRunId: "newer" }), 9_000);
    const source = loadBrowserBudgets(root);
    expect(source.usable).toBe(true);
    if (source.usable) expect(source.artifact.toolRunId).toBe("newer");
  });

  test("browserArtifactPaths ignores the perf reports it sits beside", () => {
    const root = tempRoot();
    writeArtifact(root, "perf-20261010T000000Z-cccccccc.json", { not: "a browser artifact" });
    writeArtifact(root, "browser-20261010T000000Z-aaaaaaaa.json", artifact());
    const paths = browserArtifactPaths(root);
    expect(paths.length).toBe(1);
    expect(paths[0]).toContain("browser-20261010T000000Z-aaaaaaaa.json");
  });
});
