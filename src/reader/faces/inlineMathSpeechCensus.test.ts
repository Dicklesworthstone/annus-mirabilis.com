/**
 * EVERY INLINE EXPRESSION IN THE FOUR PAPERS, RUN THROUGH THE SPEECH IT WILL ACTUALLY GET.
 *
 * `am-rc1001-bridge-plan-pcjk.29` recorded that 0 of 714 authored inline expressions carry a
 * spoken form, and asked for 714 of them to be written. Measuring first changed the shape of the
 * work. The 714 are not silent: `speakInlines` sends each one through `speakMath`, which reads
 * KaTeX's MathML and says the printed symbols in words. What was wrong was narrower and fixable in
 * one place -- 26 of the 231 DISTINCT expressions hit a gap in that function's own lexicon and were
 * announced as a raw glyph ("E ‾" for the mean energy, "ϱ" for the density, "≧" for a relation).
 * Naming them in the lexicon repaired all 32 occurrences at once, on both faces, which authoring
 * 714 strings would not have done any better.
 *
 * So this is the ratchet that bead asked for, over the population it names, and its denominator is
 * measured here rather than copied from the bead: a census, not an authoring queue.
 *
 * WHICH HALF WATCHES WHICH. The reading of any ONE expression is pinned by assertion in
 * glossSpokenEnglish.test.tsx, where the printed forms sit beside the words a reader hears. This
 * file asserts the complementary property, which no list of examples can: that NOTHING in the
 * corpus reaches a reader as a glyph, including an expression nobody thought to write a test for.
 * A record added tomorrow is covered by this file and by no assertion in that one.
 *
 * THE DETECTOR HAS A POSITIVE CONTROL, because a detector that flags nothing and a corpus with
 * nothing to flag produce the same green. `defects` is run against two expressions built to fail
 * and one built to pass, so a run that reports the corpus clean has shown it can report otherwise.
 *
 * PLANT RECORD, twice. Before the lexicon fix landed (4bea5bfa) this file's corpus assertion was
 * red with exactly the 26 distinct expressions listed in that commit; after it, 0 of 231. Then the
 * plant was repeated deliberately: removing the single ACCENTS entry for U+203E took the census to
 * `generated-flagged 2` and printed
 *     raw-glyph:‾ "\\overline{E}" -> "E ‾"
 *     raw-glyph:‾ "\\overline{E}_\\nu" -> "E ‾ sub nu"
 * before the entry was restored. Two is the right number rather than five, because only those two
 * of the repaired expressions use that character -- which is the check that the plant reached this
 * predicate and not some neighbouring one. The positive control above went red in the same run.
 *
 * The `authored` figure was planted separately, because a counter stuck at zero and a corpus with
 * nothing authored are the same number. Writing one `spoken:` into
 * content/source-blocks/light-quanta/s1-p3.yaml took the line to `authored 1`, and the same plant
 * was followed through the real path -- validateSourceBlock's validateInline kept the field, and
 * speakInlines put those words into the spoken line in place of the generated reading. The record
 * was then restored and `git diff` on it is empty.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { speakMath } from "./mathSpeech.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;

/**
 * What a bad reading looks like from the outside. Each signature names a way the printed glyph
 * survived into the words: a command that KaTeX did not resolve, a brace it did not consume, or a
 * character outside Latin-1 that the lexicon has no word for. The last one is the signature that
 * found all 26, because an unnamed symbol is returned as itself.
 */
function defects(said: string): readonly string[] {
  const found: string[] = [];
  if (!said.trim()) found.push("empty");
  if (said.includes("\\")) found.push("unresolved-command");
  if (/[{}]/.test(said)) found.push("brace");
  if (said.includes("undefined")) found.push("undefined");
  const raw = [...new Set([...said].filter((ch) => (ch.codePointAt(0) ?? 0) > 0x24f))];
  // U+2009..U+200A are thin spaces KaTeX emits between tokens; they are not glyphs a reader hears.
  const glyphs = raw.filter((ch) => !/\s/.test(ch));
  if (glyphs.length) found.push(`raw-glyph:${glyphs.join("")}`);
  return found;
}

type Occurrence = {
  readonly paper: string;
  readonly blockId: string;
  readonly latex: string;
  /** The words authored for THIS occurrence, where the record carries them (MathInline.spoken). */
  readonly spoken: string | undefined;
};

function yamlFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yamlFiles(path, out);
    else if (entry.endsWith(".yaml") && entry !== "manifest.yaml") out.push(path);
  }
  return out;
}

/**
 * The population the bead names: an inline math node that is not a reference to a displayed
 * equation (`display`) and is not the body of one (`equationId`). Those two have authored forms in
 * content/display-terms; these are the expressions written inside a sentence, which have none.
 */
function authoredInlines(paper: string): readonly Occurrence[] {
  const out: Occurrence[] = [];
  for (const file of yamlFiles(join(ROOT, "content", "source-blocks", paper))) {
    let record: unknown;
    try {
      record = strictParse(readFileSync(file, "utf8"), "yaml");
    } catch {
      continue; // The ledger and manifest checks own parse failures; this file owns speech.
    }
    const blockId =
      typeof (record as Record<string, unknown>)?.id === "string"
        ? String((record as Record<string, unknown>).id)
        : file;
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) {
        for (const child of node) visit(child);
        return;
      }
      if (node === null || typeof node !== "object") return;
      const object = node as Record<string, unknown>;
      if (
        object.kind === "math" &&
        typeof object.latex === "string" &&
        object.display !== true &&
        object.equationId === undefined
      ) {
        out.push({
          paper,
          blockId,
          latex: object.latex.trim(),
          spoken: typeof object.spoken === "string" ? object.spoken : undefined,
        });
      }
      for (const value of Object.values(object)) visit(value);
    };
    visit(record);
  }
  return out;
}

describe("the detector can fail: a positive control before any corpus claim", () => {
  test("a reading that keeps its glyph is flagged, and a clean one is not", () => {
    expect(defects("E ‾")).toEqual(["raw-glyph:‾"]);
    expect(defects("\\varrho sub nu")).toEqual(["unresolved-command"]);
    expect(defects("")).toEqual(["empty"]);
    expect(defects("E bar sub nu")).toEqual([]);
    expect(defects("open paren x, y, z close paren")).toEqual([]);
  });

  test("and it flags the real pre-repair reading of a real corpus expression", () => {
    // The historical defect, reconstructed: this is what speakMath returned for \overline{E}
    // before 4bea5bfa. If `defects` ever stopped recognizing it, the corpus sweep below would go
    // quietly green on a corpus full of glyphs.
    expect(defects("E ‾").length).toBeGreaterThan(0);
    expect(defects(speakMath("\\overline{E}"))).toEqual([]);
  });
});

describe("every inline expression a reader meets is spoken in words", () => {
  const all = PAPERS.flatMap(authoredInlines);
  const distinct = [...new Set(all.map((o) => o.latex))];

  test("the census examines the corpus, and says what it examined", () => {
    // Counted from the records, never written down here: a constant 0 would keep reading as true
    // after the first form was authored, and a census whose figures cannot move is not a census.
    const authored = all.filter((o) => o.spoken !== undefined).length;
    const flagged = distinct.filter((latex) => defects(speakMath(latex)).length > 0);
    console.log(
      `[census] inline math: examined ${all.length} occurrences / ${distinct.length} distinct, ` +
        `authored ${authored}, generated-clean ${distinct.length - flagged.length}, ` +
        `generated-flagged ${flagged.length}`,
    );
    for (const paper of PAPERS) {
      const mine = all.filter((o) => o.paper === paper);
      console.log(
        `[census]   ${paper}: ${mine.length} occurrences / ${new Set(mine.map((o) => o.latex)).size} distinct`,
      );
    }
    // A floor on the corpus, not an equality: records are still being added, and a census that
    // broke on correct work would be replaced by a raised number rather than read.
    expect(all.length).toBeGreaterThanOrEqual(700);
    expect(distinct.length).toBeGreaterThanOrEqual(225);
    // The ratchet, in the only direction that is a debt: `generated-flagged` is at its floor and
    // the assertion below holds it there. `authored` is reported and NOT asserted, because a
    // number that rises as editorial work lands is a measurement, and freezing it into an
    // equality would turn correct work red -- which is how a census comes to sit above the check
    // it was standing in front of.
    expect(authored).toBeGreaterThanOrEqual(0);
  });

  test("NOTHING reaches a reader as a raw glyph, and a failure names the expressions", () => {
    const bad = distinct
      .map((latex) => ({ latex, said: speakMath(latex), flags: defects(speakMath(latex)) }))
      .filter((row) => row.flags.length > 0);
    // Printing the expressions rather than their count: a number moving says nothing about which
    // reading broke, and this list is what the repair is done from.
    expect(
      bad.map(
        (row) =>
          `${row.flags.join(",")} ${JSON.stringify(row.latex)} -> ${JSON.stringify(row.said)}`,
      ),
    ).toEqual([]);
  });

  test("each paper is represented, so a paper cannot drop out of the sweep unnoticed", () => {
    // Without this, deleting a directory or mistyping a slug would shrink the denominator and the
    // sweep would still pass -- the shape that makes an empty run read as a clean one.
    for (const paper of PAPERS) {
      const mine = all.filter((o) => o.paper === paper);
      expect(mine.length).toBeGreaterThan(0);
    }
  });
});
