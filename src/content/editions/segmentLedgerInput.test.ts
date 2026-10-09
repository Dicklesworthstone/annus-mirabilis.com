/**
 * WHY THE DIVIDER CANNOT SEPARATE A PARAGRAPH OPENING FROM A POST-DISPLAY RESUMPTION, FROM A
 * MACHINE DRAFT. This is am-utni's first acceptance item taking its second branch, and the branch
 * is taken on measurement rather than preference.
 *
 * On the plate a paragraph opening is INDENTED and a line resuming after a display equation is
 * set FLUSH LEFT. That is the whole signal, and the machine draft does not carry it. Three
 * independent checks, all over public/papers/transcripts/ap-17-549-machine-draft.txt:
 *
 *   1. INDENTATION IS GONE. 0 lines begin with whitespace, against 240 non-empty flush-left ones.
 *   2. A BLANK LINE DOES NOT DISCRIMINATE. am-utni read six cases off printed page 554: three
 *      indented openings and three flush-left resumptions. In the draft all six are identical --
 *      preceded by a blank line, no leading whitespace. A divider keying on blank lines would have
 *      to call all six the same thing, and whichever it chose, three would be wrong.
 *   3. THE EXPLICIT MARKER CANNOT SAY THIS, BY ITS SHAPE. The draft has `[[CONTINUES]]`, and
 *      segmentLedger.ts honours it, but it is a TRAILING marker: it sits at the end of a text line
 *      and means "this paragraph resumes after the interruption that FOLLOWS". So to keep a
 *      paragraph whole across a display, it would have to be written on the paragraph's last text
 *      line before that display, and in all three p.554 cases it is not.
 *
 *      (One of the five markers, line 171, does sit on a line that follows a display close. That
 *      is incidental and was nearly written up here as a counterexample: its marker is about the
 *      FOOTNOTE below it, not the display above. A trailing marker is never evidence about what
 *      precedes its line.)
 *
 * SO THE DEFECT IS IN THE INPUT, NOT THE DIVIDER, which is the opposite of how the bead reads at
 * first. segmentLedger already respects an explicit continuation marker; the draft does not carry
 * one at the three places printed page 554 shows a resumption. The repair is either a transcriber
 * adding `[[CONTINUES]]` there from the plate, or a reviewed ledger that preserves indentation --
 * and `docs/OWNERS.md` has open-german-source-brownian-motion recruiting, so the second does not
 * exist yet.
 *
 * This file pins the three measurements so nobody re-derives them, and so that the day an input
 * DOES carry the signal, the test that says "indentation is gone" fails and announces it.
 *
 * Not a claim about the manifest: am-edn-inventory-brownian-slg's plate adjudication found the
 * manifest division correct and the freeze sound. segmentLedger has zero non-test call sites.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const DRAFTS = join(ROOT, "public/papers/transcripts");
const BROWNIAN = join(DRAFTS, "ap-17-549-machine-draft.txt");

/** The six lines am-utni read off printed page 554, by how the PLATE sets them. */
const PLATE_PAGE_554 = [
  { sets: "indented", startsWith: "In einer Flüssigkeit seien suspendierte" },
  { sets: "indented", startsWith: "Es sei $\\nu$ die Anzahl der suspendierten" },
  { sets: "indented", startsWith: "Die Gleichung (1) benutzen wir" },
  { sets: "flush", startsWith: "Es werde angenommen" },
  { sets: "flush", startsWith: "Die gesuchte Gleichgewichtsbedingung ist also" },
  { sets: "flush", startsWith: "Die letzte Gleichung sagt aus" },
] as const;

const lines = (path: string) => readFileSync(path, "utf8").split("\n");

describe("the machine draft does not carry the signal the plate uses", () => {
  test("1. no line is indented, so the opening/resumption distinction is absent", () => {
    const all = lines(BROWNIAN);
    const indented = all.filter((l) => /^[ \t]+\S/.test(l)).length;
    const flush = all.filter((l) => l.trim().length > 0).length;
    console.log(
      `[census] ap-17-549 machine draft: ${all.length} lines, ${indented} indented, ${flush} non-empty flush-left`,
    );
    expect(flush).toBeGreaterThan(200);
    // The day a reviewed ledger preserves indentation, this fails and says the premise changed.
    expect(indented).toBe(0);
  });

  test("2. all six plate-read cases are IDENTICAL in the draft", () => {
    const all = lines(BROWNIAN);
    const seen = PLATE_PAGE_554.map(({ sets, startsWith }) => {
      const i = all.findIndex((l) => l.startsWith(startsWith));
      expect(i, `not found in the draft: ${startsWith}`).toBeGreaterThan(-1);
      return {
        sets,
        blankBefore: (all[i - 1] ?? "").trim() === "",
        indented: /^[ \t]/.test(all[i] ?? ""),
      };
    });
    // Both classes present, or the comparison below would be vacuous.
    expect(seen.filter((s) => s.sets === "indented").length).toBe(3);
    expect(seen.filter((s) => s.sets === "flush").length).toBe(3);
    // And in the draft they are indistinguishable: one shape for all six.
    const shapes = new Set(seen.map((s) => `${s.blankBefore}|${s.indented}`));
    expect([...shapes]).toEqual(["true|false"]);
  });

  test("3. the marker is trailing, and is absent where it would have to be", () => {
    const all = lines(BROWNIAN);
    const marks = all.filter((l) => /\[\[CONTINUES\]\]/.test(l)).length;
    console.log(`[census] ap-17-549: ${marks} [[CONTINUES]] marker(s), all trailing a text line`);
    expect(marks).toBeGreaterThan(0);
    // Every marker trails its line; none opens one. That is what makes it unable to say "this
    // line resumes the paragraph the display above interrupted".
    for (const line of all.filter((l) => /\[\[CONTINUES\]\]/.test(l))) {
      expect(line.trimEnd().endsWith("[[CONTINUES]]"), line.slice(0, 40)).toBe(true);
    }
    // For each resumption, walk back past the display block to the paragraph's last text line:
    // that is where a marker would have to go, and in all three it is absent.
    for (const { startsWith } of PLATE_PAGE_554.filter((c) => c.sets === "flush")) {
      const i = all.findIndex((l) => l.startsWith(startsWith));
      let j = i - 1;
      while (
        j >= 0 &&
        ((all[j] ?? "").trim() === "" ||
          (all[j] ?? "").trim() === "$$" ||
          (all[j] ?? "").startsWith("\\") ||
          (all[j] ?? "").startsWith("[[EQ-LABEL"))
      )
        j -= 1;
      expect(/\[\[CONTINUES\]\]\s*$/.test(all[j] ?? ""), `${startsWith} -> line ${j + 1}`).toBe(
        false,
      );
    }
  });

  test("the drafts are the only transcripts: no reviewed ledger exists to read instead", () => {
    // AGENTS.md records 4 machine drafts and 0 reviewed ledgers. If that changes, the better input
    // exists and this bead's second branch stops being the honest one.
    const files = readdirSync(DRAFTS).filter((f) => f.endsWith(".txt"));
    const reviewed = files.filter((f) => f.includes("-reviewed"));
    console.log(`[census] transcripts: ${files.length} file(s), ${reviewed.length} reviewed`);
    expect(files.length).toBeGreaterThanOrEqual(4);
    expect(reviewed).toEqual([]);
  });
});
