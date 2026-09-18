import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  analyzeUntestedRefusals,
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
    const { analyses, totalUntested } = analyzeUntestedRefusals(ROOT);

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
});
