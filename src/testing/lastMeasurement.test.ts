/**
 * THE EVIDENCE-KEEPING, IN BOTH DIRECTIONS (am-1bso).
 *
 * This module exists so a gate's refusal can carry the last real measurement instead of leaving a reader with
 * nothing. Two properties matter more than the storage: a MISSING record must read as alarming rather than as
 * silence, and nothing here may ever throw, because a cache failure must not turn a passing gate red.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lastMeasurementNote, readLastMeasurement, recordMeasurement } from "./lastMeasurement.ts";
import { checkOutFreshness } from "./outFreshness.ts";

const scratch = () => mkdtempSync(join(tmpdir(), "last-measurement-"));

describe("recording and reading a measurement", () => {
  test("a recorded measurement round-trips with its commit and its denominator", () => {
    const root = scratch();
    recordMeasurement(root, {
      gate: "phone-overflow",
      buildCommit: "d6c1a6d886c590297e283dc6e7fffcd348868e41",
      takenAt: "2026-10-06T13:15:57.105Z",
      examined: 2157,
      violations: 0,
      findings: [],
    });
    const read = readLastMeasurement(root, "phone-overflow");
    expect(read?.examined).toBe(2157);
    expect(read?.violations).toBe(0);
    expect(read?.buildCommit).toBe("d6c1a6d886c590297e283dc6e7fffcd348868e41");
  });

  test("a later record replaces the earlier one, since only the last is wanted", () => {
    const root = scratch();
    recordMeasurement(root, {
      gate: "g",
      takenAt: "a",
      examined: 1,
      violations: 1,
      findings: ["x"],
    });
    recordMeasurement(root, { gate: "g", takenAt: "b", examined: 2, violations: 0, findings: [] });
    expect(readLastMeasurement(root, "g")?.takenAt).toBe("b");
  });

  test("two gates do not overwrite each other", () => {
    const root = scratch();
    recordMeasurement(root, { gate: "a", takenAt: "t", examined: 1, violations: 0, findings: [] });
    recordMeasurement(root, { gate: "b", takenAt: "t", examined: 9, violations: 0, findings: [] });
    expect(readLastMeasurement(root, "a")?.examined).toBe(1);
    expect(readLastMeasurement(root, "b")?.examined).toBe(9);
  });
});

describe("the note a refusal carries", () => {
  test("A MISSING RECORD READS AS ALARMING, not as silence", () => {
    // The property that matters most. "Nothing has ever been measured" is a worse state than "the last
    // measurement found three regressions", and a note that said nothing would make the worse state look like
    // the better one.
    const note = lastMeasurementNote(scratch(), "phone-overflow");
    expect(note).toMatch(/No run of phone-overflow has ever recorded a measurement/);
    expect(note).toMatch(/nothing is known about what a reader gets/);
  });

  test("a clean measurement says so, with its commit and denominator", () => {
    const root = scratch();
    recordMeasurement(root, {
      gate: "phone-overflow",
      buildCommit: "d6c1a6d886c590297e283dc6e7fffcd348868e41",
      takenAt: "2026-10-06T13:15:57.105Z",
      examined: 2157,
      violations: 0,
      findings: [],
    });
    const note = lastMeasurementNote(root, "phone-overflow");
    expect(note).toContain("commit d6c1a6d8");
    expect(note).toContain("examined 2157");
    expect(note).toContain("no violation");
  });

  test("findings are named, which is the whole point: the bead lost a run's regression names", () => {
    const root = scratch();
    recordMeasurement(root, {
      gate: "phone-overflow",
      takenAt: "t",
      examined: 924,
      violations: 2,
      findings: [
        "/papers/x at 320 (scrollWidth 400 vs 320)",
        "/papers/y at 320 (scrollWidth 390 vs 320)",
      ],
    });
    const note = lastMeasurementNote(root, "phone-overflow");
    expect(note).toContain("2 violation(s)");
    expect(note).toContain("/papers/x");
    expect(note).toContain("/papers/y");
  });

  test("a record with no commit still reports, without inventing one", () => {
    const root = scratch();
    recordMeasurement(root, { gate: "g", takenAt: "t", examined: 5, violations: 0, findings: [] });
    const note = lastMeasurementNote(root, "g");
    expect(note).not.toContain("commit");
    expect(note).toContain("examined 5");
  });
});

describe("nothing here throws, because a cache is not a verdict", () => {
  test("a corrupt record reads as absent rather than throwing", () => {
    const root = scratch();
    recordMeasurement(root, { gate: "g", takenAt: "t", examined: 1, violations: 0, findings: [] });
    writeFileSync(join(root, "artifacts", "measurements", "g.json"), "{ not json", "utf8");
    expect(readLastMeasurement(root, "g")).toBeNull();
    expect(lastMeasurementNote(root, "g")).toMatch(/has ever recorded/);
  });

  test("a record missing its required fields reads as absent", () => {
    const root = scratch();
    recordMeasurement(root, { gate: "g", takenAt: "t", examined: 1, violations: 0, findings: [] });
    writeFileSync(
      join(root, "artifacts", "measurements", "g.json"),
      JSON.stringify({ gate: "g", takenAt: "t" }),
      "utf8",
    );
    // examined and violations are the two numbers a reader judges the finding by, so a record without
    // them is not a measurement.
    expect(readLastMeasurement(root, "g")).toBeNull();
  });

  test("recording into an unwritable place does not throw", () => {
    // A read-only artifacts directory must not turn a passing gate red.
    expect(() =>
      recordMeasurement("/dev/null/nope", {
        gate: "g",
        takenAt: "t",
        examined: 1,
        violations: 0,
        findings: [],
      }),
    ).not.toThrow();
  });

  test("a gate name with path characters cannot escape the directory", () => {
    const root = scratch();
    recordMeasurement(root, {
      gate: "../../escaped",
      takenAt: "t",
      examined: 1,
      violations: 0,
      findings: [],
    });
    // The name is sanitised to a flat file, so the record lands inside artifacts/measurements.
    expect(readLastMeasurement(root, "../../escaped")?.examined).toBe(1);
    expect(readLastMeasurement(root, "escaped")).toBeNull();
  });
});

describe("the two halves a gate composes on a refusal", () => {
  test("an absent out/ is not fresh, which is the condition the note is printed under", () => {
    // The gate's line is `if (!probe.fresh) t.diagnostic(lastMeasurementNote(...))`. This asserts the half that
    // decides, and the cases above assert the half that speaks.
    //
    // WHAT IS NOT DRIVEN HERE, said rather than implied: a real stale build. Producing one needs a COMMIT that
    // touches a production file after out/ was built - a dirty working tree is reported and is deliberately not
    // a staleness verdict since 2026-09-21 - and there is no honest reason to make such a commit to exercise a
    // diagnostic. So the wiring is verified as these two halves plus a one-line composition, and the
    // composition is the part a reader should check by eye.
    const result = checkOutFreshness("definitely-not-a-build-directory", scratch());
    expect(result.present).toBe(false);
    expect(result.fresh).toBe(false);
    expect(typeof result.reason).toBe("string");
  });

  test("the freshness result carries the build commit, which the record stores", () => {
    // Added for this purpose (am-1bso): without it a kept measurement could not say which commit it measured,
    // and a note naming no commit is much weaker evidence.
    const real = checkOutFreshness("out", process.cwd());
    if (!real.present) return; // nothing built here; the arm above covers that case
    expect(real.buildCommit === undefined || /^[0-9a-f]{40}$/.test(real.buildCommit)).toBe(true);
  });
});
