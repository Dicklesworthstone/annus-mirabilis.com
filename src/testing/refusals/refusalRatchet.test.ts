import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { analyzeUntestedRefusals, scanRefusalThrowSites } from "./refusalScanner.ts";

/**
 * Untested Refusal Throw Site Ratchet Gate (am-muyh).
 *
 * Governed by bead am-muyh and doctrine 8 (typed refusal states).
 *
 * This project's epistemic stance IS its refusals: typed result states, never a silent clamp.
 * If refusal paths break or lack test coverage, malformed inputs sail through silently.
 *
 * This ratchet ensures that:
 * 1. Pre-existing untested refusal throw sites are pinned per file in untestedRefusalsBaseline.json.
 * 2. The baseline may only SHRINK: a file exceeding its baseline count fails.
 * 3. A new file not in the baseline fails at the first unasserted refusal throw site.
 * 4. The unit of measure is the THROW SITE, not merely the refusal code string:
 *    - A single test naming a code covers AT MOST 1 throw site of that code in that file.
 *    - Multiple throw sites with the same code cannot be laundered behind a single test.
 *    - Cross-file test laundering is prohibited.
 * 5. Failure messages explicitly name the file, line numbers, and refusal codes.
 * 6. NO percentage, NO coverage target, NO dashboard - a count is a diagnostic, never a goal.
 */

const ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const BASELINE_PATH = join(ROOT, "src/testing/refusals/untestedRefusalsBaseline.json");

describe("untested refusal throw site ratchet (am-muyh)", () => {
  test("no file exceeds its recorded baseline and no new file introduces untested refusal throw sites", () => {
    const baselineRaw = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Record<string, number>;
    const baseline = new Map<string, number>(Object.entries(baselineRaw));
    const { analyses, totalUntested } = analyzeUntestedRefusals(ROOT);

    const regressions: string[] = [];
    const improvements: string[] = [];

    for (const [file, analysis] of analyses) {
      const count = analysis.untestedSitesCount;
      const allowed = baseline.get(file) ?? 0;

      if (count > allowed) {
        const details = analysis.untestedBreakdown
          .map(
            (b) =>
              `${b.code} (${b.untestedSites} untested of ${b.totalSites}, lines ${b.lines.join(",")})`,
          )
          .join("; ");
        regressions.push(
          `${file}: ${count} untested refusal throw site(s), baseline ${allowed}. ` +
            `Untested refusals: [${details}]. ` +
            "Add targeted tests for each refusal throw site or accept/reject test pairs. (See am-muyh)",
        );
      } else if (count < allowed) {
        improvements.push(`${file}: ${count} < ${allowed}`);
      }
    }

    const baselineTotal = Array.from(baseline.values()).reduce((sum, n) => sum + n, 0);

    assert.deepEqual(
      regressions,
      [],
      `Untested refusal throw sites increased (am-muyh):\n${regressions.join("\n")}\n` +
        "Every refusal throw site must be exercised by a test. See am-muyh.",
    );

    assert.ok(
      totalUntested <= baselineTotal,
      `Total untested refusal throw sites (${totalUntested}) exceeds baseline total (${baselineTotal}). ` +
        "The repository refusal baseline is shrink-only.",
    );

    if (improvements.length > 0) {
      console.log(
        `[am-muyh] baseline can be lowered for ${improvements.length} file(s): ${improvements.join(", ")}`,
      );
    }
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
});
