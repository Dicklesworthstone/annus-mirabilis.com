/**
 * What a screen reader hears for the gloss face's aligned English keeps every word and every
 * quantity (dispatch 152): each formula is spoken (mathSpeech.ts), where the button's label used to
 * keep text inlines alone. Run on mass-energy's compiled edition, on the rendered markup.
 */
import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { getModalityClasses } from "../../content/schemas/glossConventions.ts";
import type { ReviewRecord } from "../../content/schemas/review.ts";
import type { GlossUnit } from "../../content/schemas/source.ts";
import { loadBilingualEdition } from "./bilingualLoader.ts";
import { GlossFace } from "./GlossFace.tsx";
import { speakInlines, speakMath } from "./mathSpeech.ts";

const edition = await loadBilingualEdition("mass-energy");
if (edition === null) throw new Error("mass-energy has no compiled edition");
const gloss = edition.glossUnits ?? [];

function renderGloss(
  glossUnits: readonly GlossUnit[],
  reviewRecords: readonly ReviewRecord[] = [],
) {
  if (edition === null) throw new Error("unreachable");
  const html = renderToStaticMarkup(
    <GlossFace
      paper={edition.paper}
      blocks={edition.blocks}
      glossUnits={glossUnits}
      translations={edition.units}
      alignment={edition.alignment}
      editorialNotes={edition.editorialNotes}
      reviewRecords={reviewRecords}
      modalityClasses={getModalityClasses()}
    />,
  );
  const { document } = new Window();
  document.body.innerHTML = html;
  return document;
}

describe("the aligned English a screen reader hears keeps every quantity", () => {
  const document = renderGloss(gloss);
  const heard = (sentence: string) =>
    document
      .querySelector(`section[data-sentence-id="${sentence}"] [data-action="read-translation"]`)
      ?.getAttribute("aria-label") ?? "";

  test("s0-p6-s1: E_0, and the coordinates, are spoken", () => {
    const label = heard("s0-p6-s1");
    expect(label.startsWith("Read the aligned English translation: ")).toBe(true);
    expect(label).toContain("E sub 0");
    expect(label).toContain("open paren x, y, z close paren");
    // No word is glued to its neighbour or split from its punctuation.
    expect(label).not.toMatch(/\s[,.;]/);
  });

  test("s0-p12-s1: L over V squared is spoken", () => {
    expect(heard("s0-p12-s1")).toContain("L divided by V squared");
    // A formula takes the spacing its line prints: "the $x$-axis" is not "the x -axis".
    expect(heard("s0-p5-s1")).toContain("with the x-axis of the system");
  });

  test("every aligned English line that holds a formula is heard whole", () => {
    const units = new Map((edition?.units ?? []).map((unit) => [unit.id, unit]));
    const missing: string[] = [];
    let checked = 0;
    for (const edge of edition?.alignment?.edges ?? []) {
      const sentence = edge.source.sentenceId;
      const unit = units.get(edge.target.translationUnitId);
      if (sentence === undefined || unit === undefined) continue;
      if (!unit.inlines.some((inline) => inline.kind === "math")) continue;
      const label = heard(sentence);
      // A sentence with no gloss unit shows the coverage notice and has no button to hear.
      if (label === "") continue;
      checked += 1;
      if (!label.includes(speakInlines(unit.inlines))) missing.push(`${sentence} -> ${unit.id}`);
    }
    // Non-vacuity: the population is the sentences whose English carries a formula.
    expect(checked).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });
});

describe("speakMath", () => {
  test("says the printed symbols in words, with structure", () => {
    expect(speakMath("E_0")).toBe("E sub 0");
    expect(speakMath("(\\xi, \\eta, \\zeta)")).toBe("open paren xi, eta, zeta close paren");
    expect(speakMath("L/9 \\cdot 10^{20}")).toBe("L divided by 9 times 10 to the power 20");
    expect(
      speakMath(
        "l^* = l \\frac{1 - \\frac{v}{V} \\cos \\varphi}{\\sqrt{1 - \\left(\\frac{v}{V}\\right)^2}}",
      ),
    ).toBe(
      "l star equals l the fraction with numerator 1 minus v over V cosine phi, and denominator the square root of 1 minus open paren v over V close paren squared, end root, end fraction",
    );
  });
});
