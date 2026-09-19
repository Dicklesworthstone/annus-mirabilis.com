/**
 * Bare throw ratchet (am-muyh).
 *
 * WHY THIS EXISTS, against AGENTS.md's creation gate.
 *
 * Concrete consumer: this test, and `scanBareThrows` in refusalScanner.ts,
 * which it calls on every run. Nothing here is read only by humans.
 *
 * The gate it enforces: the number of bare throw sites per file may only
 * shrink. A file above its recorded count fails; a file below it fails until
 * the baseline is tightened; a file with no entry is allowed zero, so a new
 * bare throw in a new file fails at the first occurrence. That is what stops
 * the population growing while the block is worked down.
 *
 * The observed defect class: `scanRefusalThrowSites` records a site only when
 * it can read a kebab-case refusal code off it. A throw carrying prose and no
 * code produces NO site, so it is neither tested nor untested in
 * refusalRatchet's accounting -- it is absent. Measured here on 2026-09-19:
 * 1832 coded sites and 1018 bare ones across 294 files. 36% of the refusal
 * population was invisible to the instrument that governs it, which is the
 * same failure as this bead's original headline one level down: there, a code
 * named by a test passed for a site exercised by one; here, a site with no
 * code passes for no site at all.
 *
 * Deletion condition: delete this file and bareThrowsBaseline.json when the
 * baseline is empty, or when every refusal in src/ carries a typed code and
 * refusalRatchet therefore sees the whole population. Either way the class
 * stops needing a separate census.
 *
 * WHAT IT DOES NOT CLAIM. A bare throw is not automatically a defect:
 * invariant guards and re-throws are legitimate, and this gate makes no
 * judgement about which is which. It claims only that these sites are
 * unmeasured by the code-based scanner, and it reports the count every run --
 * including when it is zero, because a class that vanishes from a report is
 * worse than one reported as zero.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  BARE_THROW_ROOTS,
  type BareThrowSite,
  scanBareThrowSites,
  scanBareThrows,
} from "./refusalScanner.ts";

const ROOT = process.cwd();
const BASELINE_PATH = "src/testing/refusals/bareThrowsBaseline.json";

function readBaseline(): Map<string, number> {
  const raw = JSON.parse(readFileSync(join(ROOT, BASELINE_PATH), "utf8")) as Record<string, number>;
  return new Map(Object.entries(raw));
}

describe("bare throw ratchet (am-muyh)", () => {
  it("reports the bare throw census every run, including if it is zero", () => {
    const scan = scanBareThrows(ROOT);

    // The report is the point. It is printed unconditionally so the class
    // cannot quietly disappear from a green run.
    const roots = [...scan.byRoot.entries()]
      .map(([r, t]) => `${r}/: ${t.bare} bare, ${t.coded} coded, ${t.files} files`)
      .join(" | ");
    console.log(
      `[bare-throw census] ${scan.totalBare} bare throw site(s) in ${scan.byFile.size} file(s); ` +
        `${scan.totalCoded} coded refusal site(s); ${scan.filesScanned} source files scanned. ` +
        `Per root -- ${roots}. ` +
        "Bare sites carry no refusal code, so refusalRatchet cannot see them.",
    );
    console.log(
      `[bare-throw refusal-path signal] ${scan.projectClassLowerBound} of ${scan.totalBare} throw a ` +
        `project-defined error class across ${scan.projectClassCounts.length} classes ` +
        `(${scan.projectClassCounts
          .slice(0, 5)
          .map(([c, n]) => `${c} ${n}`)
          .join(", ")}). ` +
        "That is a MEASURED LOWER BOUND on how much of this block is refusal path, never a total: " +
        `the remaining ${scan.builtinClassUnclassified} throw a built-in class and are UNCLASSIFIED, ` +
        "which is not the same as not being refusals. The scanner cannot separate a reader-facing " +
        "refusal from an internal invariant. See am-kfkw.",
    );

    assert.equal(typeof scan.totalBare, "number");
    assert.ok(scan.totalCoded > 0, "the coded scanner must still be finding sites");
    assert.ok(scan.filesScanned > 100, "the census must be scanning the real tree");
    assert.equal(
      scan.byFile.size === 0,
      scan.totalBare === 0,
      "a file map and a total that disagree mean the census is not measuring what it reports",
    );

    // Every declared root appears in the report, with a file count proving it
    // was walked. This assertion would have caught the first version of this
    // gate, which took its files from findSourceFiles("src") and therefore
    // reported scripts/ as absent rather than as a number.
    for (const root of BARE_THROW_ROOTS) {
      const tally = scan.byRoot.get(root);
      assert.ok(tally, `root ${root}/ is missing from the census report entirely`);
      assert.ok(
        tally.files > 0,
        `root ${root}/ reports ${tally.files} files scanned; an unwalked root reads as a clean one`,
      );
    }
    assert.equal(
      [...scan.byRoot.values()].reduce((n, t) => n + t.bare, 0),
      scan.totalBare,
      "the per-root totals must add up to the headline, or one root is uncounted",
    );

    // The refusal-path signal is reported as two classes that sum to the
    // whole. Neither may vanish, and the lower bound may never be presented
    // as the total: the unclassified remainder is the honest part of it.
    assert.equal(
      scan.projectClassLowerBound + scan.builtinClassUnclassified,
      scan.totalBare,
      "the lower bound and the unclassified remainder must sum to the bare total",
    );
    assert.ok(
      scan.projectClassLowerBound > 0,
      "a lower bound of zero means the classifier is broken, not that the codebase " +
        "defines no refusal error classes; it defines dozens",
    );
    assert.ok(
      scan.projectClassLowerBound < scan.totalBare,
      "if every bare throw carried a project class the lower bound would be a total, " +
        "and this test's framing would need revisiting rather than quietly holding",
    );
    assert.equal(
      scan.projectClassCounts.reduce((n, [, c]) => n + c, 0),
      scan.projectClassLowerBound,
      "the per-class breakdown must account for every project-class site",
    );
  });

  it("no file exceeds its recorded bare throw count, and no count is slack", () => {
    const baseline = readBaseline();
    const scan = scanBareThrows(ROOT);

    const regressions: string[] = [];
    const slack: string[] = [];
    const replacements: string[] = [];

    for (const [file, sites] of scan.byFile) {
      const allowed = baseline.get(file) ?? 0;
      if (sites.length > allowed) {
        const added = sites.slice(allowed).map((s) => `${s.line}: ${s.snippet}`);
        regressions.push(
          `${file}: ${sites.length} bare throw site(s), recorded ${allowed}.\n` +
            `    ${added.join("\n    ")}\n` +
            "    Give the new refusal a typed code so refusalRatchet can see it, " +
            "or lower an existing bare throw in the same file.",
        );
      } else if (sites.length < allowed) {
        slack.push(`${file}: ${sites.length} < ${allowed}`);
        replacements.push(`  "${file}": ${sites.length},`);
      }
    }

    for (const [file, allowed] of baseline) {
      if (scan.byFile.has(file)) continue;
      slack.push(`${file}: 0 < ${allowed} (no bare throws remain; remove the entry)`);
      replacements.push(`  remove "${file}"`);
    }

    const messages: string[] = [];
    if (regressions.length > 0) {
      messages.push(
        `[REGRESSION] Bare throw sites increased in ${regressions.length} file(s):\n` +
          regressions.join("\n"),
      );
    }
    if (slack.length > 0) {
      messages.push(
        `[SLACK BASELINE] ${slack.length} file(s) improved below the recorded count:\n` +
          `${slack.join("\n")}\n\nTighten ${BASELINE_PATH} in this same commit:\n` +
          `${replacements.join("\n")}\n` +
          "A count left above the real one is pre-authorised headroom for a future regression.",
      );
    }

    assert.deepEqual(messages, [], messages.join("\n\n"));
  });

  it("the detector separates a bare throw from a coded one", () => {
    const coded = `
      throw new InventoryHonestyError("alias-record-invalid", "Invalid alias record");
    `;
    assert.deepEqual(scanBareThrowSites(coded, "src/x.ts"), []);

    const codedByProperty = `
      throw new RefusalError({ code: "buffer-shape-mismatch", message: "bad shape" });
    `;
    assert.deepEqual(scanBareThrowSites(codedByProperty, "src/x.ts"), []);

    const bare = `
      throw new TypeError("Concurrent requests to a single walk owner.");
    `;
    const found: readonly BareThrowSite[] = scanBareThrowSites(bare, "src/x.ts");
    assert.equal(found.length, 1);
    assert.equal(found[0]?.line, 2);
    assert.match(found[0]?.snippet ?? "", /Concurrent requests/);

    // A re-throw is not a site: it introduces no new refusal.
    assert.deepEqual(scanBareThrowSites("      throw err;\n", "src/x.ts"), []);
    assert.deepEqual(scanBareThrowSites("      throw error;\n", "src/x.ts"), []);
  });

  it("the baseline names real files and real counts", () => {
    // A baseline entry for a file that no longer exists, or a negative count,
    // is headroom that no scan can ever reclaim.
    const baseline = readBaseline();
    assert.ok(baseline.size > 0, "an empty baseline means this gate should be deleted, not kept");
    for (const [file, count] of baseline) {
      assert.ok(
        Number.isInteger(count) && count > 0,
        `${file}: baseline must be a positive integer`,
      );
      assert.doesNotThrow(
        () => readFileSync(join(ROOT, file), "utf8"),
        `${file} is in the baseline but not on disk`,
      );
    }
  });
});
