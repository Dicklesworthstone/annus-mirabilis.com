/**
 * An explanation for every printed display (dispatch 278): the records' check, census and compile.
 *
 * The census is printed per paper with its denominator, and an enforced paper's records in the tree
 * must all pass; another paper's refused records are printed by name. Each refusal has a plant: a record written in memory for mass-energy's first display, wrong in
 * exactly one way, must be refused with its own code and name the display. A good record compiles in
 * colour: its phrases carry the display's quantity ids, and its step formula the same ids on its
 * glyphs.
 */
import { describe, expect, test } from "bun:test";
import {
  assertExplanationsPublishable,
  checkPaperExplanations,
  ENFORCED_EXPLANATION_PAPERS,
  EquationExplanationsError,
  type ExplanationSource,
} from "./equationExplanations.ts";

const ROOT = process.cwd();
const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"];

/** Mass-energy's first display, l* = l (1 - v/V cos φ)/√(1 - (v/V)²), read correctly. */
const GOOD = {
  display: "eq-s0-d1",
  paper: "mass-energy",
  inWords: [
    { text: "The energy of the light", quantityId: "lightComplexEnergyMoving" },
    { text: " measured in the moving system equals " },
    { text: "its energy in the body's own system", quantityId: "lightComplexEnergyStationary" },
    { text: ", times a factor set by " },
    { text: "the speed of the moving system", quantityId: "frameSpeed" },
    { text: ", " },
    { text: "the speed of light", quantityId: "speedOfLight" },
    { text: " and " },
    { text: "the angle of the light's path", quantityId: "propagationAngleStationary" },
    { text: "." },
  ],
  r0: "The energy of a light complex depends on the system it is measured in.",
  r1: "The factor holds $v$ against $V$ and the angle $\\varphi$.",
  r2: [{ latex: "l^* = l", why: "At $v = 0$ the factor is 1." }],
};

const plant = (raw: unknown, file = "eq-s0-d1.yaml"): ExplanationSource[] => [{ file, raw }];
const codes = async (sources: ExplanationSource[], enforced: readonly string[] = []) =>
  (await checkPaperExplanations(ROOT, "mass-energy", { sources, enforced })).problems.map(
    (p) => p.code,
  );

describe("the explanation records", () => {
  test("every paper's census is printed, each display explained, refused or missing, and an enforced paper's records pass", async () => {
    let displays = 0;
    for (const paper of PAPERS) {
      const checked = await checkPaperExplanations(ROOT, paper);
      const { census } = checked;
      console.log(
        `explanations ${paper}: ${census.explained} of ${census.displays} displays explained, ${census.refused} refused, ${census.missing} with no record`,
      );
      // Every display is in exactly one bucket.
      expect(census.explained + census.refused + census.missing).toBe(census.displays);
      expect(checked.missing.length).toBe(census.missing);
      if (ENFORCED_EXPLANATION_PAPERS.includes(paper))
        expect(checked.problems.map((p) => p.message)).toEqual([]);
      else
        for (const p of checked.problems)
          console.log(`  refused, reported: ${p.code} ${p.display}`);
      displays += census.displays;
    }
    // Not vacuous: the four papers print displays, and each was counted.
    expect(displays).toBeGreaterThan(0);
  });

  test("a good record compiles in colour, its phrases and its step bound to the display's quantities", async () => {
    // enforced: [] so the six displays this fixture does not plant are reported, not refused.
    const checked = await checkPaperExplanations(ROOT, "mass-energy", {
      sources: plant(GOOD),
      enforced: [],
    });
    expect(checked.problems).toEqual([]);
    const [explained] = checked.explanations;
    expect(explained?.display).toBe("eq-s0-d1");
    expect(explained?.inWords.filter((p) => p.quantityId).length).toBe(5);
    expect(explained?.r2[0]?.formula).toContain('data-quantity-id="lightComplexEnergyMoving"');
    // In display style, with its MathML a block, but not wrapped as one of the paper's displays.
    expect(explained?.r2[0]?.formula).toContain('display="block"');
    expect(explained?.r2[0]?.formula).not.toContain('class="katex-display"');
    expect(explained?.r2[0]?.formula.startsWith('<span class="katex">')).toBe(true);
    const math = explained?.r1.filter((p) => p.kind === "math") ?? [];
    expect(math.length).toBe(3);
    expect(math.every((p) => p.kind === "math" && p.html.includes("data-quantity-id"))).toBe(true);
    expect(checked.census).toEqual({ displays: 7, explained: 1, refused: 0, missing: 6 });
  });

  test("each refusal is refused with its own code, naming the display", async () => {
    expect(await codes(plant("not a record"))).toEqual(["explanation-unreadable"]);
    expect(await codes(plant({ ...GOOD, display: "eq-s0-d2" }))).toEqual(["explanation-misfiled"]);
    expect(await codes(plant({ ...GOOD, paper: "light-quanta" }))).toEqual([
      "explanation-misfiled",
    ]);
    expect(await codes(plant({ ...GOOD, display: "eq-s0-d99" }, "eq-s0-d99.yaml"))).toEqual([
      "explanation-unknown-display",
    ]);
    expect(await codes(plant({ ...GOOD, r2: [] }))).toEqual(["explanation-missing-level"]);
    expect(await codes(plant({ ...GOOD, r0: "" }))).toEqual(["explanation-missing-level"]);
    expect(await codes(plant({ ...GOOD, r2: [{ latex: "l" }] }))).toEqual([
      "explanation-missing-level",
    ]);
    expect(await codes(plant({ ...GOOD, inWords: GOOD.inWords.slice(0, 7) }))).toEqual([
      "explanation-words-missing-quantity",
    ]);
    expect(
      await codes(
        plant({ ...GOOD, inWords: [...GOOD.inWords, { text: " x", quantityId: "temperature" }] }),
      ),
    ).toEqual(["explanation-words-extra-quantity"]);
    // q names nothing in mass-energy's notation, in a step and in prose alike.
    expect(await codes(plant({ ...GOOD, r2: [{ latex: "q = l", why: "Planted." }] }))).toEqual([
      "explanation-formula-refused",
    ]);
    expect(await codes(plant({ ...GOOD, r1: "It holds for $q$." }))).toEqual([
      "explanation-formula-refused",
    ]);
    expect(await codes(plant({ ...GOOD, r2: [{ latex: "\\frac{l", why: "Planted." }] }))).toEqual([
      "explanation-formula-refused",
    ]);
    expect(await codes(plant({ ...GOOD, r0: "It clearly depends on the system." }))).toEqual([
      "explanation-voice",
    ]);
    expect(await codes(plant({ ...GOOD, r1: "It holds — always." }))).toEqual([
      "explanation-voice",
    ]);
    const named = await checkPaperExplanations(ROOT, "mass-energy", {
      sources: plant({ ...GOOD, r0: "" }),
      enforced: [],
    });
    expect(named.problems[0]?.display).toBe("eq-s0-d1");
    expect(named.problems[0]?.message).toContain("eq-s0-d1");
  });

  test("an enforced paper refuses each display with no record, by name; any other reports it", async () => {
    const enforced = await checkPaperExplanations(ROOT, "mass-energy", {
      sources: plant(GOOD),
      enforced: ["mass-energy"],
    });
    expect(enforced.problems.map((p) => p.code)).toEqual(Array(6).fill("explanation-missing"));
    expect(enforced.problems.map((p) => p.display)).toContain("eq-s0-d7");
    const reported = await checkPaperExplanations(ROOT, "mass-energy", {
      sources: plant(GOOD),
      enforced: [],
    });
    expect(reported.problems).toEqual([]);
    expect(reported.missing).toContain("eq-s0-d7");
  });

  test("a display's own letters read as its terms bind them, in its explanation", async () => {
    // A_1 has no concordance entry of its own; light quanta's eq-s1-d4 binds it as a Fourier
    // amplitude, and its f is a sign the display declares, as the concordance reads it too.
    const checked = await checkPaperExplanations(ROOT, "light-quanta", {
      enforced: [],
      sources: plant(
        {
          display: "eq-s1-d4",
          paper: "light-quanta",
          inWords: [
            { text: "The probability", quantityId: "fourierValueProbability" },
            { text: " of the amplitudes", quantityId: "fourierAmplitude" },
            { text: " and phases", quantityId: "fourierPhase" },
            { text: "." },
          ],
          r0: "Planted.",
          r1: "Planted, with $A_1$ and $f$.",
          r2: [{ latex: "d W = f(A_1 A_2 \\ldots)", why: "Planted." }],
        },
        "eq-s1-d4.yaml",
      ),
    });
    expect(checked.problems.map((p) => p.message)).toEqual([]);
    expect(checked.explanations[0]?.r2[0]?.formula).toContain(
      'data-quantity-id="fourierAmplitude"',
    );
  });

  test("the build stops on a problem in an enforced paper, naming it, and reports one in any other", async () => {
    const refused = await checkPaperExplanations(ROOT, "mass-energy", {
      sources: plant({ ...GOOD, r0: "" }),
      enforced: [],
    });
    expect(() => assertExplanationsPublishable([refused], [])).not.toThrow();
    let caught: unknown;
    try {
      assertExplanationsPublishable([refused], ["mass-energy"]);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(EquationExplanationsError);
    expect((caught as EquationExplanationsError).code).toBe("equation-explanations-refused");
    expect((caught as Error).message).toContain("eq-s0-d1");
    const clean = await checkPaperExplanations(ROOT, "mass-energy", {
      sources: plant(GOOD),
      enforced: [],
    });
    expect(() => assertExplanationsPublishable([clean], ["mass-energy"])).not.toThrow();
  });
});
