/**
 * The gloss face prints each sentence's formulas and punctuation where the paper prints them
 * (am-read-gloss-face-lp2, glossStream.ts).
 *
 * WHY THIS EXISTS. GlossSentence rendered a gloss unit's word tokens and nothing else, so every
 * inline formula fell out of the German line: 42 in 15 of mass-energy's 34 sentences. The paper's
 * result, s0-p12-s1, read "... verkleinert sich seine Masse um" / "its mass by", with L/V^2 gone.
 *
 * The negative a naive implementation fails: the word-only rendering, the state this file was
 * written against, has no formula after "um" and no data-gloss-stream="printed" on any sentence.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { getModalityClasses } from "../../content/schemas/glossConventions.ts";
import type { Inline } from "../../content/schemas/inlines.ts";
import { loadBilingualEdition } from "./bilingualLoader.ts";
import { GlossFace } from "./GlossFace.tsx";

const edition = await loadBilingualEdition("mass-energy");
if (!edition) throw new Error("mass-energy has no bilingual edition to render");
const glossUnits = edition.glossUnits ?? [];
const html = renderToStaticMarkup(
  <GlossFace
    paper={edition.paper}
    blocks={edition.blocks}
    glossUnits={glossUnits}
    translations={edition.units}
    alignment={edition.alignment}
    modalityClasses={getModalityClasses()}
  />,
);

/** The German line of one sentence, in order: a word as its token index, a formula as its TeX. */
function line(sentenceId: string): { stream: string | null; items: string[] } {
  const start = html.indexOf(`data-sentence-id="${sentenceId}"`);
  if (start < 0) throw new Error(`${sentenceId} is not on the page`);
  const pairs = html.indexOf("data-pairs-container", start);
  const ends = [
    html.indexOf("reasoning-words-details", pairs),
    html.indexOf("</section>", pairs),
  ].filter((i) => i > -1);
  const body = html.slice(pairs, Math.min(...ends));
  const stream = /data-gloss-stream="([^"]+)"/.exec(html.slice(pairs, pairs + 200))?.[1] ?? null;
  const items = [
    ...body.matchAll(
      /data-token-index="(\d+)"|<annotation encoding="application\/x-tex">([^<]*)<\/annotation>/g,
    ),
  ].map((m) => (m[1] !== undefined ? `w${m[1]}` : `$${m[2]}$`));
  return { stream, items };
}

/** The inline formulas a sentence prints, from the source record itself, in order. */
function printedFormulas(inlines: readonly Inline[], from: number, to: number): string[] {
  const out: string[] = [];
  let offset = 0;
  const walk = (nodes: readonly Inline[]) => {
    for (const n of nodes) {
      if (n.kind === "emphasis") {
        walk(n.inlines);
        continue;
      }
      const width =
        n.kind === "text" || n.kind === "term" || n.kind === "reference"
          ? n.text.length
          : n.kind === "math"
            ? n.display
              ? 0
              : n.latex.length
            : n.kind === "footnote-mark"
              ? n.mark.length
              : n.kind === "space"
                ? (n.count ?? 1)
                : 0;
      if (n.kind === "math" && !n.display && offset >= from && offset + width <= to) {
        out.push(n.latex);
      }
      offset += width;
    }
  };
  walk(inlines);
  return out;
}

describe("the gloss face prints a sentence's formulas in place (am-read-gloss-face-lp2)", () => {
  test("the paper's result, s0-p12-s1, keeps L after 'Energie' and L/V^2 after 'um'", () => {
    const { stream, items } = line("s0-p12-s1");
    expect(stream).toBe("printed");
    // Gibt(0) ein(1) Körper(2) die(3) Energie(4) L in(5) ... seine(13) Masse(14) um(15) L/V^2.
    expect(items.slice(4, 7)).toEqual(["w4", "$L$", "w5"]);
    expect(items.slice(-2)).toEqual(["w15", "$L/V^2$"]);
    // The sentence's closing full stop is printed with the formula, not dropped.
    const start = html.indexOf('data-sentence-id="s0-p12-s1"');
    const atom = html.lastIndexOf('class="gloss-atom"', html.indexOf("</section>", start));
    const end = html.indexOf('class="gloss-english"', atom);
    expect(html.slice(atom, end)).toContain("</span>.</span>");
  });

  test("every sentence prints every inline formula of its source span, in order", () => {
    let sentences = 0;
    let formulas = 0;
    for (const block of edition.blocks) {
      for (const sp of block.sentenceSpans ?? []) {
        if (!glossUnits.some((u) => u.sentenceId === sp.id)) continue;
        if (
          block.kind !== "paragraph" &&
          block.kind !== "masthead" &&
          block.kind !== "closing" &&
          block.kind !== "footnote"
        )
          continue;
        const { stream, items } = line(sp.id);
        expect(stream, `${sp.id} fell back to its words alone`).toBe("printed");
        const expected = printedFormulas(block.inlines, sp.span.start, sp.span.end);
        expect(
          items.filter((i) => i.startsWith("$")).map((i) => i.slice(1, -1)),
          sp.id,
        ).toEqual(expected);
        sentences += 1;
        formulas += expected.length;
      }
    }
    // Non-vacuity, on purpose: the population must hold sentences, and sentences with formulas.
    expect(sentences).toBeGreaterThan(0);
    expect(formulas).toBeGreaterThan(0);
  });

  test("no formula on the face fails to typeset", () => {
    expect(html).not.toContain("katex-error");
  });
});
