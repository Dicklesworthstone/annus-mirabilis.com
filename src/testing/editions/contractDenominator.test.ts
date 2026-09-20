/**
 * The edition contract states its denominator, and check 8 refuses to bless an empty set
 * (am-edn-alignment-tooling-do1, Unit 1).
 *
 * WHAT WAS WRONG. Check 8 read:
 *
 *     if (edges.length > 0 || (options.englishIds && options.englishIds.length > 0)) {
 *       ...validate...
 *     }
 *     checks.push({ outcome: check8Passed ? "passed" : "failed",
 *                   message: "Alignment coverage and edge validity verified." });
 *
 * With zero German units, zero English units and zero edges the guard was skipped and the
 * check reported `passed` with the word "verified". Nothing had been examined. That is a
 * gate printing PASSED on an empty set, in the harness every paper's edition tests call.
 *
 * WHAT REPLACES IT. The empty population declines with `alignment-population-empty`, and
 * every run carries a denominator on both axes: how many of the fifteen checks reached a
 * verdict and why the rest did not, and how many alignable units were aligned out of how
 * many were supplied. A harness that reports only its successes cannot be told apart from
 * one that examined nothing.
 */
import { describe, expect, test } from "bun:test";
import {
  assertEditionContract,
  CONTRACT_CHECKS_SPEC,
} from "../../content/editions/editionContract.ts";

const LEDGER = `--- REVIEWED TRANSCRIPTION PAGE 1 OF 1 ---
[[PAGE 639]]
[[HEADING s1]]
Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?
[[DATELINE]]
Bern, den 27. September 1905.
`;

describe("edition contract denominator (am-edn-alignment-tooling-do1)", () => {
  test("an empty alignment population is declined, not verified", () => {
    const r = assertEditionContract("mass-energy", {
      ledgerText: LEDGER,
      germanIds: [],
      englishIds: [],
      edges: [],
    });
    const c8 = r.checks.find((c) => c.checkNumber === 8);
    expect(c8?.outcome).toBe("not-available");
    expect(c8?.code).toBe("alignment-population-empty");
    // Assert the CLAIM is gone, not a word. The message honestly says "nothing is
    // verified", which a bare not.toContain("verified") would have failed - a substring
    // assertion standing in for the property, which is the thing this campaign has been
    // about. The exact sentence the defect emitted is what must never appear again.
    expect(c8?.message).not.toContain("Alignment coverage and edge validity verified");
    expect(c8?.message).toContain("0 German alignable units");
    expect(c8?.message).toContain("Nothing was examined");
  });

  test("the denominator names what was given, aligned, and left unaligned", () => {
    const r = assertEditionContract("mass-energy", {
      ledgerText: LEDGER,
      germanIds: ["s1", "closing-dateline"],
      englishIds: ["s1", "closing-dateline"],
      edges: [{ sourceId: "s1", targetId: "s1" }],
    });
    const d = r.denominator;
    expect(d.germanUnitsGiven).toBe(2);
    expect(d.germanUnitsAligned).toBe(1);
    expect(d.germanUnitsUnaligned).toEqual(["closing-dateline"]);
    expect(d.englishUnitsGiven).toBe(2);
    expect(d.englishUnitsAligned).toBe(1);
    expect(d.englishUnitsUnaligned).toEqual(["closing-dateline"]);
    expect(d.edgesGiven).toBe(1);
  });

  test("the denominator accounts for every one of the fifteen checks", () => {
    const r = assertEditionContract("mass-energy", { ledgerText: LEDGER });
    const d = r.denominator;
    expect(d.checksSpecified).toBe(CONTRACT_CHECKS_SPEC.length);
    expect(d.checksSpecified).toBe(15);
    // Judged plus declined must exhaust the numbered checks: a check that is neither is a
    // check nobody can account for.
    const numbered = r.checks.filter((c) => c.checkNumber !== undefined);
    expect(d.checksJudged + d.checksDeclined).toBe(numbered.length);
  });

  test("every declined check gives its reason, so a not-available is never silent", () => {
    const r = assertEditionContract("mass-energy", { ledgerText: LEDGER });
    expect(r.denominator.checksDeclined).toBeGreaterThan(0);
    for (const d of r.denominator.declined) {
      expect(d.checkNumber).toBeDefined();
      expect(d.reason.length).toBeGreaterThan(20);
    }
  });

  test("every check that was handed nothing declines, and none of them says valid", () => {
    // Six checks shared one shape: a default message asserting validity, a guarded
    // validation, and an unconditional push of that default. Supplied with nothing they
    // reported passed. The fixture reaches that state by construction - it supplies a
    // ledger and nothing else - so this is the exact input the defect mishandled.
    const r = assertEditionContract("mass-energy", { ledgerText: LEDGER });
    // Check 8 is deliberately NOT in this list. Given only a ledger it derives German
    // alignable units from it, so its population is not empty: it correctly FAILS with
    // `empty-alignment` because units exist and nothing aligns them. Declining there would
    // be the weaker answer. Its empty-population decline is asserted in the first test of
    // this file, where the ids and edges are explicitly empty. The distinction matters:
    // "nothing to examine" and "something to examine that nothing covers" are different
    // findings and must not collapse into one.
    const EMPTY_POPULATION = new Map<number, string>([
      [10, "inline-math-atoms-population-empty"],
      [11, "term-definitions-population-empty"],
      [13, "gloss-units-population-empty"],
      [14, "review-states-population-empty"],
      [15, "span-revision-currency-population-empty"],
    ]);
    for (const [n, code] of EMPTY_POPULATION) {
      const c = r.checks.find((x) => x.checkNumber === n);
      expect(c?.outcome, `check ${n} should decline on an empty population`).toBe("not-available");
      expect(c?.code, `check ${n} should name why it declined`).toBe(code);
      expect(c?.message).toContain("Nothing was examined");
    }
    const c8 = r.checks.find((x) => x.checkNumber === 8);
    expect(c8?.outcome, "check 8 has units from the ledger, so it fails rather than declines").toBe(
      "failed",
    );
    expect(c8?.code).toBe("empty-alignment");

    // And the sentences they used to emit are gone. Asserting the claim, not a word.
    const claims = [
      "Alignment coverage and edge validity verified.",
      "Inline math atoms, reference IDs, and footnote marks match.",
      "Term definitions and language metadata valid.",
      "Gloss units valid and current.",
      "Review states, provenance, and editors valid.",
      "Span revisions and digests are current.",
    ];
    const allMessages = r.checks.map((c) => c.message).join("\n");
    for (const claim of claims) {
      expect(allMessages, `no check may still emit: ${claim}`).not.toContain(claim);
    }
  });

  test("a check with a real population still reaches a verdict, so declining is not the default", () => {
    // The other direction: the guards must not have turned every check into a decline.
    const r = assertEditionContract("mass-energy", {
      ledgerText: LEDGER,
      germanIds: ["s1"],
      englishIds: ["s1"],
      edges: [{ sourceId: "s1", targetId: "s1" }],
    });
    const c8 = r.checks.find((c) => c.checkNumber === 8);
    expect(c8?.outcome).toBe("passed");
    expect(c8?.message).toContain("1 German unit(s)");
    expect(r.denominator.checksJudged).toBeGreaterThan(0);
  });

  test("a coverage failure is still a failure, so the decline is not a way out", () => {
    // The fixture reaches the failing state: an English unit with no edge at all.
    const r = assertEditionContract("mass-energy", {
      ledgerText: LEDGER,
      germanIds: ["s1"],
      englishIds: ["s1", "orphan"],
      edges: [{ sourceId: "s1", targetId: "s1" }],
    });
    const c8 = r.checks.find((c) => c.checkNumber === 8);
    expect(c8?.outcome).toBe("failed");
    expect(r.denominator.englishUnitsUnaligned).toEqual(["orphan"]);
  });
});
