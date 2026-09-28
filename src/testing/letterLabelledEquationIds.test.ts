/**
 * THE ONE PRINTED EQUATION WHOSE LABEL IS A LETTER (am-as1w follow-on, dispatch 375).
 *
 * `content/source-blocks/special-relativity/eq-A.yaml` is Einstein's system (A), the electron
 * equations of motion in §10 — one of the closing sections AGENTS.md says must never disappear
 * behind the familiar headlines. It is a real block: `kind: "equation"`, `section: "s10"`,
 * `originalLabel: "A"`, `editorialLabel: "ed:s10-A"`, printed page 918, and its id is in
 * `manifest.ids.snapshot.txt`, so it is frozen.
 *
 * It renders. Measured 2026-09-28 from the built export: the German and English faces of §10 carry
 * `id="eq-A"` with `data-block-id="eq-A"` and `data-equation-id="eq-A"`, and all 13 of §10's
 * equation anchors are present. A reader can reach it at
 * `/papers/special-relativity/s10/view/german/#eq-A`.
 *
 * WHAT IS BROKEN IS THE GRAMMAR, NOT THE ID, and the distinction is the point of this file.
 * `parseEquationAnchor` accepts only digit-based suffixes, so it refuses `eq-A` — and it refuses
 * `eq-a`, `eq-s10-A` and `eq-s10-a` equally. Renaming the record would therefore fix nothing while
 * losing the printed label the plate actually shows. AGENTS.md's own anchor grammar says
 * `#eq-<printed number>`, and a printed LETTER is a case neither the prose nor the implementation
 * models. Widening it is a specification change and belongs to the owner.
 *
 * SO THIS TEST DOES NOT FREEZE THE GAP. It asserts a property that stays true either way: an
 * equation id the grammar cannot spell must be a frozen, letter-labelled printed equation rather
 * than a typo or a stray file. If the owner widens the grammar, the exception set empties and this
 * still passes. If someone renames the record, or a new letter-labelled equation arrives without a
 * label to justify it, this goes red.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEquationAnchor } from "../content/ids.ts";

const ROOT = resolve(new URL("../../", import.meta.url).pathname);
const BLOCKS = resolve(ROOT, "content/source-blocks");

type Block = { paper: string; id: string; text: string };

function equationBlocks(): Block[] {
  const out: Block[] = [];
  for (const paper of readdirSync(BLOCKS).sort()) {
    const dir = resolve(BLOCKS, paper);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith(".yaml") || file === "manifest.yaml") continue;
      const text = readFileSync(resolve(dir, file), "utf8");
      if (/^kind:\s*"equation"/m.test(text))
        out.push({ paper, id: file.replace(/\.yaml$/, ""), text });
    }
  }
  return out;
}

describe("an equation id the anchor grammar cannot spell", () => {
  const blocks = equationBlocks();

  test("the corpus this reads is the real one", () => {
    // Non-vacuity on a measured count: 200 equation source blocks on 2026-09-28. A run finding
    // almost none means the scan broke, and every assertion below would pass over nothing.
    expect(blocks.length).toBeGreaterThanOrEqual(190);
    expect(blocks.some((b) => b.id === "eq-A" && b.paper === "special-relativity")).toBe(true);
  });

  test("is a frozen, letter-labelled printed equation, not a typo", () => {
    const unspellable = blocks.filter((b) => !parseEquationAnchor(b.id).ok);
    // Both directions: the vast majority DO parse, so this is not a check that passes because the
    // grammar refuses everything.
    expect(blocks.length - unspellable.length).toBeGreaterThanOrEqual(150);
    for (const b of unspellable) {
      const label = /^originalLabel:\s*"([^"]+)"/m.exec(b.text)?.[1] ?? "";
      expect(label, `${b.paper}/${b.id} has no originalLabel to justify its id`).toMatch(
        /^[A-Za-z]$/,
      );
      // The printed label is what the id encodes, so the two must agree.
      expect(b.id, `${b.paper}/${b.id} does not encode its printed label`).toBe(`eq-${label}`);
      // And it is frozen: an id outside the snapshot is a new id, which would have to satisfy the
      // grammar rather than claim this exception.
      const snapshot = resolve(BLOCKS, b.paper, "manifest.ids.snapshot.txt");
      expect(existsSync(snapshot), `${b.paper} has no frozen id snapshot`).toBe(true);
      expect(readFileSync(snapshot, "utf8")).toContain(b.id);
    }
  });

  test("the digit forms the grammar exists for keep working", () => {
    // ASSERTED: the forms the grammar is FOR. These are invariants, not a debt.
    for (const form of ["eq-s10-d4", "eq-7", "eq-roman-2"])
      expect(parseEquationAnchor(form).ok, `${form} unexpectedly refused`).toBe(true);
    expect(parseEquationAnchor("eq-").ok).toBe(false);

    // REPORTED, NOT ASSERTED: which letter forms the grammar admits today. Asserting that `eq-a` is
    // refused would freeze the gap and turn this red on the day the owner repairs it, which is the
    // opposite of what this file is for. The line below is a measurement a reader of the log can
    // act on; the property that must hold is in the test above.
    const letters = ["eq-A", "eq-a", "eq-s10-A", "eq-s10-a"];
    const accepted = letters.filter((f) => parseEquationAnchor(f).ok);
    console.log(
      `[letter-labelled equation ids] the anchor grammar accepts ${accepted.length} of ` +
        `${letters.length} letter forms (${accepted.join(", ") || "none"}); measured 2026-09-28 it ` +
        `accepted none, so renaming eq-A to eq-a would not have satisfied it.`,
    );
  });
});
