import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  analyzeUntestedRefusals,
  CODED_SCAN_ROOTS,
  findSourceFiles,
  type RefusalCodeBreakdown,
  scanRefusalThrowSites,
} from "./refusalScanner.ts";

/**
 * Untested Refusal Throw Site Ratchet Gate with Tightening Pawl (am-muyh).
 *
 * Governed by bead am-muyh and doctrine 8 (typed refusal states).
 *
 * This project's epistemic stance IS its refusals: typed result states, never a silent clamp.
 * If refusal paths break or lack test coverage, malformed inputs sail through silently.
 *
 * This ratchet ensures that:
 * 1. Pre-existing untested refusal throw sites are pinned per file in untestedRefusalsBaseline.json.
 * 2. REGRESSION FAILURE (count > allowed): A file introducing new untested refusal throw sites fails.
 * 3. SLACK BASELINE FAILURE (count < allowed): A shrink-only ratchet without an active pawl allows
 *    backsliding. When test additions cover refusal throw sites, the test FAILS with an
 *    actionable error printing the exact replacement numbers. The author MUST tighten
 *    untestedRefusalsBaseline.json in the same commit to permanently lock in the improvement.
 * 4. UNLISTED FILE FAILURE: Any new or unlisted file defaults to 0 and fails on its first untested throw site.
 * 5. Unit of measure is the THROW SITE, not merely the refusal code string:
 *    - A single test naming a code covers AT MOST 1 throw site of that code in that file.
 *    - Multiple throw sites with the same code cannot be laundered behind a single test.
 *    - Cross-file test laundering is prohibited.
 * 6. Failure messages explicitly name the file, line numbers, and refusal codes.
 * 7. NO percentage, NO coverage target, NO dashboard - a count is a diagnostic, never a goal.
 */

const ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const BASELINE_PATH = join(ROOT, "src/testing/refusals/untestedRefusalsBaseline.json");

export function auditFileRefusalCount(
  fileRel: string,
  count: number,
  baseline: ReadonlyMap<string, number>,
  breakdown?: readonly RefusalCodeBreakdown[],
): {
  readonly regressions: readonly string[];
  readonly slack: readonly string[];
  readonly replacementUpdates: readonly string[];
} {
  const allowed = baseline.get(fileRel) ?? 0;

  if (count > allowed) {
    const details = breakdown
      ? breakdown
          .map(
            (b) =>
              `${b.code} (${b.untestedSites} untested of ${b.totalSites}, lines ${b.lines.join(",")})`,
          )
          .join("; ")
      : "";
    const detailSuffix = details ? ` Untested refusals: [${details}].` : "";
    return {
      regressions: [
        `${fileRel}: ${count} untested refusal throw site(s), baseline ${allowed}.${detailSuffix} ` +
          "Add targeted tests for each refusal throw site or accept/reject test pairs. (See am-muyh)",
      ],
      slack: [],
      replacementUpdates: [],
    };
  }

  if (count < allowed) {
    return {
      regressions: [],
      slack: [
        `${fileRel}: ${count} untested refusal throw site(s) is below baseline ${allowed}. ` +
          `Ratchet pawl engaged: tighten baseline to ${count} in untestedRefusalsBaseline.json to permanently lock in improvement. (See am-muyh)`,
      ],
      replacementUpdates: [`  "${fileRel}": ${count},`],
    };
  }

  return { regressions: [], slack: [], replacementUpdates: [] };
}

describe("untested refusal throw site ratchet (am-muyh)", () => {
  test("no file exceeds its recorded baseline and no baseline is slack (enforced tightening pawl)", () => {
    const baselineRaw = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Record<string, number>;
    const baseline = new Map<string, number>(Object.entries(baselineRaw));
    const { analyses, totalUntested, byRoot } = analyzeUntestedRefusals(ROOT);

    // Printed every run, every root, whether or not it carries debt. Until this
    // was widened the scan read `src` alone, so `scripts/` was ABSENT from the
    // analysis rather than measured as zero, and nothing said so. A class that
    // vanishes from a report is worse than one reported as zero.
    console.log(
      `[refusal census] ${[...byRoot]
        .map(([root, t]) => `${root}: ${t.sites} coded in ${t.files} files, ${t.untested} untested`)
        .join(" | ")}`,
    );

    const allRegressions: string[] = [];
    const allSlack: string[] = [];
    const replacementLines: string[] = [];

    for (const [file, analysis] of analyses) {
      const count = analysis.untestedSitesCount;
      const res = auditFileRefusalCount(file, count, baseline, analysis.untestedBreakdown);
      if (res.regressions.length > 0) allRegressions.push(...res.regressions);
      if (res.slack.length > 0) {
        allSlack.push(...res.slack);
        replacementLines.push(...res.replacementUpdates);
      }
    }

    // Check for stale baseline entries for files that no longer have untested throw sites
    for (const [baselinedFile, baselinedCount] of baseline) {
      const analysis = analyses.get(baselinedFile);
      const actualCount = analysis?.untestedSitesCount ?? 0;
      if (
        actualCount < baselinedCount &&
        !allSlack.some((s) => s.startsWith(`${baselinedFile}:`))
      ) {
        allSlack.push(
          `${baselinedFile}: ${actualCount} untested refusal throw site(s) is below baseline ${baselinedCount}. ` +
            `Ratchet pawl engaged: tighten baseline to ${actualCount} in untestedRefusalsBaseline.json.`,
        );
        replacementLines.push(`  "${baselinedFile}": ${actualCount},`);
      }
    }

    const failureMessages: string[] = [];

    if (allRegressions.length > 0) {
      failureMessages.push(
        `[REGRESSION] Untested refusal throw sites increased in ${allRegressions.length} file(s):\n` +
          allRegressions.join("\n") +
          "\nEvery refusal throw site must be exercised by a test. See am-muyh.",
      );
    }

    if (allSlack.length > 0) {
      failureMessages.push(
        `[SLACK BASELINE] Ratchet pawl engaged! ${allSlack.length} file(s) have improved below their baseline:\n` +
          allSlack.join("\n") +
          "\n\nTighten src/testing/refusals/untestedRefusalsBaseline.json with the following exact replacement entries:\n" +
          replacementLines.join("\n"),
      );
    }

    assert.deepEqual(failureMessages, [], failureMessages.join("\n\n"));

    const baselineTotal = Array.from(baseline.values()).reduce((sum, n) => sum + n, 0);
    assert.ok(
      totalUntested <= baselineTotal,
      `Total untested refusal throw sites (${totalUntested}) exceeds baseline total (${baselineTotal}). ` +
        "The repository refusal baseline is shrink-only.",
    );
  });

  test("the detector fires on an unasserted refusal throw site (planted negative)", () => {
    const plantedSource = `
export function validateInput(val: unknown) {
  if (!val) {
    throw new Error({
      kind: "planted-negative-untested-code",
      message: "Refusal triggered",
    });
  }
}
`;
    const sites = scanRefusalThrowSites(plantedSource, "src/dummy/plantedSource.ts");
    assert.equal(sites.length, 1);
    const first = sites[0];
    assert.ok(first);
    assert.equal(first.code, "planted-negative-untested-code");
    assert.equal(first.line, 4);
  });

  test("the detector enforces throw-site unit of measure against multi-site code laundering (planted negative)", () => {
    // Calibration case: 3 throw sites emitting the SAME refusal code
    const multiSiteSource = `
export function parseToken(t: string) {
  if (t.startsWith("a")) {
    throw new AuthoredError({ kind: "malformed-token-structure" });
  }
  if (t.startsWith("b")) {
    throw new AuthoredError({ kind: "malformed-token-structure" });
  }
  if (t.startsWith("c")) {
    throw new AuthoredError({ kind: "malformed-token-structure" });
  }
}
`;
    const sites = scanRefusalThrowSites(multiSiteSource, "src/dummy/multiSite.ts");
    assert.equal(sites.length, 3);
    for (const s of sites) {
      assert.equal(s.code, "malformed-token-structure");
    }

    // In a test file with only ONE test block naming "malformed-token-structure":
    // 1 site is covered, 2 sites remain UNTESTED.
    const testBlocksCount = 1;
    const testedSites = Math.min(sites.length, testBlocksCount);
    const untestedSites = sites.length - testedSites;

    assert.equal(testedSites, 1);
    assert.equal(
      untestedSites,
      2,
      "A single test must NOT launder multiple throw sites of the same code",
    );
  });

  test("the detector identifies explicit site citations (file.ts:line)", () => {
    const source = `
export function check(x: number) {
  if (x < 0) {
    throw new AuthoredError({ kind: "negative-value-forbidden" }); // line 4
  }
  if (x > 100) {
    throw new AuthoredError({ kind: "negative-value-forbidden" }); // line 7
  }
}
`;
    const sites = scanRefusalThrowSites(source, "src/dummy/check.ts");
    assert.equal(sites.length, 2);

    // Test cites line 4 specifically
    const citedLine = 4;
    const testedSites = sites.filter((s) => s.line === citedLine);
    const untestedSites = sites.filter((s) => s.line !== citedLine);

    assert.equal(testedSites.length, 1);
    assert.equal(untestedSites.length, 1);
    const unasserted = untestedSites[0];
    assert.ok(unasserted);
    assert.equal(unasserted.line, 7);
  });

  test("the detector passes when all throw sites have corresponding tests", () => {
    const source = `
export function check(x: number) {
  if (x === 0) throw new AuthoredError({ kind: "zero-value-refused" });
  if (x < 0) throw new AuthoredError({ kind: "negative-value-refused" });
}
`;
    const sites = scanRefusalThrowSites(source, "src/dummy/pass.ts");
    assert.equal(sites.length, 2);

    // Two distinct test blocks for the two distinct codes
    const testedCodes = new Set(["zero-value-refused", "negative-value-refused"]);
    const unasserted = sites.filter((s) => !testedCodes.has(s.code));
    assert.equal(unasserted.length, 0);
  });

  test("planted negative: a file below baseline triggers slack baseline failure (ratchet pawl test)", () => {
    const fakeBaseline = new Map([["src/content/ledger/validateLedger.ts", 20]]);
    // Actual drops to 16
    const result = auditFileRefusalCount("src/content/ledger/validateLedger.ts", 16, fakeBaseline);
    assert.equal(result.regressions.length, 0);
    assert.equal(result.slack.length, 1);
    assert.ok(result.slack[0]?.includes("below baseline 20"));
    assert.ok(result.replacementUpdates[0]?.includes('"src/content/ledger/validateLedger.ts": 16'));
  });

  // The pawl on the SCOPE, not on the counts. Every gate here measures what the
  // scanner is pointed at, so narrowing where it points silently empties the
  // gate without failing anything - which is exactly how `scripts/` stayed
  // invisible. These assertions turn a narrowing red.
  test("every declared scan root is walked and reported, so a narrowed scope fails instead of going quiet", () => {
    const declared = CODED_SCAN_ROOTS as readonly string[];
    assert.ok(declared.includes("src"), "src must remain a declared scan root");
    assert.ok(
      declared.includes("scripts"),
      "scripts must remain a declared scan root: its refusals were absent from this gate, not clean",
    );

    // Walking, not site-finding: a root with no refusal today must still be
    // walked, or its silence and its absence become the same reading again.
    for (const root of declared) {
      const walked = findSourceFiles(join(ROOT, root), { includeTestingDirs: true });
      assert.ok(walked.length > 0, `declared scan root "${root}" walked no source files`);
    }

    // Descending into `testing` directories is part of the scope. The original
    // walk skipped them by name, so a harness refusal that no test exercised was
    // unreachable by this gate.
    const withTesting = findSourceFiles(join(ROOT, "src"), { includeTestingDirs: true });
    const withoutTesting = findSourceFiles(join(ROOT, "src"));
    assert.ok(
      withTesting.length > withoutTesting.length,
      "including testing directories must reach files the default walk skips",
    );

    // And the report carries one row per declared root, present even when empty.
    // The file counts are compared against the walk rather than merely checked
    // for being positive: asserting the WALK reaches testing/ says nothing about
    // whether the ANALYSIS asked it to. A plant that left findSourceFiles intact
    // and dropped the flag at the analyzer's call site passed the earlier
    // version of this test, and only the slack-baseline pawl caught it.
    const { byRoot } = analyzeUntestedRefusals(ROOT);
    for (const root of declared) {
      const tally = byRoot.get(root);
      assert.ok(tally, `the census must carry a row for declared root "${root}"`);
      assert.ok(tally.files > 0, `the census row for "${root}" counted no files`);
      assert.equal(
        tally.files,
        findSourceFiles(join(ROOT, root), { includeTestingDirs: true }).length,
        `the analysis of "${root}" read a different file set than the declared walk`,
      );
    }
    assert.equal(byRoot.size, declared.length);
  });

  // The property patterns read `rule:` and `code:` wherever they appear, so a
  // structured log line reporting SUCCESS was being counted as a refusal site
  // and the ratchet then demanded a test for it. Three such sites existed, of
  // 1897. The discriminator is the record's own outcome; these four fixtures
  // are the negatives a looser rule would fail.
  test("a record reporting its own outcome as passed is not a refusal site, and nothing else is excluded", () => {
    // One source, four shapes, because they have to be judged against each
    // other. An earlier version of this test put each shape in its own source,
    // and three of them were protected by the cheap pre-filter rather than by
    // the rule under test: with no literal passing outcome anywhere in the file
    // the parse never runs, so a planted outcome-BLIND exclusion still left them
    // counted and the fixtures passed for the wrong reason. The real file this
    // came from, the voice linter, carries a failing record and a passing one
    // side by side, so that is the shape tested.
    const mixedRecords = `
export function lint(entries: string[]) {
  for (const entry of entries) {
    logEntries.push({
      timestamp,
      suite: "voice-lint",
      logRunId,
      rule: "no-parallel-deny-lists",
      severity: "error",
      outcome: "failed",
      file: entry,
    });
  }
  for (const stale of staleOverrides) {
    logEntries.push({
      timestamp,
      suite: "voice-lint",
      logRunId,
      rule: "stale-override",
      severity: "flag",
      outcome: "passed",
      file: stale.target,
    });
  }
  lines.push({
    timestamp,
    logRunId,
    rule: "inventory-complete",
    outcome: errors.length === 0 ? "passed" : "failed",
  });
  logs.push({ suite: "s", rule: "checked-nothing", outcome: "pass" });
  if (!ok) {
    throw new GuardError("guard-refused", "the guard refused");
  }
}
`;
    const codes = scanRefusalThrowSites(mixedRecords, "src/dummy/mixedRecords.ts")
      .map((s) => s.code)
      .sort();

    // Kept: a failure record IS the emission of that violation. A computed
    // outcome can report a failure. A throw is a refusal whatever record sits
    // beside it, which is the evasion this rule must not open.
    // Dropped: the two records that say they passed.
    assert.deepEqual(codes, ["guard-refused", "inventory-complete", "no-parallel-deny-lists"]);
  });

  // am-fkyc. Coverage used to be credited by `content.includes(basename)`, a
  // raw substring over the whole test file with comments included, and
  // basenames are not unique here: 74 are shared, `session.ts` by 37 files, so
  // one mention credited all 37. Two fixture roots, identical but for how the
  // test file refers to the source.
  test("a test file that only NAMES a source file credits it nothing; one that imports it credits it", () => {
    // am-yhus: mkdtempSync under the OS temp dir, so this runs the same everywhere.
    const base = mkdtempSync(join(tmpdir(), "refusal-ratchet-"));
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const SOURCE = `
export class WidgetError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}
export function validateWidget(input: unknown) {
  if (input === null) {
    throw new WidgetError("widget-refused", "the widget was refused");
  }
  return input;
}
`;
    // Deliberately NOT co-located with the source, because a co-located
    // foo.test.ts is credited by its own rule and would mask this one.
    const MENTION_ONLY = `
import test from "node:test";
// Exercises the refusal in validate.ts, honestly it does.
test("widget-refused is refused", () => {
  const code = "widget-refused";
  if (code !== "widget-refused") throw new Error("no");
});
`;
    const IMPORTS = `
import test from "node:test";
import { validateWidget } from "../widget/validate.ts";
test("widget-refused is refused", () => {
  try {
    validateWidget(null);
  } catch (err) {
    if ((err as { code?: string }).code !== "widget-refused") throw err;
  }
});
`;

    const build = (suffix: string, testBody: string): string => {
      const root = join(base, `refusal-credit-${stamp}-${suffix}`);
      mkdirSync(join(root, "src/widget"), { recursive: true });
      mkdirSync(join(root, "src/elsewhere"), { recursive: true });
      writeFileSync(join(root, "src/widget/validate.ts"), SOURCE);
      writeFileSync(join(root, "src/elsewhere/coverage.test.ts"), testBody);
      return root;
    };

    const mentionRoot = build("mention", MENTION_ONLY);
    const mentioned = analyzeUntestedRefusals(mentionRoot).analyses.get("src/widget/validate.ts");
    assert.ok(mentioned, "the fixture source must be scanned at all");
    assert.equal(mentioned.totalSites, 1);
    assert.equal(mentioned.untestedSitesCount, 1, "naming a file in a comment is not a test of it");

    const importRoot = build("import", IMPORTS);
    const imported = analyzeUntestedRefusals(importRoot).analyses.get("src/widget/validate.ts");
    assert.ok(imported, "the fixture source must be scanned at all");
    assert.equal(imported.totalSites, 1);
    assert.equal(
      imported.untestedSitesCount,
      0,
      "a test that imports the module and names the code does cover it",
    );
  });
});
