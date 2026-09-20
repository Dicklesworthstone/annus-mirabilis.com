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
[[HEADING s0]]
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
      germanIds: ["s0", "closing-dateline"],
      englishIds: ["s0", "closing-dateline"],
      edges: [{ sourceId: "s0", targetId: "s0" }],
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

  test("a coverage failure is still a failure, so the decline is not a way out", () => {
    // The fixture reaches the failing state: an English unit with no edge at all.
    const r = assertEditionContract("mass-energy", {
      ledgerText: LEDGER,
      germanIds: ["s0"],
      englishIds: ["s0", "orphan"],
      edges: [{ sourceId: "s0", targetId: "s0" }],
    });
    const c8 = r.checks.find((c) => c.checkNumber === 8);
    expect(c8?.outcome).toBe("failed");
    expect(r.denominator.englishUnitsUnaligned).toEqual(["orphan"]);
  });
});
