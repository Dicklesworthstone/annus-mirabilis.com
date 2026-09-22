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
  type MultiSiteCode,
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
  multiSiteCodes?: readonly MultiSiteCode[],
): {
  readonly regressions: readonly string[];
  readonly slack: readonly string[];
  readonly replacementUpdates: readonly string[];
} {
  // `baseline.get(...) ?? 0` collapses two different states: a file RECORDED at zero and a file
  // that was never measured. Both then compare as `count > 0` and both were announced as
  // "increased", which is false of the second and cost an orchestrator most of a tick working
  // out that 27 files had not regressed. The comparison is right - an unbaselined file SHOULD
  // be strict - so only the wording changes.
  const recorded = baseline.get(fileRel);
  const allowed = recorded ?? 0;
  const against = recorded === undefined ? "no recorded baseline" : `baseline ${allowed}`;

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
    // Disclosed on every failing file, because a per-site number means something
    // different once a reader knows the code is repeated: under the am-ksl3 ruling an
    // uncited site under a repeated code is never credited, so "3 untested of 5" here is
    // a statement about citations as much as about tests.
    const repeated = (multiSiteCodes ?? []).filter((m) => m.sites > 1);
    const multiSuffix =
      repeated.length > 0
        ? ` One code at several sites in this file: [${repeated
            .map((m) => `${m.code} x${m.sites}, ${m.citedSites} cited`)
            .join("; ")}]. Uncited sites under a repeated code are never credited (am-ksl3).`
        : "";
    return {
      regressions: [
        `${fileRel}: ${count} untested refusal throw site(s), ${against}.${detailSuffix}${multiSuffix} ` +
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
  /**
   * The scope this gate declares to whoever reads a failure. Hoisted into a constant so the
   * test below can assert it is actually USED by the failure message: an earlier version
   * searched this file for the prose and matched its own assertion line, so stripping the note
   * from the message changed nothing and the check was vacuous. Planting found that; reading
   * did not.
   */
  /**
   * The tail of every regression failure, as a function so the scope test can CALL it rather
   * than search this file for its text. Two earlier versions of that check were vacuous: the
   * first matched the prose in its own assertion line, the second counted occurrences of the
   * constant and counted its own references. Asserting the produced STRING is the only form
   * that cannot see itself. Planting found both; reading found neither.
   */
  const regressionMessage = (): string =>
    `\nEvery refusal THROW site must be exercised by a test. See am-muyh.\n${THROW_SCOPE_NOTE}`;

  const THROW_SCOPE_NOTE =
    "SCOPE: this ratchet counts TWO shapes, not one, and the note here said one until" +
    " 2026-09-22. It counts `throw new SomeError('kebab-code')`, AND a standalone" +
    " `code:`/`kind:`/`rule:`/`refusalCode:`/`errorCode:` field carrying a kebab string," +
    " which is how a validator that RETURNS a coded refusal record is counted. Measured:" +
    " 2115 sites, 1406 reached from a throw and 709 from a returned record." +
    " What is still invisible is a validator that ACCUMULATES refusals - pushing a coded" +
    " diagnostic into a findings array with addError/addFlag instead of throwing or" +
    " returning it - so a file with no entry above may still carry untested refusals." +
    " Returning a record and accumulating one are DIFFERENT here, and conflating them is" +
    " what made the old note wrong. See am-qyys.";

  /**
   * WHAT THIS RATCHET DOES NOT COVER, measured rather than asserted (am-qyys).
   *
   * The name says "throw site" and that is exactly what it counts. A validator that
   * ACCUMULATES refusals - pushing a coded diagnostic into a findings array rather than
   * throwing - is invisible to it. checkReceipt.ts is the measured instance: more than eighty
   * addError/addFlag calls whose first argument is a refusal code, no throw site at all, and
   * absent from the baseline entirely rather than recorded as zero. Four refusal codes shipped
   * there with no targeted test and nothing reported it, because nothing was looking.
   *
   * THE RATCHET WAS NOT WIDENED, and the reason is the measurement. The accumulator population
   * cannot be defined syntactically with acceptable precision. Three predicates were run
   * against all 1393 source files and each failed in a DIFFERENT direction:
   *
   *   callee matching /^(add|push|record|...)/     caught classList.add("eq-term-active")
   *                                                and a refcount's addRef("fixture-mount")
   *   callee required to contain "error"/"flag"    missed validate.ts's report(rule, ...)
   *   any pushing function taking a code literal   caught recordMetric("interaction-latency-p75"),
   *                                                where the kebab string is a METRIC ID
   *
   * A throw carries its own semantic marker: `throw new XError(...)` says what it is. An
   * accumulator call does not, and isRefusalCode is only a kebab-case regex - so a widened
   * ratchet would count "kebab string handed to a pushing function", which includes metric
   * ids, section ids and CSS class names. A baseline generated from that predicate is a record
   * of whatever the predicate happens to match, which is the opposite of a pawl.
   *
   * So the gate declares its scope, in its name and in its failure message, and this test holds
   * the declaration to a measurement rather than to a comment. If the scanner is ever widened,
   * this goes red and whoever widened it must update what the gate claims about itself.
   */
  /**
   * A refusal code whose value is a CONDITIONAL is still a refusal code (am-utmv).
   *
   * The line patterns require a quoted literal immediately after the colon, so a code that
   * varies with state left the measurement entirely. The fixture below is the real historical
   * conversion rather than a synthetic one: license-inventory/logger.ts carried
   * `rule: "inventory-complete"` as one counted site until am-zqat made the rule depend on open
   * rights positions, after which the file measured ZERO and the slack pawl asked for its
   * baseline to be tightened to 0. The file was no better covered.
   *
   * Widened here where am-qyys's accumulator surface was not, and the difference is the reason:
   * there the question was semantic and three predicates each mismeasured; here the property is
   * still named `rule`, and a conditional over string literals is an exact AST shape.
   */
  const LITERAL_FORM = [
    "const record = {",
    '  level: "info",',
    '  rule: "inventory-complete",',
    '  message: "done",',
    "};",
  ].join("\n");
  const CONDITIONAL_FORM = [
    "const record = {",
    '  level: "info",',
    "  rule:",
    "    rights.pendingOwnerRuling > 0",
    '      ? "inventory-complete-with-open-rights-positions"',
    '      : "inventory-complete",',
    '  message: "done",',
    "};",
  ].join("\n");

  test("a conditional rule value contributes a site per literal, at that literal's line (am-utmv)", () => {
    const sites = scanRefusalThrowSites(CONDITIONAL_FORM, "scripts/license-inventory/logger.ts");
    assert.deepEqual(
      sites.map((site) => ({ line: site.line, code: site.code })),
      [
        { line: 5, code: "inventory-complete-with-open-rights-positions" },
        { line: 6, code: "inventory-complete" },
      ],
      "each branch is a distinct refusal a test must reach separately, at its own line",
    );
  });

  test("converting a literal code to a conditional does NOT reduce the count (am-utmv)", () => {
    // The defect, stated as the two measurements that used to disagree.
    const before = scanRefusalThrowSites(LITERAL_FORM, "scripts/license-inventory/logger.ts");
    const after = scanRefusalThrowSites(CONDITIONAL_FORM, "scripts/license-inventory/logger.ts");
    assert.equal(before.length, 1);
    assert.ok(
      after.length >= before.length,
      `converting to a conditional dropped the count from ${before.length} to ${after.length}`,
    );

    // And against the LIVE file, so this is tied to the tree and not only to a quoted string.
    const live = scanRefusalThrowSites(
      readFileSync(join(ROOT, "scripts/license-inventory/logger.ts"), "utf8"),
      "scripts/license-inventory/logger.ts",
    );
    assert.ok(
      live.some((site) => site.code === "inventory-complete"),
      "the live logger.ts conditional is invisible again",
    );
    assert.ok(
      live.some((site) => site.code === "inventory-complete-with-open-rights-positions"),
      "the live logger.ts only shows one branch",
    );
  });

  test("a genuinely removed site still reduces the count (am-utmv)", () => {
    // The other half. Without it the change could have been "never report fewer sites", which
    // would satisfy the test above and make the scanner blind to deletions.
    const removed = LITERAL_FORM.replace('  rule: "inventory-complete",\n', "");
    assert.ok(!removed.includes("inventory-complete"), "the fixture must really lose the site");
    assert.equal(
      scanRefusalThrowSites(removed, "scripts/license-inventory/logger.ts").length,
      0,
      "a deleted property must leave the count, or the scanner cannot see removals",
    );
  });

  test("a literal a line pattern already claimed is not counted twice (am-utmv)", () => {
    // The AST pass runs alongside the line patterns, so the same literal could arrive from
    // both. Deduplication is by line and code.
    const single = 'const d = { rule: "inventory-complete", message: "m" };';
    assert.equal(scanRefusalThrowSites(single, "scripts/x.ts").length, 1);
  });

  test("the declared scope is true: an accumulating validator is invisible to this ratchet (am-qyys)", () => {
    const relPath = "src/content/provenance/checkReceipt.ts";
    const source = readFileSync(join(ROOT, relPath), "utf8");

    // Not a vacuous fixture: it really does carry many coded accumulator refusals.
    const coded =
      source.match(/\b(?:addError|addFlag)\s*\(\s*"[a-z][a-z0-9]*(?:-[a-z0-9]+)+"/g) ?? [];
    assert.ok(coded.length > 50, `expected many coded accumulator refusals, found ${coded.length}`);

    // And the scanner sees none of them.
    assert.equal(
      scanRefusalThrowSites(source, relPath).length,
      0,
      "checkReceipt.ts now has a throw site, so the scope note above is stale",
    );

    // Which is why it is absent from the baseline rather than recorded as zero.
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
    assert.equal(
      Object.hasOwn(baseline, relPath),
      false,
      "checkReceipt.ts is in the baseline now, so the scanner can see it and this note is stale",
    );

    // The failure message must SAY so, or the gate measures a subset of its own name.
    //
    // Asserted through the IDENTIFIER rather than the prose. The first version of this searched
    // the file for the sentence and found it in its own assertion line, so removing the note
    // from the message left the test green - a check that could only ever pass. Counting uses
    // of the constant cannot match itself that way: the definition is one occurrence and the
    // failure message must supply another.
    const message = regressionMessage();
    assert.match(message, /ACCUMULATES refusals/);
    assert.match(message, /throw new SomeError/);
    assert.match(message, /am-qyys/);
  });

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
      const res = auditFileRefusalCount(
        file,
        count,
        baseline,
        analysis.untestedBreakdown,
        analysis.multiSiteCodes,
      );
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
      // "increased" is true only where a recorded number went up. A file with no recorded
      // baseline is a FIRST MEASUREMENT of a population that just became countable, which under
      // am-p465 is a different thing from growth and must not be reported as it.
      const rises = allRegressions.filter((r) => !r.includes("no recorded baseline")).length;
      const firsts = allRegressions.length - rises;
      const headline =
        firsts === 0
          ? `increased in ${rises} file(s)`
          : rises === 0
            ? `first measured in ${firsts} file(s) with no recorded baseline`
            : `increased in ${rises} file(s) and first measured in ${firsts} with no recorded baseline`;
      failureMessages.push(
        `[REGRESSION] Untested refusal throw sites ${headline}:\n` +
          allRegressions.join("\n") +
          regressionMessage(),
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

  test("a neighbouring property does not outrank a site's own first argument (planted negative)", () => {
    // THE REAL SHAPE, not a synthetic one. This is src/equations/latex/tokenize.ts:201 reduced:
    // a positional refusal whose eight-line window contains an unrelated token property below it.
    // Before the priority was corrected the scanner reported this site as "environment-end",
    // a token kind from the push six lines down, and 5 of 1434 positional sites in the tree read
    // that way. The two codes here are BOTH valid refusal codes, so nothing but the priority
    // decides which one is returned.
    const neighbourSource = `
export function readToken(word: string, stack: string[], tokens: unknown[]) {
  if (word === "end") {
    const open = stack.pop();
    if (!open) {
      throw new TokenizerError(
        "mismatched-environment",
        \`Mismatched environment at \${word}.\`,
        0,
      );
    }
    tokens.push({
      kind: "environment-end",
      value: word,
    });
  }
}
`;
    const sites = scanRefusalThrowSites(neighbourSource, "src/dummy/neighbour.ts");
    assert.equal(sites.length, 1);
    const site = sites[0];
    assert.ok(site);
    assert.equal(site.code, "mismatched-environment");
    assert.notEqual(site.code, "environment-end");

    // And the correction is not a trade: a genuine options-object refusal, which has a brace
    // where the positional form has a quoted literal, still answers with its property code.
    const optionsSource = `
export function readOther(word: string) {
  if (!word) {
    throw new TokenizerError({ kind: "unbalanced-open-brace", offset: 0 });
  }
}
`;
    const optionsSites = scanRefusalThrowSites(optionsSource, "src/dummy/options.ts");
    assert.equal(optionsSites.length, 1);
    assert.equal(optionsSites[0]?.code, "unbalanced-open-brace");
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

describe("ambiguous sites are not credited (am-ksl3, owner ruling 2026-09-21)", () => {
  // The old rule credited uncited sites from a COUNT of test blocks naming a code,
  // in line order. Three measured specimens of what that costs are in the scanner's
  // own comment. These fixtures hold the new rule in both directions, because a
  // tightening that also broke the single-site path would make every one-site file
  // worse for no reason.

  /** Two throw sites under ONE code, plus a second code with a single site. */
  const SOURCE = `
export class WidgetError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}
export function validateWidget(input: unknown, mode: string) {
  if (input === null) {
    throw new WidgetError("widget-refused", "first site");
  }
  if (input === undefined) {
    throw new WidgetError("widget-refused", "second site");
  }
  if (mode === "bad") {
    throw new WidgetError("mode-refused", "the only site for this code");
  }
  return input;
}
`;

  function build(suffix: string, testBody: string): string {
    const base = mkdtempSync(join(tmpdir(), "refusal-ambiguous-"));
    const root = join(base, `ambiguous-${suffix}`);
    mkdirSync(join(root, "src/widget"), { recursive: true });
    mkdirSync(join(root, "src/elsewhere"), { recursive: true });
    writeFileSync(join(root, "src/widget/validate.ts"), SOURCE);
    writeFileSync(join(root, "src/elsewhere/coverage.test.ts"), testBody);
    return root;
  }

  function analyse(root: string) {
    const analysis = analyzeUntestedRefusals(root).analyses.get("src/widget/validate.ts");
    assert.ok(analysis, "the fixture source must be scanned at all");
    return analysis;
  }

  /** The lines the two same-code throws sit on, read from the fixture rather than guessed. */
  const siteLines = SOURCE.split("\n")
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => line.includes('"widget-refused"'))
    .map(({ number }) => number);

  test("the fixture really does have two sites on one code and one on another", () => {
    // Reachability before the claims. If the fixture ever stopped having a repeated
    // code, every arm below would pass under either rule and prove nothing.
    assert.equal(siteLines.length, 2, "the fixture must carry a genuinely ambiguous code");
    const analysis = analyse(build("shape", "import test from 'node:test';\n"));
    assert.equal(analysis.totalSites, 3);
    assert.deepEqual(
      analysis.multiSiteCodes.map((entry) => `${entry.code}x${entry.sites}`),
      ["widget-refusedx2"],
      "the disclosure must name the repeated code and not the single-site one",
    );
  });

  test("two test blocks NAMING an ambiguous code credit neither site", () => {
    // Under the old rule this credited both, in line order, having driven neither.
    const naming = `
import test from "node:test";
import { validateWidget } from "../widget/validate.ts";
test("null is refused", () => {
  try { validateWidget(null, "ok"); } catch (err) {
    if ((err as { code?: string }).code !== "widget-refused") throw err;
  }
});
test("undefined is refused", () => {
  try { validateWidget(undefined, "ok"); } catch (err) {
    if ((err as { code?: string }).code !== "widget-refused") throw err;
  }
});
`;
    const analysis = analyse(build("naming", naming));
    const entry = analysis.untestedBreakdown.find((b) => b.code === "widget-refused");
    assert.ok(entry, "the ambiguous code must be reported as untested");
    assert.equal(entry.untestedSites, 2, "neither site is credited without a citation");
    assert.deepEqual(
      [...entry.lines].sort((a, b) => a - b),
      siteLines,
    );
  });

  test("a CITED site under an ambiguous code is still credited, and only that one", () => {
    // The other half. A tightening that credited nothing would be unusable, and the
    // citation path is the mechanism the ruling tells authors to use.
    const cited = `
import test from "node:test";
import { validateWidget } from "../widget/validate.ts";
test("null is refused (validate.ts:${siteLines[0]})", () => {
  try { validateWidget(null, "ok"); } catch (err) {
    if ((err as { code?: string }).code !== "widget-refused") throw err;
  }
});
`;
    const analysis = analyse(build("cited", cited));
    const entry = analysis.untestedBreakdown.find((b) => b.code === "widget-refused");
    assert.ok(entry, "the uncited sibling must still be reported");
    assert.equal(entry.untestedSites, 1, "the cited site is credited; the other is not");
    assert.deepEqual(entry.lines, [siteLines[1]]);
    assert.equal(
      analysis.multiSiteCodes.find((m) => m.code === "widget-refused")?.citedSites,
      1,
      "the disclosure must say how many of the sites carry a citation",
    );
  });

  test("a SINGLE-site code is unchanged: naming it still credits it", () => {
    // The path that must NOT tighten. There is no second site to confuse it with, and
    // requiring a citation here would add debt to every one-site file in the tree for
    // no gain. If this ever goes red the ruling has been over-applied.
    const naming = `
import test from "node:test";
import { validateWidget } from "../widget/validate.ts";
test("a bad mode is refused", () => {
  try { validateWidget(1, "bad"); } catch (err) {
    if ((err as { code?: string }).code !== "mode-refused") throw err;
  }
});
`;
    const analysis = analyse(build("single", naming));
    assert.equal(
      analysis.untestedBreakdown.find((b) => b.code === "mode-refused"),
      undefined,
      "a single-site code named by a test block is covered, with or without a citation",
    );
  });

  test("the rule can only raise a count, never lower one", () => {
    // Stated as an invariant rather than left to the changelog: whatever the fixture,
    // the number of credited sites under the new rule is at most the number of sites.
    // A rule that could lower a count could be used to make a failing gate pass, which
    // is the shape RH-1 names.
    const naming = `
import test from "node:test";
import { validateWidget } from "../widget/validate.ts";
test("null is refused", () => {
  try { validateWidget(null, "ok"); } catch (err) {
    if ((err as { code?: string }).code !== "widget-refused") throw err;
  }
});
`;
    const analysis = analyse(build("invariant", naming));
    assert.ok(analysis.untestedSitesCount <= analysis.totalSites);
    assert.ok(
      analysis.untestedSitesCount >= 2,
      "the two ambiguous sites must both be counted as debt here",
    );
  });
});

describe("a code in a TYPE is not a refusal site (am-r3qt)", () => {
  // Eleven phantom sites were recorded across the tree: union members and interface
  // properties whose code is a string literal TYPE. Those lines are erased before
  // anything runs, so no test could ever drive them, and a site nobody can pay stays in
  // the baseline forever and invites a meaningless test written to move a number.

  const TYPE_ONLY = `
export type Outcome =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      code: "widget-refused";
      reason: string;
    }>;

export interface Diagnostic {
  readonly recordId: string;
  readonly rule: "length-exceeded" | "overflow";
}
`;

  const VALUE_FORM = `
export function check(input: unknown) {
  if (input === null) {
    return { ok: false, code: "widget-refused", reason: "null input" };
  }
  return { ok: true };
}
`;

  const THROW_FORM = `
export type Outcome = Readonly<{ ok: false; code: "widget-refused" }>;
export function check(input: unknown) {
  if (input === null) {
    throw new WidgetError("widget-refused", "null input");
  }
  return input;
}
`;

  test("a string-literal code in a type declaration records NO site", () => {
    const sites = scanRefusalThrowSites(TYPE_ONLY, "src/fixture/types.ts");
    assert.deepEqual(
      sites.map((s) => `${s.code}@${s.line}`),
      [],
      "a type member is not a refusal anyone can drive",
    );
  });

  test("THE CONTROL: the same text as a VALUE still records a site", () => {
    // Without this the arm above is satisfied by a scanner that records nothing at all,
    // which would silently zero the whole ratchet.
    const sites = scanRefusalThrowSites(VALUE_FORM, "src/fixture/value.ts");
    assert.equal(sites.length, 1, JSON.stringify(sites));
    assert.equal(sites[0]?.code, "widget-refused");
  });

  test("a throw is untouched even when a type beside it declares the same code", () => {
    // Pattern 1 deliberately does not consult the exclusion: a throw is a statement and
    // cannot occur inside a type, so nothing it matches can be type-level. This pins
    // that, because the cheap way to implement the exclusion is to apply it everywhere
    // and that would start dropping real throws whose file happens to declare a union.
    const sites = scanRefusalThrowSites(THROW_FORM, "src/fixture/throw.ts");
    assert.equal(sites.length, 1, JSON.stringify(sites));
    assert.match(sites[0]?.snippet ?? "", /throw new WidgetError/);
  });

  test("an optional code member is excluded too, since `code?:` is still a type", () => {
    const optional = `
export interface Maybe {
  readonly code?: "widget-refused";
}
`;
    assert.deepEqual(scanRefusalThrowSites(optional, "src/fixture/optional.ts"), []);
  });
});

/**
 * Stale-citation ratchet (am-ksl3).
 *
 * WHAT A GREEN HERE PROVES, AND WHAT IT DOES NOT. This check proves the cited line holds
 * a site with that code. It does NOT prove the citation names the site the test actually
 * drives, because a neighbouring site sharing the code passes identically. Only running
 * the test against a mutated site establishes that, and no static check can. A green is
 * not evidence that attribution is correct.
 *
 * THE THREAT MODEL IS ACCURACY AND WASTE, NOT INFLATED COVERAGE. The scanner iterates
 * SITES and asks whether each site's line is cited, so a citation pointing at a line with
 * no site matches nothing and credits nothing. A rotted citation therefore OVER-reports
 * debt. It cannot hide debt. What it costs is real work: panes re-testing sites that
 * already had tests, because the citation naming them decayed when lines moved above it.
 * Measured at 577 findings across 41 files when this landed.
 *
 * A RATCHET, NOT A HARD GATE, because 577 cannot be repaired in one commit and a gate
 * nobody can make green gets routed around, which is how the node lane became an off
 * switch for fifty commits.
 *
 * THE PAWL IS NOT GAMEABLE BY DELETING CITATIONS, and the reason is the coupling asserted
 * below rather than good intentions: deleting a stale citation lowers this count and
 * RAISES the untested count, because the site it named loses its credit.
 */
describe("stale citation ratchet (am-ksl3)", () => {
  const CITE_BASELINE_PATH = join(ROOT, "src/testing/refusals/staleCitationsBaseline.json");

  test("no file exceeds its recorded stale-citation baseline, and no baseline is slack", () => {
    const raw = JSON.parse(readFileSync(CITE_BASELINE_PATH, "utf8")) as Record<string, number>;
    const baseline = new Map<string, number>(Object.entries(raw));
    const { citationFindings } = analyzeUntestedRefusals(ROOT);

    const perFile = new Map<string, typeof citationFindings>();
    for (const finding of citationFindings) {
      perFile.set(finding.source, [...(perFile.get(finding.source) ?? []), finding]);
    }

    const regressions: string[] = [];
    const slack: string[] = [];
    for (const [file, findings] of perFile) {
      const allowed = baseline.get(file) ?? 0;
      if (findings.length <= allowed) continue;
      // Named, never counted. A count of 577 tells whoever has to fix them nothing; the
      // hint is the lines holding a site whose code the citing block DOES name, which in
      // a uniformly drifted file is the answer rather than a clue.
      const detail = findings
        .slice(0, 12)
        .map(
          (f) =>
            `${f.testFile} cites ${f.source}:${f.citedLine} (${f.kind}${
              f.siteCode ? `, the site there is ${f.siteCode}` : ", no site there"
            }); sites for codes that block names: ${f.hint.join(",") || "none"}`,
        )
        .join("\n    ");
      regressions.push(
        `${file}: ${findings.length} citation(s) do not check out, baseline ${allowed}.\n    ${detail}` +
          (findings.length > 12 ? `\n    ... and ${findings.length - 12} more` : ""),
      );
    }
    for (const [file, allowed] of baseline) {
      const actual = perFile.get(file)?.length ?? 0;
      if (actual < allowed) {
        slack.push(`  "${file}": ${actual},   (was ${allowed})`);
      }
    }

    assert.deepEqual(
      regressions,
      [],
      `Citations that do not check out increased:\n${regressions.join("\n")}\n\n` +
        "Repoint a citation only after PLANTING: rename that one site's code and confirm " +
        "exactly the citing test goes red. Never repoint by adding the drift - a drifted " +
        "citation is a claim nobody has re-checked, and re-pointing it silently is the " +
        "laundering this ratchet exists to stop.\n" +
        "This check proves the cited line holds a site with that code. It does NOT prove " +
        "the citation names the site the test actually drives: a neighbouring site sharing " +
        "the code passes identically. (See am-ksl3)",
    );
    assert.deepEqual(
      slack,
      [],
      `Stale citations improved below baseline. Tighten staleCitationsBaseline.json:\n${slack.join("\n")}`,
    );
  });

  test("THE COUPLING: deleting a citation lowers this count and RAISES untested", () => {
    // The only thing standing between this ratchet and the cheapest way to green it.
    // Asserted on a fixture rather than trusted.
    const base = mkdtempSync(join(tmpdir(), "refusal-coupling-"));
    const SOURCE = `
export class WidgetError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}
export function check(input: unknown, mode: string) {
  if (input === null) {
    throw new WidgetError("widget-refused", "first site");
  }
  if (mode === "bad") {
    throw new WidgetError("widget-refused", "second site");
  }
  return input;
}
`;
    const withCitation = `
import test from "node:test";
import { check } from "../widget/validate.ts";
test("null is refused (validate.ts:9)", () => {
  try { check(null, "ok"); } catch (err) {
    if ((err as { code?: string }).code !== "widget-refused") throw err;
  }
});
`;
    const build = (suffix: string, body: string): string => {
      const root = join(base, `coupling-${suffix}`);
      mkdirSync(join(root, "src/widget"), { recursive: true });
      mkdirSync(join(root, "src/elsewhere"), { recursive: true });
      writeFileSync(join(root, "src/widget/validate.ts"), SOURCE);
      writeFileSync(join(root, "src/elsewhere/coverage.test.ts"), body);
      return root;
    };

    const cited = analyzeUntestedRefusals(build("cited", withCitation));
    const citedOwed = cited.analyses.get("src/widget/validate.ts")?.untestedSitesCount ?? -1;

    // Reachability before the claim: the citation must actually be crediting something,
    // or "removing it raises untested" is true of a fixture where it never counted.
    assert.equal(citedOwed, 1, "one of the two sites is credited by the citation");
    assert.deepEqual(cited.citationFindings, [], "and that citation checks out");

    const deleted = analyzeUntestedRefusals(
      build("deleted", withCitation.replace(" (validate.ts:9)", "")),
    );
    const deletedOwed = deleted.analyses.get("src/widget/validate.ts")?.untestedSitesCount ?? -1;
    assert.equal(deletedOwed, 2, "deleting the citation must cost a credit, not buy silence");
    assert.deepEqual(deleted.citationFindings, [], "and it removes nothing from this ratchet");
  });

  test("a code named inside a test title counts as named, and a longer code does not", () => {
    // The predicate behind code-mismatched. My first version required the exact quoted
    // literal and reported 236 mismatches against 59 real ones, because a block usually
    // names its code inside a larger string. The boundaries are what stop `tag` being
    // satisfied by `unknown-tag`.
    const source = `
export function f(x: unknown) {
  if (x === 1) return { ok: false, code: "unknown-tag", reason: "a" };
  if (x === 2) return { ok: false, code: "unclosed-tag", reason: "b" };
  return { ok: true };
}
`;
    const base = mkdtempSync(join(tmpdir(), "refusal-token-"));
    const root = join(base, "token");
    mkdirSync(join(root, "src/w"), { recursive: true });
    mkdirSync(join(root, "src/e"), { recursive: true });
    writeFileSync(join(root, "src/w/f.ts"), source);
    writeFileSync(
      join(root, "src/e/f.test.ts"),
      `
import test from "node:test";
import { f } from "../w/f.ts";
test("an unknown-tag is refused, named only in this title (f.ts:3)", () => {
  f(1);
});
`,
    );
    const result = analyzeUntestedRefusals(root);
    assert.deepEqual(
      result.citationFindings.map((c) => `${c.kind}@${c.citedLine}`),
      [],
      "a code named in a title is named; requiring a quoted literal would flag this",
    );
  });
});
