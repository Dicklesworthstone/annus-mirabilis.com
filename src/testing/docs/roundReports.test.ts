import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { ComprehensionLogger } from "../../comprehension/logger.ts";
import {
  findCrossReportRecurrenceViolations,
  type ParsedRoundReport,
  RoundReportValidationError,
  validateRoundReportText,
} from "./roundReports.ts";

const rootDir = process.cwd();
const logger = new ComprehensionLogger(undefined, rootDir);

function logCheck(
  testId: string,
  file: string,
  check: string,
  pass: boolean,
  message: string,
): void {
  logger.logStructural({
    suite: "round-reports",
    testId,
    file,
    check,
    outcome: pass ? "pass" : "fail",
    message,
  });
  assert.equal(pass, true, message);
}

const VALID_FIXTURE = `---
paper: brownian-motion
route: no-algebra
date: "2027-04-12"
buildCommit: "e120a5e93965e1e8ddef22772ea18dd402977145ba007204e96f229dfeda966c"
anchors:
  - "#s4-diffusion-equation"
  - "bm-01:step-drag"
facilitator: open-comprehension-brownian-motion
---

# Round Report

Participants:
- \`brownian-motion-no-algebra-20270412-01\`
- \`brownian-motion-no-algebra-20270412-02\`

Notes on session.
`;

describe("roundReports schema and validation", () => {
  it("a fixture report with complete front matter passes validation", () => {
    const parsed = validateRoundReportText(VALID_FIXTURE, "fixtures/round-valid.md");
    assert.equal(parsed.frontMatter.paper, "brownian-motion");
    assert.equal(parsed.frontMatter.route, "no-algebra");
    assert.equal(parsed.frontMatter.date, "2027-04-12");
    assert.equal(parsed.participantCodes.length, 2);
    logCheck(
      "round-valid-fixture",
      "fixtures/round-valid.md",
      "valid fixture passes",
      true,
      "Valid fixture passed.",
    );
  });

  it("missing buildCommit fails with file and line", () => {
    const badFixture = `---
paper: brownian-motion
route: no-algebra
date: "2027-04-12"
anchors:
  - "#s4-diffusion-equation"
facilitator: open-comprehension-brownian-motion
---

# Report
`;
    assert.throws(
      () => validateRoundReportText(badFixture, "docs/comprehension/rounds/bad-commit.md"),
      (err: unknown) => {
        return (
          err instanceof RoundReportValidationError &&
          err.code === "missing-build-commit" &&
          err.file === "docs/comprehension/rounds/bad-commit.md" &&
          err.line === 1
        );
      },
    );
  });

  it("unknown route fails with file and line", () => {
    const badFixture = `---
paper: brownian-motion
route: skimming
date: "2027-04-12"
buildCommit: "e120a5e93965e1e8ddef22772ea18dd402977145ba007204e96f229dfeda966c"
anchors:
  - "#s4-diffusion-equation"
facilitator: open-comprehension-brownian-motion
---

# Report
`;
    assert.throws(
      () => validateRoundReportText(badFixture, "docs/comprehension/rounds/bad-route.md"),
      (err: unknown) => {
        return (
          err instanceof RoundReportValidationError &&
          err.code === "invalid-route" &&
          err.file === "docs/comprehension/rounds/bad-route.md" &&
          err.line === 3
        );
      },
    );
  });

  it("facilitator ID containing an at sign fails with file and line", () => {
    const badFixture = `---
paper: brownian-motion
route: no-algebra
date: "2027-04-12"
buildCommit: "e120a5e93965e1e8ddef22772ea18dd402977145ba007204e96f229dfeda966c"
anchors:
  - "#s4-diffusion-equation"
facilitator: researcher@example.com
---

# Report
`;
    assert.throws(
      () => validateRoundReportText(badFixture, "docs/comprehension/rounds/bad-fac.md"),
      (err: unknown) => {
        return (
          err instanceof RoundReportValidationError &&
          err.code === "facilitator-contains-email" &&
          err.file === "docs/comprehension/rounds/bad-fac.md" &&
          err.line === 8
        );
      },
    );
  });

  it("an embedded email address fails with file and line", () => {
    const badFixture = `---
paper: brownian-motion
route: no-algebra
date: "2027-04-12"
buildCommit: "e120a5e93965e1e8ddef22772ea18dd402977145ba007204e96f229dfeda966c"
anchors:
  - "#s4-diffusion-equation"
facilitator: open-comprehension-brownian-motion
---

# Report
Contact participant at jane.doe@example.org for follow-up.
`;
    assert.throws(
      () => validateRoundReportText(badFixture, "docs/comprehension/rounds/email-leak.md"),
      (err: unknown) => {
        return (
          err instanceof RoundReportValidationError &&
          err.code === "privacy-email-detected" &&
          err.file === "docs/comprehension/rounds/email-leak.md" &&
          err.line === 12
        );
      },
    );
  });

  it("a participant code the parser rejects fails with file and line", () => {
    const badFixture = `---
paper: brownian-motion
route: no-algebra
date: "2027-04-12"
buildCommit: "e120a5e93965e1e8ddef22772ea18dd402977145ba007204e96f229dfeda966c"
anchors:
  - "#s4-diffusion-equation"
facilitator: open-comprehension-brownian-motion
---

# Report
Participant \`brownian-motion-no-algebra-20270412-7\` completed the session.
`;
    assert.throws(
      () => validateRoundReportText(badFixture, "docs/comprehension/rounds/bad-code.md"),
      (err: unknown) => {
        return (
          err instanceof RoundReportValidationError &&
          err.code === "invalid-participant-code" &&
          err.file === "docs/comprehension/rounds/bad-code.md" &&
          err.line === 12
        );
      },
    );
  });

  /**
   * The front-matter branches, all eight of which a plant sweep found
   * deletable with this file green (am-muyh). The suite tested the fields a
   * report is most likely to get wrong and left the shape of the document
   * itself unguarded: a report with no front matter at all would have been
   * accepted by a validator that had lost the check.
   */
  it("refuses a document with no front matter, and one whose front matter never closes", () => {
    let thrown: unknown;
    try {
      validateRoundReportText("# Round Report\n\nNo front matter here.\n", "fixtures/a.md");
    } catch (err) {
      thrown = err;
    }
    logCheck(
      "front-matter-missing",
      "fixtures/a.md",
      "missing-front-matter",
      thrown instanceof RoundReportValidationError && thrown.code === "missing-front-matter",
      `expected missing-front-matter, got ${thrown instanceof Error ? thrown.message : String(thrown)}`,
    );

    let unclosed: unknown;
    try {
      validateRoundReportText("---\npaper: brownian-motion\nroute: no-algebra\n", "fixtures/b.md");
    } catch (err) {
      unclosed = err;
    }
    logCheck(
      "front-matter-unclosed",
      "fixtures/b.md",
      "unclosed-front-matter",
      unclosed instanceof RoundReportValidationError && unclosed.code === "unclosed-front-matter",
      `expected unclosed-front-matter, got ${unclosed instanceof Error ? unclosed.message : String(unclosed)}`,
    );
  });

  it("refuses front matter that is not a mapping, and front matter that is not YAML", () => {
    let notMapping: unknown;
    try {
      validateRoundReportText(
        "---\n- brownian-motion\n- no-algebra\n---\n\n# R\n",
        "fixtures/c.md",
      );
    } catch (err) {
      notMapping = err;
    }
    assert.ok(
      notMapping instanceof RoundReportValidationError,
      `expected a validation error, got ${String(notMapping)}`,
    );
    assert.ok(
      ["invalid-front-matter", "malformed-front-matter-yaml"].includes(notMapping.code),
      `a YAML sequence is not a round report's front matter; got ${notMapping.code}`,
    );

    // A duplicate key is the shape this project's YAML reader refuses
    // outright. An unterminated quote is not: it parses to a string, which is
    // why the first draft of this test passed without ever reaching the
    // malformed-YAML branch.
    let malformed: unknown;
    try {
      validateRoundReportText(
        "---\npaper: brownian-motion\npaper: mass-energy\n---\n\n# R\n",
        "fixtures/d.md",
      );
    } catch (err) {
      malformed = err;
    }
    logCheck(
      "front-matter-malformed-yaml",
      "fixtures/d.md",
      "malformed-front-matter-yaml",
      malformed instanceof RoundReportValidationError &&
        malformed.code === "malformed-front-matter-yaml",
      `expected malformed-front-matter-yaml, got ${malformed instanceof Error ? malformed.message : String(malformed)}`,
    );
  });

  it("refuses an unknown paper, a malformed date, empty anchors, and a missing facilitator", () => {
    const cases: readonly (readonly [string, string, string])[] = [
      ["paper: brownian-motion", "paper: molecular-dimensions-slice", "invalid-paper"],
      ['date: "2027-04-12"', 'date: "12 April 2027"', "invalid-date"],
      [
        'anchors:\n  - "#s4-diffusion-equation"\n  - "bm-01:step-drag"',
        "anchors: []",
        "missing-anchors",
      ],
      [
        "facilitator: open-comprehension-brownian-motion",
        'facilitator: "  "',
        "missing-facilitator",
      ],
    ];
    for (const [find, replace, code] of cases) {
      assert.ok(VALID_FIXTURE.includes(find), `fixture must contain ${JSON.stringify(find)}`);
      let thrown: unknown;
      try {
        validateRoundReportText(VALID_FIXTURE.replace(find, replace), "fixtures/e.md");
      } catch (err) {
        thrown = err;
      }
      logCheck(
        `front-matter-${code}`,
        "fixtures/e.md",
        code,
        thrown instanceof RoundReportValidationError && thrown.code === code,
        `expected ${code} for ${JSON.stringify(replace)}, got ${thrown instanceof Error ? thrown.message : String(thrown)}`,
      );
    }
  });

  it("validates all markdown files under docs/comprehension/rounds/", () => {
    // Only a missing directory is tolerated. A validation failure used to be
    // swallowed by the same catch, which made this gate green whatever the
    // reports said.
    const roundsDir = join(rootDir, "docs/comprehension/rounds");
    let files: string[];
    try {
      files = readdirSync(roundsDir).filter((f) => f.endsWith(".md") && f !== "README.md");
    } catch {
      return; // no rounds have been run yet
    }
    for (const file of files) {
      const content = readFileSync(join(roundsDir, file), "utf8");
      const parsed = validateRoundReportText(content, `docs/comprehension/rounds/${file}`);
      assert.ok(parsed.frontMatter.paper);
    }
  });

  /**
   * Barrier dispositions (PROTOCOL.md sections 14 and 15). The protocol says a
   * finding that changes nothing is not a finding; these are what make that a
   * refusal rather than a sentence.
   */
  describe("barrier dispositions", () => {
    function withBarriers(barriersYaml: string): string {
      return `---
paper: brownian-motion
route: no-algebra
date: "2027-04-12"
buildCommit: "e120a5e93965e1e8ddef22772ea18dd402977145ba007204e96f229dfeda966c"
anchors:
  - "#s4-diffusion-equation"
facilitator: open-comprehension-brownian-motion
barriers:
${barriersYaml}---

# Round Report

Participants:
- \`brownian-motion-no-algebra-20270412-01\`
`;
    }

    function expectRefusal(content: string, code: string, context: string): void {
      let thrown: unknown;
      try {
        validateRoundReportText(content, "docs/comprehension/rounds/planted.md");
      } catch (err) {
        thrown = err;
      }
      const ok =
        thrown instanceof RoundReportValidationError &&
        thrown.code === code &&
        thrown.file === "docs/comprehension/rounds/planted.md";
      logCheck(
        `barrier-${code}`,
        "docs/comprehension/rounds/planted.md",
        code,
        ok,
        `${context} must be refused with "${code}", got: ${
          thrown instanceof Error ? thrown.message : String(thrown)
        }`,
      );
    }

    it("accepts a single non-blocking barrier that no one else has reported", () => {
      const parsed = validateRoundReportText(
        withBarriers(`  - code: undefined-symbol
    anchor: "#s4-formula-2"
    met: 1
    resolved: 1
    blocking: false
    disposition: open
`),
        "docs/comprehension/rounds/ok.md",
      );
      assert.equal(parsed.barriers.length, 1);
      assert.equal(parsed.barriers[0]?.code, "undefined-symbol");
      assert.equal(parsed.barriers[0]?.bead, undefined);
    });

    it("refuses a recurrent barrier that names no bead", () => {
      expectRefusal(
        withBarriers(`  - code: omitted-inference
    anchor: "#s4-p2"
    met: 3
    resolved: 1
    blocking: false
    disposition: open
`),
        "recurrent-barrier-without-bead",
        "a barrier met by three participants",
      );
    });

    it("refuses a blocking barrier that names no bead, even when only one reader met it", () => {
      expectRefusal(
        withBarriers(`  - code: inaccessible-control
    anchor: "bm-01:step-drag"
    met: 1
    resolved: 0
    blocking: true
    disposition: open
`),
        "recurrent-barrier-without-bead",
        "a blocking barrier",
      );
    });

    it("refuses a barrier claimed fixed with no verifying round", () => {
      expectRefusal(
        withBarriers(`  - code: undefined-symbol
    anchor: "#s4-formula-2"
    met: 1
    resolved: 1
    blocking: false
    disposition: fixed
    bead: am-bm-slice-notation-tau-fix
`),
        "fixed-barrier-without-verification",
        "editing the passage without a later round",
      );
    });

    it("accepts a fixed barrier that names the round which verified it", () => {
      const parsed = validateRoundReportText(
        withBarriers(`  - code: undefined-symbol
    anchor: "#s4-formula-2"
    met: 1
    resolved: 1
    blocking: false
    disposition: fixed
    bead: am-bm-slice-notation-tau-fix
    verifiedBy: brownian-motion-no-algebra-20270615
`),
        "docs/comprehension/rounds/ok.md",
      );
      assert.equal(parsed.barriers[0]?.verifiedBy, "brownian-motion-no-algebra-20270615");
    });

    it("refuses an accepted barrier with no written reason", () => {
      expectRefusal(
        withBarriers(`  - code: too-much-at-once
    anchor: "#s5-p1"
    met: 1
    resolved: 0
    blocking: false
    disposition: accepted
    bead: am-bm-slice-scope-note
`),
        "accepted-barrier-without-reason",
        "declining to repair a barrier without saying why",
      );
    });

    it("refuses a stumbling-point code outside the closed list", () => {
      expectRefusal(
        withBarriers(`  - code: reader-was-tired
    anchor: "#s4-p2"
    met: 1
    resolved: 1
    blocking: false
    disposition: open
`),
        "unknown-stumbling-point-code",
        "an invented code, which would also be a judgement of the participant",
      );
    });

    it("refuses a barrier with no place on the page", () => {
      expectRefusal(
        withBarriers(`  - code: omitted-inference
    anchor: "somewhere in section 4"
    met: 1
    resolved: 1
    blocking: false
    disposition: open
`),
        "barrier-anchor-missing",
        "a barrier with prose instead of an anchor",
      );
    });

    it("refuses a barriers key that is not a list", () => {
      const content = VALID_FIXTURE.replace(
        "facilitator: open-comprehension-brownian-motion",
        "facilitator: open-comprehension-brownian-motion\nbarriers: none",
      );
      expectRefusal(content, "invalid-barriers", "barriers written as a scalar");
    });

    it("refuses a barriers entry that is not a mapping", () => {
      expectRefusal(
        withBarriers("  - undefined-symbol\n"),
        "invalid-barrier",
        "a bare string entry",
      );
    });

    it("refuses a disposition outside the three the protocol defines", () => {
      expectRefusal(
        withBarriers(`  - code: undefined-symbol
    anchor: "#s4-formula-2"
    met: 1
    resolved: 1
    blocking: false
    disposition: wontfix
`),
        "barrier-disposition-unknown",
        "an invented disposition",
      );
    });

    it("refuses a met count that cannot describe a participant", () => {
      // The resolved branch was covered; this is the met branch beside it,
      // which a plant sweep found deletable with this file green.
      for (const met of ["0", "-1", "1.5", '"two"']) {
        expectRefusal(
          withBarriers(`  - code: undefined-symbol
    anchor: "#s4-formula-2"
    met: ${met}
    resolved: 0
    blocking: false
    disposition: open
`),
          "barrier-counts-invalid",
          `met: ${met}`,
        );
      }
    });

    it("refuses counts that cannot describe a round", () => {
      expectRefusal(
        withBarriers(`  - code: omitted-inference
    anchor: "#s4-p2"
    met: 1
    resolved: 2
    blocking: false
    disposition: open
`),
        "barrier-counts-invalid",
        "more participants resolving a barrier than met it",
      );
    });

    it("refuses a barrier that does not say whether it blocked anyone", () => {
      expectRefusal(
        withBarriers(`  - code: omitted-inference
    anchor: "#s4-p2"
    met: 1
    resolved: 1
    disposition: open
`),
        "barrier-blocking-missing",
        "omitting the blocking flag",
      );
    });

    it("finds the same barrier in two reports recurrent, even when neither round met it twice", () => {
      const one = validateRoundReportText(
        withBarriers(`  - code: undefined-symbol
    anchor: "#s4-formula-2"
    met: 1
    resolved: 1
    blocking: false
    disposition: open
`),
        "docs/comprehension/rounds/april.md",
      );
      const two = validateRoundReportText(
        withBarriers(`  - code: undefined-symbol
    anchor: "#s4-formula-2"
    met: 1
    resolved: 0
    blocking: false
    disposition: open
`),
        "docs/comprehension/rounds/may.md",
      );

      const reports: { file: string; report: ParsedRoundReport }[] = [
        { file: "docs/comprehension/rounds/april.md", report: one },
        { file: "docs/comprehension/rounds/may.md", report: two },
      ];
      const violations = findCrossReportRecurrenceViolations(reports);
      assert.equal(violations.length, 2, violations.join("\n"));
      assert.match(violations[0] ?? "", /recurrent, but names no bead/);

      // One report is not recurrence.
      const [firstReport] = reports;
      assert.ok(firstReport);
      assert.deepEqual(findCrossReportRecurrenceViolations([firstReport]), []);
    });

    it("clears cross-report recurrence once both reports name the bead", () => {
      const withBead = `  - code: undefined-symbol
    anchor: "#s4-formula-2"
    met: 1
    resolved: 1
    blocking: false
    disposition: open
    bead: am-bm-slice-notation-tau-fix
`;
      const reports = ["april", "may"].map((month) => ({
        file: `docs/comprehension/rounds/${month}.md`,
        report: validateRoundReportText(
          withBarriers(withBead),
          `docs/comprehension/rounds/${month}.md`,
        ),
      }));
      assert.deepEqual(findCrossReportRecurrenceViolations(reports), []);
    });

    it("holds the live reports directory to cross-report recurrence too", () => {
      const roundsDir = join(rootDir, "docs/comprehension/rounds");
      let files: string[];
      try {
        files = readdirSync(roundsDir).filter((f) => f.endsWith(".md") && f !== "README.md");
      } catch {
        return;
      }
      const reports = files.map((file) => {
        const relPath = `docs/comprehension/rounds/${file}`;
        return {
          file: relPath,
          report: validateRoundReportText(readFileSync(join(roundsDir, file), "utf8"), relPath),
        };
      });
      assert.deepEqual(findCrossReportRecurrenceViolations(reports), []);
    });
  });
});
