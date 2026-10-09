/**
 * THE READINGS AUDIT OVER THE REAL RECORDS -- AND THE CORRECTION OF WHAT THIS FILE FIRST CLAIMED.
 *
 * The first version of this file asserted that all 63 targets were `owner-unassigned` and that one
 * word in the records was the cause. THAT WAS FALSE, and the cause was the loader beside it: it
 * cast `entry.kind` to `ReadingTargetKind` unchecked (the union has no `caption` member) and read
 * `targetKinds:` from a declared field that three records omit. Fed correctly, the audit returns
 * ok=true with ZERO findings over 63 targets, which is what the tests below now assert.
 *
 * It also claimed `auditReadings` had never had a live loader. scripts/verify-content.ts:247 has
 * loaded these records since before this file existed, and did both translations right. That is
 * the useful lesson and the reason the control at the bottom is shaped the way it is: the earlier
 * "11 of 11" vacuity and this "63 of 63" falsehood came from the same place, a measurement trusted
 * because it was surprising. A surprising number about a corpus is first a claim about the
 * instrument.
 *
 * So the exclusion machinery in `readingsTally` now guards a state THIS LOADER CANNOT PRODUCE,
 * because it derives owners and targets from the same records. It is still tested, but against a
 * hand-built audit input rather than a fixture on disk, and that difference is stated where it is
 * tested rather than left for a reader to infer from a passing green.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { auditReadings } from "../audits/readings.ts";
import { cellsForPaper, loadInstrumentAudit, r2CoversR1, readingsComplete } from "./measure.ts";
import { loadLiveReadings, READINGS_RECORD_VOCABULARY, readingsTally } from "./readingsCells.ts";

const REAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/** A root with one readings-owner record, whose kinds can be made to match or not. */
function fixtureRoot(kindOnTarget: string, kindOnOwner: string): string {
  const root = mkdtempSync(join(tmpdir(), "am-readings-"));
  const dir = join(root, "content", "editorial", "readings-owners");
  mkdirSync(dir, { recursive: true });
  const long = "expanded ".repeat(40);
  writeFileSync(
    join(dir, "am-fixture-owner-aaaa.yaml"),
    [
      "paper: mass-energy",
      `targetKinds: ["${kindOnOwner}"]`,
      "ownerBeadId: am-fixture-owner-aaaa",
      "targets:",
      `  - kind: "${kindOnTarget}"`,
      '    id: "lab-caption-one"',
      "    readings:",
      '      r0: "One sentence."',
      '      r1: "A fuller reading of the same thing."',
      `      r2: "${long}"`,
      '      r3: "A note on the history."',
      '      r3Citations: ["cp2-doc-14"]',
    ].join("\n"),
    "utf8",
  );
  return root;
}

describe("the real records: 63 targets, all of them owned, and the audit is clean", () => {
  const loaded = loadLiveReadings(REAL_ROOT);

  test("the loader reads the records rather than reporting an empty corpus", () => {
    console.log(
      `[census] readings loader: ${loaded.input.targets.length} targets from ` +
        `${loaded.input.owners.length} owner records, ${loaded.report.findings.length} finding(s)`,
    );
    expect(loaded.input.targets.length).toBeGreaterThanOrEqual(40);
    expect(loaded.input.owners.length).toBeGreaterThanOrEqual(40);
  });

  test("NOTHING is reported: ok is true and the finding list is empty", () => {
    // The assertion this file got wrong. Printing the findings rather than only their count, so a
    // failure here names what appeared instead of saying a number moved.
    expect(loaded.report.findings.map((f) => `${f.check}:${String(f.recordId ?? "")}`)).toEqual([]);
    expect(loaded.report.ok).toBe(true);
  });

  test("every target resolves to exactly one owner, by the records rather than by my constant", () => {
    // Re-read from the loaded input, not from READINGS_RECORD_VOCABULARY, so the constant cannot
    // drift away from what it describes.
    const targetKinds = new Set(loaded.input.targets.map((t) => t.targetKind));
    expect([...targetKinds]).toEqual([READINGS_RECORD_VOCABULARY.inAuditType]);
    // And the records really do write the OTHER spelling: the translation is doing work, so a
    // loader that stopped translating would turn this red instead of silently going unowned.
    const onDisk = new Set(loaded.input.owners.flatMap((o) => [...o.targetKinds]));
    expect([...onDisk]).toEqual([READINGS_RECORD_VOCABULARY.inAuditType]);
    expect(READINGS_RECORD_VOCABULARY.inRecords).not.toBe(READINGS_RECORD_VOCABULARY.inAuditType);
  });

  test("so both cells MEASURE, over a real denominator", () => {
    for (const cell of [
      readingsComplete("mass-energy", loaded),
      r2CoversR1("mass-energy", loaded),
    ]) {
      expect(cell.unmeasured).toBe(false);
      expect(cell.denominator).toBeGreaterThan(0);
      console.log(`[census] ${cell.item} mass-energy: ${cell.count} of ${cell.denominator}`);
    }
  });

  test("the three records that omit targetKinds are owned anyway, because the kind is derived", () => {
    // The specific thing the old version called a defect. These three records declare no
    // `targetKinds:` at all; their 21 targets are owned regardless, which is the whole claim.
    const affected = loaded.input.owners.filter((o) =>
      READINGS_RECORD_VOCABULARY.recordsWithoutDeclaredKinds.includes(o.fileName),
    );
    expect(affected.length).toBe(3);
    const ids = new Set(affected.flatMap((o) => [...o.targetIds]));
    expect(ids.size).toBe(21);
    const unowned = new Set(
      loaded.report.findings
        .filter((f) => f.check === "owner-unassigned")
        .map((f) => String(f.recordId ?? "")),
    );
    expect([...ids].filter((id) => unowned.has(id))).toEqual([]);
  });
});

describe("the tally still excludes an unowned target -- proved where it can actually happen", () => {
  test("a hand-built input with one unowned target does not credit it as clean", () => {
    // NOT through loadLiveReadings: that loader derives owners and targets from the same records,
    // so it cannot emit a target no owner claims. Going through the audit directly is the only way
    // to reach the branch, and saying so here is the point -- a fixture on disk would have looked
    // like a test of the corpus while testing nothing.
    const readings = {
      r0: "One sentence.",
      r1: "A fuller reading of the same thing.",
      r2: `${"expanded ".repeat(40)}`,
      r3: "A note on the history.",
      r3Citations: ["cp2-doc-14"],
    };
    const input = {
      targets: [
        {
          targetId: "owned-one",
          targetKind: "instrument-caption" as const,
          paper: "mass-energy",
          readings,
        },
        {
          targetId: "orphan-one",
          targetKind: "instrument-caption" as const,
          paper: "mass-energy",
          readings,
        },
      ],
      owners: [
        {
          ownerBeadId: "am-fixture-owner-aaaa",
          fileName: "am-fixture-owner-aaaa.yaml",
          paper: "mass-energy",
          targetKinds: ["instrument-caption" as const],
          targetIds: ["owned-one"],
        },
      ],
      overrides: [],
    };
    const report = auditReadings(input);
    expect(report.findings.filter((f) => f.check === "owner-unassigned").length).toBe(1);
    const tally = readingsTally({ input, report }, "mass-energy", ["readings-missing"]);
    // One reachable, one short-circuited: the orphan is excluded from the denominator rather than
    // counted clean, which is the regression the first version of this file shipped.
    expect(tally.reachable).toBe(1);
    expect(tally.shortCircuited).toBe(1);
    expect(tally.clean).toBe(1);
  });
});

describe("the fixture controls: the checks are reachable and can fail", () => {
  test("a matching fixture is owned, reachable, and met", () => {
    const loaded = loadLiveReadings(fixtureRoot("instrument-caption", "instrument-caption"));
    expect(loaded.input.targets.length).toBe(1);
    expect(loaded.report.findings.filter((f) => f.check === "owner-unassigned")).toEqual([]);
    const tally = readingsTally(loaded, "mass-energy", ["readings-missing"]);
    expect(tally.reachable).toBe(1);
    expect(tally.shortCircuited).toBe(0);
    const cell = readingsComplete("mass-energy", loaded);
    expect(cell.unmeasured).toBe(false);
    expect(cell.met).toBe(true);
    expect(cell.denominator).toBe(1);
  });

  test("a record whose declared targetKinds DISAGREE with its targets is still owned", () => {
    // This is the fix, stated as a test. The fixture writes `kind: caption` on the target and
    // `targetKinds: ["paragraph"]` on the record -- the old loader would have left it unowned,
    // which is exactly how the 63 arose. The kind is derived, so the disagreement is harmless.
    const loaded = loadLiveReadings(fixtureRoot("caption", "paragraph"));
    expect(loaded.input.targets.length).toBe(1);
    expect(loaded.input.targets[0]?.targetKind).toBe("instrument-caption");
    expect(loaded.report.findings.filter((f) => f.check === "owner-unassigned")).toEqual([]);
    expect(readingsComplete("mass-energy", loaded).unmeasured).toBe(false);
  });

  test("a matching fixture whose R2 is NOT longer than R1 fails r2-covers-r1", () => {
    // The other half of the control: the r2-length check is reachable and can fail, so reporting
    // it as unmeasured today is a statement about the records rather than about the check.
    const root = fixtureRoot("instrument-caption", "instrument-caption");
    const file = join(
      root,
      "content",
      "editorial",
      "readings-owners",
      "am-fixture-owner-aaaa.yaml",
    );
    writeFileSync(
      file,
      [
        "paper: mass-energy",
        'targetKinds: ["instrument-caption"]',
        "ownerBeadId: am-fixture-owner-aaaa",
        "targets:",
        '  - kind: "instrument-caption"',
        '    id: "lab-caption-one"',
        "    readings:",
        '      r0: "One sentence."',
        '      r1: "A fuller reading with a good number of words in it to compare against."',
        '      r2: "Shorter."',
        '      r3: "A note."',
        '      r3Citations: ["cp2-doc-14"]',
      ].join("\n"),
      "utf8",
    );
    const loaded = loadLiveReadings(root);
    expect(loaded.report.findings.some((f) => f.check === "r2-length")).toBe(true);
    const cell = r2CoversR1("mass-energy", loaded);
    expect(cell.unmeasured).toBe(false);
    expect(cell.met).toBe(false);
    expect(cell.denominator).toBe(1);
    expect(cell.count).toBe(0);
  });

  test("the paper's full cell list still carries both items", () => {
    const items = cellsForPaper(REAL_ROOT, "mass-energy", loadInstrumentAudit(REAL_ROOT)).map(
      (c) => c.item,
    );
    expect(items).toContain("readings-r0-to-r3");
    expect(items).toContain("r2-covers-r1");
  });
});
