/**
 * The printed displays' term bindings (dispatch 224), checked on mass-energy's real record and
 * edition, then planted. Every plant starts from the green baseline in the first test, so a red
 * result is the plant's and not the data's.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { renderToString } from "katex";
import { isRegisteredQuantityId } from "../../content/quantities/registry.ts";
import type { ConcordanceEntry } from "../../content/schemas/concordance.ts";
import type { Inline } from "../../content/schemas/inlines.ts";
import { type BilingualEdition, loadBilingualEdition } from "../../reader/faces/bilingualLoader.ts";
import {
  type CheckedDisplay,
  compilePrintedDisplay,
  concordanceBinding,
  DisplayTermsError,
  type DisplayTermsFile,
  FACE_KATEX,
  loadDisplayTerms,
  parseDisplayTerms,
} from "./displayTerms.ts";
import { assertPublishable, checkPaperDisplays } from "./paperDisplays.ts";

const ROOT = process.cwd();
const PAPER = "mass-energy";
const file = loadDisplayTerms(ROOT, PAPER) as DisplayTermsFile;
const edition = (await loadBilingualEdition(PAPER, ROOT)) as BilingualEdition;

/** The file with one display's entry changed. */
function withEntry(
  display: string,
  change: (entry: DisplayTermsFile["displays"][number]) => DisplayTermsFile["displays"][number],
): DisplayTermsFile {
  assert.ok(
    file.displays.some((d) => d.display === display),
    display,
  );
  return {
    ...file,
    displays: file.displays.map((d) => (d.display === display ? change(d) : d)),
  };
}

/** The edition with one block's display inline carrying other LaTeX. */
function withBlockLatex(blockId: string, display: string, latex: string): BilingualEdition {
  const swap = (inlines: readonly Inline[]): Inline[] =>
    inlines.map((i) =>
      i.kind === "math" && i.equationId === display ? { ...i, latex } : (i as Inline),
    );
  assert.ok(
    edition.blocks.some((b) => b.id === blockId),
    blockId,
  );
  return {
    ...edition,
    blocks: edition.blocks.map((b) =>
      b.id === blockId
        ? {
            ...b,
            inlines: swap(b.inlines),
            ...(b.kind === "equation" ? { diplomaticText: latex } : {}),
          }
        : b,
    ),
  };
}

async function problems(overrides: Parameters<typeof checkPaperDisplays>[2]) {
  const result = await checkPaperDisplays(ROOT, PAPER, overrides);
  assert.ok(result);
  return result.problems;
}

describe("mass-energy's printed displays, as recorded", () => {
  test("the record checks clean, and covers every display block the paper prints", async () => {
    const result = await checkPaperDisplays(ROOT, PAPER);
    assert.ok(result);
    assert.deepEqual(result.problems, []);
    const blocks = edition.blocks.filter((b) => b.kind === "equation").map((b) => b.id);
    assert.ok(blocks.length > 0);
    assert.deepEqual(
      [...new Set(result.displays.map((d) => d.display))].sort(),
      [...blocks].sort(),
    );
  });

  test("every marked term binds a registered quantity id", async () => {
    const result = await checkPaperDisplays(ROOT, PAPER);
    const terms = result?.displays.flatMap((d) => d.terms) ?? [];
    assert.ok(terms.length > 0);
    for (const t of terms) assert.equal(isRegisteredQuantityId(t.quantityId), true, t.quantityId);
  });

  test("each entry's LaTeX is its source block's, byte for byte", () => {
    for (const entry of file.displays) {
      const block = edition.blocks.find((b) => b.id === entry.display);
      const math = block?.inlines.find((i) => i.kind === "math");
      assert.ok(math && math.kind === "math", entry.display);
      assert.equal(entry.latex, math.latex, entry.display);
    }
  });

  test("φ is read in its display's scope: the §8 angle in ¶ 5, the emission angle from ¶ 7", async () => {
    const result = await checkPaperDisplays(ROOT, PAPER);
    const phi = (display: string) =>
      result?.displays.find((d) => d.display === display)?.terms.find((t) => t.glyph === "\\varphi")
        ?.quantityId;
    assert.equal(phi("eq-s0-d1"), "propagationAngleStationary");
    assert.equal(phi("eq-s0-d3"), "emissionAngle");
  });

  test("a copy that differs only in punctuation shares the bindings: ¶ 5 prints d1 without its comma", async () => {
    const result = await checkPaperDisplays(ROOT, PAPER);
    const copies = result?.displays.filter((d) => d.display === "eq-s0-d1") ?? [];
    assert.equal(new Set(copies.map((d) => d.latex)).size, copies.length);
    assert.ok(copies.length > 1, "the paragraph copy is its own variant");
    const [own, ...others] = copies;
    for (const copy of others)
      assert.deepEqual(
        copy.terms.map((t) => [t.termId, t.quantityId]),
        own?.terms.map((t) => [t.termId, t.quantityId]),
      );
  });
});

describe("plants, each red for its own reason", () => {
  test("a wrong quantity id: one no registry holds", async () => {
    const planted = withEntry("eq-s0-d7", (e) => ({
      ...e,
      terms: e.terms.map((t) => (t.glyph === "V" ? { ...t, quantityId: "speedOfLigth" } : t)),
    }));
    const found = await problems({ file: planted, edition });
    // The concordance, which reads V as speedOfLight throughout, objects as well.
    assert.deepEqual(
      found.map((p) => [p.code, p.display]),
      [
        ["display-terms-unregistered-quantity", "eq-s0-d7"],
        ["display-terms-concordance-conflict", "eq-s0-d7"],
      ],
    );
  });

  test("a wrong quantity id the concordance contradicts: φ in ¶ 5 bound as the emission angle", async () => {
    const planted = withEntry("eq-s0-d1", (e) => ({
      ...e,
      terms: e.terms.map((t) =>
        t.glyph === "\\varphi" ? { ...t, quantityId: "emissionAngle" } : t,
      ),
    }));
    const found = await problems({ file: planted, edition });
    assert.deepEqual(
      found.map((p) => [p.code, p.display]),
      [["display-terms-concordance-conflict", "eq-s0-d1"]],
    );
    assert.match(found[0]?.message ?? "", /me\.phi\.propagationAngleStationary/);
  });

  test("an unbound glyph in a bound display", async () => {
    const planted = withEntry("eq-s0-d7", (e) => ({
      ...e,
      terms: e.terms.filter((t) => t.glyph !== "V"),
    }));
    const found = await problems({ file: planted, edition });
    assert.deepEqual(
      found.map((p) => [p.code, p.display]),
      [["display-terms-unbound-glyph", "eq-s0-d7"]],
    );
    assert.match(found[0]?.message ?? "", /"V"/);
  });

  test("a changed transcription: the block's bytes differ from the entry's", async () => {
    const block = edition.blocks.find((b) => b.id === "eq-s0-d7");
    const latex = block?.inlines.find((i) => i.kind === "math");
    assert.ok(latex && latex.kind === "math");
    const changed = latex.latex.replace("V^2", "V^{2}");
    assert.notEqual(changed, latex.latex);
    const found = await problems({
      file,
      edition: withBlockLatex("eq-s0-d7", "eq-s0-d7", changed),
    });
    assert.ok(found.length > 0);
    for (const p of found)
      assert.deepEqual([p.code, p.display], ["display-terms-transcription-changed", "eq-s0-d7"]);
  });

  test("a changed transcription in a copy: a letter differs in the paragraph that prints d7", async () => {
    const holder = edition.blocks.find(
      (b) =>
        b.id !== "eq-s0-d7" &&
        b.inlines.some((i) => i.kind === "math" && i.equationId === "eq-s0-d7"),
    );
    assert.ok(holder, "a paragraph prints d7 inline");
    const copy = holder.inlines.find((i) => i.kind === "math" && i.equationId === "eq-s0-d7");
    assert.ok(copy && copy.kind === "math");
    const found = await problems({
      file,
      edition: withBlockLatex(holder.id, "eq-s0-d7", copy.latex.replace("v^2", "u^2")),
    });
    assert.deepEqual(
      found.map((p) => [p.code, p.display]),
      [["display-terms-transcription-changed", "eq-s0-d7"]],
    );
    assert.match(found[0]?.message ?? "", /letters differ/);
  });

  test("display-terms-unused-glyph: a binding the display does not print", async () => {
    const planted = withEntry("eq-s0-d2", (e) => ({
      ...e,
      terms: [...e.terms, { glyph: "K_0", quantityId: "kineticEnergyBefore" }],
    }));
    const found = await problems({ file: planted, edition });
    assert.deepEqual(
      found.map((p) => [p.code, p.display]),
      [["display-terms-unused-glyph", "eq-s0-d2"]],
    );
  });

  test("display-terms-duplicate-glyph: one glyph bound twice, or bound and declared", async () => {
    const twice = withEntry("eq-s0-d2", (e) => ({
      ...e,
      terms: [...e.terms, e.terms[0] as never],
    }));
    const declared = withEntry("eq-s0-d2", (e) => ({
      ...e,
      notQuantities: [{ glyph: "L", reason: "planted" }],
    }));
    for (const planted of [twice, declared]) {
      const found = await problems({ file: planted, edition });
      assert.deepEqual(
        found.map((p) => [p.code, p.display]),
        [["display-terms-duplicate-glyph", "eq-s0-d2"]],
      );
    }
  });

  test("a declared non-quantity is accepted with its reason, and unused declarations are refused", async () => {
    const declared = withEntry("eq-s0-d7", (e) => ({
      ...e,
      terms: e.terms.filter((t) => t.glyph !== "V"),
      notQuantities: [{ glyph: "V", reason: "planted: declared instead of bound" }],
    }));
    assert.deepEqual(await problems({ file: declared, edition }), []);
    const unused = withEntry("eq-s0-d7", (e) => ({
      ...e,
      notQuantities: [{ glyph: "d", reason: "planted" }],
    }));
    const found = await problems({ file: unused, edition });
    assert.deepEqual(
      found.map((p) => [p.code, p.display]),
      [["display-terms-unused-glyph", "eq-s0-d7"]],
    );
  });

  test("display-terms-no-spoken, display-terms-glyph, display-terms-unknown-display", async () => {
    const cases: [DisplayTermsFile, string, string][] = [
      [
        withEntry("eq-s0-d2", (e) => ({ ...e, spoken: " " })),
        "display-terms-no-spoken",
        "eq-s0-d2",
      ],
      [
        withEntry("eq-s0-d2", (e) => ({
          ...e,
          terms: [...e.terms, { glyph: "E_0 - E_1", quantityId: "bodyEnergyRestBefore" }],
        })),
        "display-terms-glyph",
        "eq-s0-d2",
      ],
      [
        {
          ...file,
          displays: [
            ...file.displays,
            { ...(file.displays[0] as DisplayTermsFile["displays"][number]), display: "eq-s9-d9" },
          ],
        },
        "display-terms-unknown-display",
        "eq-s9-d9",
      ],
    ];
    for (const [planted, code, display] of cases) {
      const found = await problems({ file: planted, edition });
      assert.deepEqual(
        found.map((p) => [p.code, p.display]),
        [[code, display]],
        code,
      );
    }
  });

  test("display-terms-duplicate-display and display-terms-paper-mismatch", async () => {
    const twice = { ...file, displays: [...file.displays, file.displays[0] as never] };
    assert.deepEqual(
      (await problems({ file: twice, edition })).map((p) => p.code),
      ["display-terms-duplicate-display"],
    );
    const elsewhere = { ...file, paper: "light-quanta" };
    assert.deepEqual(
      (await problems({ file: elsewhere, edition })).map((p) => p.code),
      ["display-terms-paper-mismatch"],
    );
  });

  test("display-terms-shape: a malformed file is refused by name", () => {
    const refused = (raw: unknown) =>
      assert.throws(
        () => parseDisplayTerms(raw, "planted"),
        (e: unknown) => e instanceof DisplayTermsError && e.code === "display-terms-shape",
      );
    refused([]);
    refused({ paper: PAPER, displays: {} });
    refused({ paper: PAPER, displays: [], extra: 1 });
    refused({
      paper: PAPER,
      displays: [{ display: "d", latex: "x", spoken: "x", terms: [{ glyph: "x" }] }],
    });
    refused({ paper: PAPER, displays: [], notQuantities: [{ glyph: "d", reason: "" }] });
  });
});

describe("the concordance's reading of a glyph in a display's scope", () => {
  const entry = (id: string, scope: string[], latex: string, quantityId: string) =>
    ({
      id,
      scope,
      glyph: { unicode: latex, latex },
      binding: { quantityId },
    }) as unknown as ConcordanceEntry;
  const T = "char:T";
  const entries = [
    entry("lq.T.temperature", ["lq-s1"], "T", "temperature"),
    entry("lq.T.longAveragingInterval", ["lq-s1-fn3"], "T", "longAveragingInterval"),
  ];
  test("an entry scoped to the display's own footnote outranks the section's", () => {
    assert.equal(
      concordanceBinding(entries, T, { anchor: "s1-fn3", section: "s1" })?.binds,
      "longAveragingInterval",
    );
    assert.equal(
      concordanceBinding(entries, T, { anchor: "s1-p5", section: "s1" })?.binds,
      "temperature",
    );
  });
  test("two readings at the same level are no opinion; a glyph with no entry has none", () => {
    const clash = [...entries, entry("planted", ["lq-s1"], "T", "period")];
    assert.equal(concordanceBinding(clash, T, { anchor: "s1-p5", section: "s1" }), undefined);
    assert.equal(
      concordanceBinding(entries, "char:Q", { anchor: "s1-p5", section: "s1" }),
      undefined,
    );
  });
});

describe("the coloured render", () => {
  const checked = async (display: string) => {
    const result = await checkPaperDisplays(ROOT, PAPER);
    const found = result?.displays.find((d) => d.display === display);
    assert.ok(found, display);
    return found;
  };

  test("every term is marked with its quantity, and the MathML is the unmarked render's", async () => {
    for (const entry of file.displays) {
      const compiled = compilePrintedDisplay(await checked(entry.display));
      for (const t of compiled.terms)
        assert.ok(
          compiled.html.includes(`data-term="${t.termId}" data-quantity-id="${t.quantityId}"`),
          t.termId,
        );
      const plain = renderToString(entry.latex, FACE_KATEX);
      const mathml = (html: string) =>
        html.slice(html.indexOf('<span class="katex-mathml">'), html.indexOf("</math>") + 7);
      assert.equal(mathml(compiled.html), mathml(plain), entry.display);
      assert.equal(compiled.html.includes("htmlData"), false, entry.display);
    }
  });

  test("display-terms-term-dropped: a term KaTeX will not mark fails the build", () => {
    const planted: CheckedDisplay = {
      paper: PAPER,
      display: "planted",
      latex: "E_0 = L",
      spoken: "planted",
      // KaTeX escapes & in the attribute it writes, so the marker the check looks for is absent.
      terms: [
        { termId: "a&b", quantityId: "bodyEnergyRestBefore", glyph: "E_0", start: 0, end: 3 },
      ],
    };
    assert.throws(
      () => compilePrintedDisplay(planted),
      (e: unknown) => e instanceof DisplayTermsError && e.code === "display-terms-term-dropped",
    );
  });

  test("display-terms-mathml-changed: a mark that regroups the formula fails the build", () => {
    const planted: CheckedDisplay = {
      paper: PAPER,
      display: "planted",
      latex: "a - b",
      spoken: "planted",
      // Not an atom: "a -" wrapped in one group changes the MathML's rows.
      terms: [{ termId: "planted.t1", quantityId: "frameSpeed", glyph: "a", start: 0, end: 3 }],
    };
    assert.throws(
      () => compilePrintedDisplay(planted),
      (e: unknown) => e instanceof DisplayTermsError && e.code === "display-terms-mathml-changed",
    );
  });
});

describe("what the build refuses to publish", () => {
  const display = { paper: PAPER, display: "eq-s0-d1", latex: "l^* = l" };
  test("display-terms-invalid: any problem stops the build", () => {
    assert.throws(
      () =>
        assertPublishable({
          displays: [],
          problems: [
            { code: "display-terms-unbound-glyph", display: "eq-s0-d7", message: "planted" },
          ],
        }),
      (e: unknown) => e instanceof DisplayTermsError && e.code === "display-terms-invalid",
    );
  });
  test("display-terms-key-collision: one display printed alike in two papers", () => {
    assert.doesNotThrow(() => assertPublishable({ displays: [display, display], problems: [] }));
    assert.throws(
      () =>
        assertPublishable({
          displays: [display, { ...display, paper: "light-quanta" }],
          problems: [],
        }),
      (e: unknown) => e instanceof DisplayTermsError && e.code === "display-terms-key-collision",
    );
  });
});
