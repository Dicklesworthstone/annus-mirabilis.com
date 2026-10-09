/**
 * THE READINGS AUDIT, FED THE REAL RECORDS FOR THE FIRST TIME.
 *
 * `auditReadings` had no live loader, unlike the instrument and misconception audits, so nothing
 * had ever given it content/editorial/readings-owners. Doing so reports 63 errors on 63 targets,
 * and the cause is one word.
 *
 * THE FIRST VERSION OF THIS MEASUREMENT REPORTED "11 of 11" AND WAS VACUOUS, which is the reason
 * the fixture control below exists. The audit pushes `owner-unassigned` and then `continue`s, so no
 * later check runs for an unowned target; a tally that only asked "is there a readings-missing
 * finding for this target" counted all 63 as clean. The report that exists to refuse counts over
 * empty populations produced one about itself.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cellsForPaper, loadInstrumentAudit, r2CoversR1, readingsComplete } from "./measure.ts";
import { loadLiveReadings, READINGS_OWNER_KIND_MISMATCH, readingsTally } from "./readingsCells.ts";

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

describe("the real records: 63 targets, 63 owner-unassigned, and one word is the cause", () => {
  const loaded = loadLiveReadings(REAL_ROOT);

  test("the loader reads the records rather than reporting an empty corpus", () => {
    // Non-vacuity first: zero targets would make every claim below hold trivially.
    console.log(
      `[census] readings loader: ${loaded.input.targets.length} targets from ${loaded.input.owners.length} owner records`,
    );
    expect(loaded.input.targets.length).toBeGreaterThanOrEqual(40);
    expect(loaded.input.owners.length).toBeGreaterThanOrEqual(40);
  });

  test("EVERY target is owner-unassigned, and nothing else is reported", () => {
    const byCheck = new Map<string, number>();
    for (const f of loaded.report.findings) byCheck.set(f.check, (byCheck.get(f.check) ?? 0) + 1);
    expect([...byCheck.keys()]).toEqual(["owner-unassigned"]);
    expect(byCheck.get("owner-unassigned")).toBe(loaded.input.targets.length);
    expect(loaded.report.ok).toBe(false);
  });

  test("the cause is the kind mismatch, asserted against the records themselves", () => {
    // Not read from my own constant: the records are re-read here, so the constant cannot drift
    // away from what it describes.
    const ownerKinds = new Set(loaded.input.owners.flatMap((o) => [...o.targetKinds]));
    const targetKinds = new Set(loaded.input.targets.map((t) => t.targetKind));
    expect([...ownerKinds]).toContain(READINGS_OWNER_KIND_MISMATCH.declaredByOwners);
    expect([...targetKinds]).toEqual([READINGS_OWNER_KIND_MISMATCH.declaredByTargets]);
    // And they really are different, which is the defect rather than a naming preference.
    expect(READINGS_OWNER_KIND_MISMATCH.declaredByOwners).not.toBe(
      READINGS_OWNER_KIND_MISMATCH.declaredByTargets,
    );
  });

  test("so both cells are UNMEASURED, and the note names the mismatch", () => {
    for (const cell of [
      readingsComplete("mass-energy", loaded),
      r2CoversR1("mass-energy", loaded),
    ]) {
      expect(cell.unmeasured).toBe(true);
      expect(cell.met).toBe(false);
      expect(cell.note).toContain("owner-unassigned");
    }
  });

  test("the tally excludes short-circuited targets rather than crediting them", () => {
    const tally = readingsTally(loaded, "mass-energy", ["readings-missing"]);
    expect(tally.reachable).toBe(0);
    expect(tally.shortCircuited).toBeGreaterThan(0);
    // The old shape would have reported these as clean. Asserting the number is zero AND that
    // something was short-circuited, so a corpus with no targets at all cannot satisfy this.
    expect(tally.clean).toBe(0);
  });
});

describe("THE CONTROL: when the kinds match, the checks run and the cells measure", () => {
  test("a matching fixture is owned, reachable, and met", () => {
    // Without this the exclusion above could be an always-zero, and `unmeasured` would be the
    // report's permanent answer for these two items whatever the records said.
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

  test("the SAME fixture with the real corpus's mismatch is unmeasured again", () => {
    // The two fixtures differ in one word, which is the point: this is the corpus's condition
    // reproduced in isolation, so the finding is about the records and not about my loader.
    const loaded = loadLiveReadings(fixtureRoot("caption", "instrument-caption"));
    expect(loaded.input.targets.length).toBe(1);
    expect(loaded.report.findings.map((f) => f.check)).toEqual(["owner-unassigned"]);
    expect(readingsComplete("mass-energy", loaded).unmeasured).toBe(true);
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

  test("the paper's full cell list still carries both items, unmeasured rather than absent", () => {
    const items = cellsForPaper(REAL_ROOT, "mass-energy", loadInstrumentAudit(REAL_ROOT)).map(
      (c) => c.item,
    );
    expect(items).toContain("readings-r0-to-r3");
    expect(items).toContain("r2-covers-r1");
  });
});
