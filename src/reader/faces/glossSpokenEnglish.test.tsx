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

  // Each assertion below is a reading that was WRONG until the corpus census named it
  // (am-rc1001-bridge-plan-pcjk.29): 26 of the 231 distinct inline expressions in the four
  // papers' source blocks were spoken as a raw glyph. The left-hand side is the printed form as
  // the papers set it, so a regression here is a reader hearing a character name again.
  test("the variant Greek the papers print is named, not spoken as its glyph", () => {
    // The Annalen sets rho as the variant; `\rho` was already named, `\varrho` was not.
    expect(speakMath("\\varrho")).toBe("rho");
    expect(speakMath("\\varrho_\\nu d \\nu")).toBe("rho sub nu d nu");
    expect(speakMath("\\varkappa")).toBe("kappa");
    expect(speakMath("2 \\varkappa N = R")).toBe("2 kappa N equals R");
    expect(speakMath("\\partial \\varphi / \\partial \\varrho")).toBe(
      "partial phi divided by partial rho",
    );
  });

  test("an accent over a letter is a word: the mean energy is 'E bar', not 'E' and a line", () => {
    // <mover> fell to the generic join, which said the base and then the combining character.
    expect(speakMath("\\overline{E}")).toBe("E bar");
    expect(speakMath("\\overline{E}_\\nu")).toBe("E bar sub nu");
    expect(speakMath("\\bar{E}")).toBe("E bar");
    // A limit under an operator is NOT an accent, so it keeps the generic reading. Displayed, the
    // limit really is a <munder>, which is the branch this controls; inline KaTeX emits <msub>.
    expect(speakMath("\\sum_\\nu", true)).toBe("the sum of nu");
    expect(speakMath("\\sum_\\nu", false)).toBe("the sum of sub nu");
  });

  test("the double-bar relations the compositor sets are read as relations", () => {
    expect(speakMath("A_\\nu \\geqq 0")).toBe("A sub nu is greater than or equal to 0");
    expect(speakMath("0 \\leqq \\alpha_\\nu \\leqq 2 \\pi")).toBe(
      "0 is less than or equal to alpha sub nu is less than or equal to 2 pi",
    );
    expect(speakMath("N \\neq 0")).toBe("N is not equal to 0");
    expect(speakMath("x \\gtrless 0")).toBe("x is greater or less than 0");
  });

  test("the large operators and the ellipsis are named", () => {
    expect(speakMath("p_1 \\ldots p_l")).toBe("p sub 1 dot dot dot p sub l");
    expect(speakMath("\\int \\varepsilon X d x")).toBe("the integral of epsilon X d x");
    expect(speakMath("\\sum \\frac{\\partial \\varphi_\\nu}{\\partial p_\\nu} = 0")).toBe(
      "the sum of the fraction with numerator partial phi sub nu, and denominator partial p sub nu, " +
        "end fraction equals 0",
    );
  });
});

/**
 * WHICH OF THE THREE READINGS A FORMULA GETS (am-rc1001-bridge-plan-pcjk.29).
 *
 * Before `spoken` existed, `speakInlines` offered exactly one override and keyed it by
 * `equationId`. A non-display inline carries none -- 1428 of the 1828 non-display inlines in the
 * corpus, the 714 per face -- so for the whole population that needed correcting the parameter was
 * unreachable, and no caller in production passes it at all. These tests pin the precedence that
 * makes it reachable, and the last one is the control: without an authored form nothing changes,
 * so the generated reading is still what nearly every expression gets.
 */
describe("speakInlines precedence", () => {
  const authored = new Map([["eq-s0-d1", "the modern form nobody should hear here"]]);

  test("the node's own authored form wins over the generated reading", () => {
    expect(
      speakInlines([{ kind: "math", latex: "\\overline{E}", spoken: "mean energy E bar" }]),
    ).toBe("mean energy E bar");
  });

  test("it wins over the caller's map too, because it is authored for THIS occurrence", () => {
    expect(
      speakInlines(
        [{ kind: "math", latex: "\\overline{E}", equationId: "eq-s0-d1", spoken: "E bar" }],
        authored,
      ),
    ).toBe("E bar");
  });

  test("the map still applies to a formula that has no form of its own", () => {
    expect(
      speakInlines([{ kind: "math", latex: "\\overline{E}", equationId: "eq-s0-d1" }], authored),
    ).toBe("the modern form nobody should hear here");
  });

  test("and with neither, the reading is generated -- the case that covers the whole corpus", () => {
    expect(speakInlines([{ kind: "math", latex: "\\overline{E}" }])).toBe("E bar");
    // Words around the formula are kept, which is the reason speakInlines exists at all.
    expect(
      speakInlines([
        { kind: "text", text: "die mittlere Energie " },
        { kind: "math", latex: "\\overline{E}_\\nu", spoken: "E bar sub nu" },
        { kind: "text", text: " des Resonators" },
      ]),
    ).toBe("die mittlere Energie E bar sub nu des Resonators");
  });
});
