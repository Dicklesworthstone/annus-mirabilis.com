/**
 * The laboratories' formula explanations (labExplanations.ts, dispatch 291): the census counts the
 * real population, the three kinds of entry each do what they say, and each way of getting an entry
 * wrong is refused by name.
 *
 * THE PLANTS GO THROUGH `sources`, never through a file. This checkout is edited by several agents
 * at once, so a test that wrote content/lab-explanations/<lab>.yaml could be swept into a peer's
 * commit between writing it and removing it. Every negative below is a record that exists only for
 * the length of one assertion.
 */
import { describe, expect, test } from "bun:test";
import {
  assertLabExplanationsPublishable,
  checkLabExplanations,
  type LabExplanationSource,
  LabExplanationsError,
} from "./labExplanations.ts";
import { labFormulaSites } from "./labFormulaSites.ts";
import { printedExplanation } from "./printedExplanations.ts";

/** LQ-08's three displayed formulas, as its page writes them. */
const PRINTED_LAW = "\\Pi\\varepsilon = \\frac{R}{N}\\beta\\nu - P";
const MODERN_LAW = "e V_s = h\\nu - \\Phi \\implies V_s = \\frac{h}{e}\\nu - \\frac{\\Phi}{e}";
const WORKED_VALUE = "V_s \\approx \\frac{h\\nu}{e} \\approx 4.3\\ \\text{V}";

/** An own record needs an id, and every plant below carries one so it reaches its own predicate. */
const PLANT_ID = "lab-lq-08-plant";

const checked = checkLabExplanations(process.cwd(), { displayRecord: printedExplanation });

/** The codes a planted record produces, with the real files left out of the run. */
function codesOf(raw: unknown, lab = "lq-08"): string[] {
  const sources: LabExplanationSource[] = [{ lab, raw }];
  return checkLabExplanations(process.cwd(), {
    sources,
    displayRecord: printedExplanation,
  }).problems.map((p) => p.code);
}

/** A record of one entry, for a plant. */
const record = (entry: object) => ({ lab: "lq-08", formulas: [entry] });

describe("the laboratories' formula explanations", () => {
  test("the census counts every displayed formula, so an empty run is not a clean one", () => {
    const displayed = labFormulaSites().filter((site) => site.display).length;
    expect(displayed).toBeGreaterThan(50);
    expect(checked.census.displayed).toBe(displayed);
    // Every displayed formula is either explained, judged incidental, or counted missing: no
    // formula falls out of the population without anyone deciding about it.
    expect(checked.census.explained + checked.census.incidental + checked.census.missing).toBe(
      displayed,
    );
  });

  test("the entries in the tree are clean", () => {
    expect(checked.problems.map((p) => `${p.code}: ${p.message}`)).toEqual([]);
  });

  test("a formula the paper prints carries the paper's own record, and its identity", () => {
    const explainer = checked.explainers.get("lq-08")?.get(PRINTED_LAW);
    expect(explainer).toBeDefined();
    // The identity is the printed display's, so the panel fetches the fragment the reading face
    // fetches and the no-script link goes to the page that already holds every level
    // (explainerLinks.ts, dispatch 292). A reused record needs no address of its own.
    expect(explainer?.display).toBe("eq-s8-d2");
    expect(explainer?.paper).toBe("light-quanta");
    expect(explainer?.inWords.length).toBeGreaterThan(0);
    // Since dispatch 292 the payload carries the words and the names of the levels, not the levels
    // themselves; this record's names are the ones its reading face shows.
    expect(explainer?.levels).toEqual(["0", "1", "2"]);
  });

  test("a form the paper does not print carries the lab's own words and says so in its margin", () => {
    const explainer = checked.explainers.get("lq-08")?.get(MODERN_LAW);
    expect(explainer).toBeDefined();
    expect(explainer?.display).toBeUndefined();
    expect(explainer?.r1).toBeDefined();
    expect((explainer?.r2 ?? []).length).toBeGreaterThan(0);
    const margin = (explainer?.r3 ?? [])
      .map((part) => (part.kind === "text" ? part.text : ""))
      .join("");
    expect(margin).toContain("not Einstein's");
  });

  test("a phrase of the words is bound only where the lab's own formula binds that quantity", () => {
    for (const explainer of checked.explainers.get("lq-08")?.values() ?? []) {
      for (const phrase of explainer.inWords) {
        if (phrase.quantityId === undefined) continue;
        expect(typeof phrase.quantityId).toBe("string");
        expect(phrase.text.length).toBeGreaterThan(0);
      }
    }
    // The modern law binds five quantities and no more, so no phrase of its words can name one of
    // the printed law's constants.
    const modern = checked.explainers.get("lq-08")?.get(MODERN_LAW);
    const named = new Set(
      (modern?.inWords ?? []).flatMap((p) => (p.quantityId ? [p.quantityId] : [])),
    );
    expect(named.has("molarGasConstant")).toBe(false);
    expect(named.has("avogadroConstant")).toBe(false);
    expect(named.size).toBeGreaterThan(0);
  });

  test("a formula judged incidental carries no control and is not counted missing", () => {
    expect(checked.explainers.get("lq-08")?.has(WORKED_VALUE)).toBe(false);
    expect(checked.missing.some((entry) => entry.includes("4.3"))).toBe(false);
    expect(checked.census.incidental).toBeGreaterThan(0);
  });

  describe("each way of getting an entry wrong is refused by name", () => {
    test("a latex no formula on the page has", () => {
      expect(codesOf(record({ latex: "E = m c^2", display: "eq-s8-d2" }))).toContain(
        "lab-explanation-unknown-formula",
      );
    });

    test("a latex that differs from the page's by one character", () => {
      expect(codesOf(record({ latex: `${PRINTED_LAW} `, display: "eq-s8-d2" }))).toContain(
        "lab-explanation-unknown-formula",
      );
    });

    test("an entry that is two kinds at once", () => {
      expect(
        codesOf(record({ latex: PRINTED_LAW, display: "eq-s8-d2", incidental: "and also this" })),
      ).toContain("lab-explanation-kind");
    });

    test("an entry that is no kind at all", () => {
      expect(codesOf(record({ latex: PRINTED_LAW }))).toContain("lab-explanation-kind");
    });

    test("an incidental entry with no reason recorded", () => {
      expect(codesOf(record({ latex: PRINTED_LAW, incidental: "  " }))).toContain(
        "lab-explanation-kind",
      );
    });

    test("a display that has no record to reuse", () => {
      expect(codesOf(record({ latex: PRINTED_LAW, display: "eq-s8-d99" }))).toContain(
        "lab-explanation-missing-display-record",
      );
    });

    test("words naming a quantity the lab's formula does not bind", () => {
      const codes = codesOf(
        record({
          latex: MODERN_LAW,
          own: {
            id: PLANT_ID,
            inWords: [{ text: "The gas constant", quantityId: "molarGasConstant" }],
            r1: "A full explanation.",
          },
        }),
      );
      expect(codes).toContain("lab-explanation-words-extra-quantity");
    });

    test("a step whose formula the lab cannot read", () => {
      const codes = codesOf(
        record({
          latex: MODERN_LAW,
          own: {
            id: PLANT_ID,
            inWords: [{ text: "The frequency", quantityId: "frequency" }],
            r1: "A full explanation.",
            r2: [{ latex: "\\Xi_{\\text{plant}} = 1", why: "A step with a glyph nothing binds." }],
          },
        }),
      );
      expect(codes).toContain("lab-explanation-formula-refused");
    });

    test("prose that breaks the edition's voice", () => {
      const codes = codesOf(
        record({
          latex: MODERN_LAW,
          own: {
            id: PLANT_ID,
            inWords: [{ text: "The frequency", quantityId: "frequency" }],
            r1: "Obviously the law is a straight line in the frequency.",
          },
        }),
      );
      expect(codes).toContain("lab-explanation-voice");
    });

    test("an own record with no full explanation", () => {
      const codes = codesOf(
        record({
          latex: MODERN_LAW,
          own: { id: PLANT_ID, inWords: [{ text: "The frequency", quantityId: "frequency" }] },
        }),
      );
      expect(codes).toContain("lab-explanation-missing-level");
    });

    test("a phrase whose YAML did not parse as written", () => {
      // The site's parser accepts `- text: "A", "quantityId": b` and hands back one phrase whose
      // text is that whole line. It reached a committed record once and the census called it clean.
      const codes = codesOf(
        record({
          latex: MODERN_LAW,
          own: {
            id: PLANT_ID,
            inWords: [{ text: '"The frequency", "quantityId": frequency' }],
            r1: "A full explanation.",
          },
        }),
      );
      expect(codes).toContain("lab-explanation-unreadable");
    });

    test("an own record with no id, which would have no fragment and no page", () => {
      const codes = codesOf(
        record({
          latex: MODERN_LAW,
          own: {
            inWords: [{ text: "The frequency", quantityId: "frequency" }],
            r1: "A full explanation.",
          },
        }),
      );
      expect(codes).toContain("lab-explanation-own-id");
    });

    test("an own record whose id does not name its lab", () => {
      const codes = codesOf(
        record({
          latex: MODERN_LAW,
          own: {
            id: "lab-sr-03-not-this-lab",
            inWords: [{ text: "The frequency", quantityId: "frequency" }],
            r1: "A full explanation.",
          },
        }),
      );
      expect(codes).toContain("lab-explanation-own-id");
    });

    test("a file naming a lab other than its own", () => {
      expect(codesOf({ lab: "lq-09", formulas: [] })).toContain("lab-explanation-misfiled");
    });

    test("the build's refusal carries its code, and a clean set passes", () => {
      const planted = checkLabExplanations(process.cwd(), {
        sources: [{ lab: "lq-08", raw: record({ latex: "E = m c^2", display: "eq-s8-d2" }) }],
        displayRecord: printedExplanation,
      });
      let caught: unknown;
      try {
        assertLabExplanationsPublishable(planted);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(LabExplanationsError);
      expect((caught as LabExplanationsError).code).toBe("lab-explanations-refused");
      // The refusal names what was wrong, not only that something was.
      expect((caught as Error).message).toContain("lab-explanation-unknown-formula");
      // And the tree as it stands is publishable, so the refusal is not thrown on every build.
      expect(() => assertLabExplanationsPublishable(checked)).not.toThrow();
    });

    test("a refused record is not drawn at all", () => {
      const sources: LabExplanationSource[] = [
        {
          lab: "lq-08",
          raw: record({
            latex: MODERN_LAW,
            own: {
              id: PLANT_ID,
              inWords: [{ text: "The frequency", quantityId: "frequency" }],
              r1: "A full explanation.",
              r2: [
                { latex: "\\Xi_{\\text{plant}} = 1", why: "A step with a glyph nothing binds." },
              ],
            },
          }),
        },
      ];
      const planted = checkLabExplanations(process.cwd(), {
        sources,
        displayRecord: printedExplanation,
      });
      expect(planted.explainers.get("lq-08")?.has(MODERN_LAW)).toBe(false);
      expect(planted.census.explained).toBe(0);
    });
  });
});
