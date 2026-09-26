/**
 * A laboratory's formulas are coloured in its paper's notation, or name the glyphs that stop them
 * (dispatch 274).
 *
 * Each lab page is rendered as the static export renders it, and every formula it prints through
 * LabFormula or LabInlineFormula is one of three things:
 * - coloured: inside the paper's data-paper island, with at least one term marked by quantity;
 * - resolved with nothing to colour: every atom an operator or a declared non-quantity
 *   (data-lab-formula-bound="none");
 * - refused: printed as before, naming the glyphs the resolver could not bind in the lab's scope
 *   (data-inline-refused). These are the gaps the concordance and the exceptions still have to
 *   close, and this file prints them per lab.
 * A formula that is none of these is plain in silence, and fails here.
 *
 * The labs are those converted so far, named here so a lab that loses its formulas fails.
 *
 * Resolving is not being right, so the second part checks the lab's own letters
 * (content/inline-terms/labs.yaml): each binding found wrong when the coloured terms were read
 * against their pages (relativity's labs writing β for v/V, light quanta's W for the escape work)
 * is pinned here by lab and glyph, so the wrong colour cannot come back.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import type { ReactElement } from "react";
import {
  LAB_INLINES_PATH,
  LabInlineTermsError,
  labFormula,
  labScope,
  loadLabInlineTerms,
  parseLabInlineTerms,
} from "../../equations/printed/labInlines.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";

const LABS = [
  "lq-01",
  "lq-02",
  "lq-04",
  "lq-06",
  "lq-08",
  "lq-09",
  "bm-01",
  "bm-02",
  "bm-03",
  "bm-04",
  "bm-05",
  "bm-06",
  "bm-07",
  "bm-08",
  "sr-01",
  "sr-02",
  "sr-03",
  "sr-05",
  "sr-06",
  "sr-07",
  "sr-08",
  "sr-09",
  "sr-10",
  "sr-11",
  "sr-12",
  "sr-13",
  "me-01",
  "me-02",
  "me-03",
] as const;

/** How many LabFormula and LabInlineFormula sites the lab's page source holds. */
function sourceSites(lab: string): number {
  const text = readFileSync(join("src/app/lab", lab, "page.tsx"), "utf8");
  return (text.match(/<Lab(?:Inline)?Formula\b/g) ?? []).length;
}

async function page(lab: string) {
  const route = (await import(join(process.cwd(), "src/app/lab", lab, "page.tsx"))) as {
    default: (props: unknown) => ReactElement | Promise<ReactElement>;
  };
  const html = await exportMarkup(
    await route.default({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }),
  );
  const { document } = new Window();
  document.body.innerHTML = html;
  return document;
}

describe("a lab's formulas are coloured in its paper's notation, or name their gaps", () => {
  for (const lab of LABS)
    test(`${lab}: every formula is coloured, has nothing to colour, or names its unbound glyphs`, async () => {
      const document = await page(lab);
      const formulas = [...document.querySelectorAll(`[data-lab-formula="${lab}"]`)];
      const coloured = formulas.filter(
        (f) =>
          f.classList.contains("printed-display-terms") &&
          f.getAttribute("data-paper") === labScope(lab)?.paper &&
          f.querySelector("[data-quantity-id]") !== null,
      );
      const bare = formulas.filter((f) => f.getAttribute("data-lab-formula-bound") === "none");
      const refused = formulas.filter((f) => (f.getAttribute("data-inline-refused") ?? "") !== "");
      const silent = formulas.filter(
        (f) => !coloured.includes(f) && !bare.includes(f) && !refused.includes(f),
      );
      // Every site the page's source holds renders at least once.
      expect(formulas.length).toBeGreaterThanOrEqual(sourceSites(lab));
      expect(sourceSites(lab)).toBeGreaterThan(0);
      expect(silent.map((f) => f.getAttribute("data-latex"))).toEqual([]);
      const gaps = [
        ...new Set(refused.flatMap((f) => f.getAttribute("data-inline-refused")?.split(" ") ?? [])),
      ];
      console.log(
        `[labFormulas] ${lab}: ${formulas.length} formulas, ${coloured.length} coloured, ${bare.length} nothing to colour, ${refused.length} refused; unbound: ${gaps.join(" ")}`,
      );
    });

  test("the converted labs colour some formulas: the resolver reaches them", async () => {
    let coloured = 0;
    for (const lab of LABS) {
      const document = await page(lab);
      coloured += document.querySelectorAll(
        `.printed-display-terms[data-lab-formula="${lab}"] [data-quantity-id]`,
      ).length;
    }
    expect(coloured).toBeGreaterThan(0);
  });

  test("plant: a glyph the lab's scope does not bind is refused, naming its lab and the glyph", () => {
    const result = labFormula("lq-08", String.raw`\Xi_{\text{plant}} = 1`, false);
    expect(result.kind).toBe("refused");
    if (result.kind !== "refused") return;
    expect(result.problems.some((p) => p.where === "lab lq-08" && p.glyph.includes("\\Xi"))).toBe(
      true,
    );
  });
});

/** The quantity each term of a resolved formula is bound to, by glyph; or the refused glyphs. */
function bindings(lab: string, latex: string, printed = false) {
  const result = labFormula(lab, latex, false, printed);
  if (result.kind === "resolved")
    return Object.fromEntries(result.compiled.terms.map((t) => [t.glyph, t.quantityId]));
  return { refused: result.kind === "refused" ? result.problems.map((p) => p.glyph) : [] };
}

describe("a lab's own letters, read against its page (content/inline-terms/labs.yaml)", () => {
  test("a reading replaces the paper's readings of the letter in its lab", () => {
    // Each was coloured wrong before: W as the configuration probability, E as a radiation
    // energy, n as the count where the lab's modern formula means the density.
    expect(bindings("lq-08", String.raw`W = \Phi`)).toEqual({
      W: "workFunction",
      "\\Phi": "workFunction",
    });
    expect(bindings("lq-09", String.raw`E = 9{,}6\cdot 10^3\text{ emu}`)).toEqual({
      E: "gramEquivalentCharge",
    });
    expect(bindings("bm-03", String.raw`\Pi = n k_B T`)).toMatchObject({ n: "numberDensity" });
  });

  test("an unread letter is refused and named, never coloured as the paper's reading", () => {
    // The paper's β is the factor the moderns call γ; these labs write β for v/V.
    expect(bindings("sr-05", String.raw`\beta^2/(1+\sqrt{1-\beta^2})`)).toEqual({
      refused: ["\\beta", "\\beta"],
    });
    expect(
      bindings("sr-10", String.raw`\frac{E'}{E} = \frac{\nu'}{\nu} = \gamma(1 - \beta\cos\varphi)`),
    ).toEqual({ refused: ["\\beta"] });
    expect(bindings("lq-09", String.raw`V \approx 6{,}6\text{ Volts}`)).toEqual({ refused: ["V"] });
  });

  test("an exception leaves a point in neutral ink, with nothing to colour", () => {
    for (const glyph of ["A", "B"]) {
      const result = labFormula("sr-03", glyph, false);
      expect(result.kind).toBe("resolved");
      if (result.kind === "resolved") expect(result.compiled.terms).toEqual([]);
    }
  });

  test("a formula quoted as printed reads the paper's notation alone", () => {
    expect(bindings("bm-03", String.raw`\Pi = n k_B T`, true)).toMatchObject({
      n: "particleCount",
    });
    expect(bindings("sr-05", String.raw`\beta`, true)).toEqual({ "\\beta": "lorentzFactor" });
  });

  test("a lab's letters reach no other lab", () => {
    // sr-03 reads § 4 too, where the paper's β is the Lorentz factor; lq-06 reads W in § 5.
    expect(bindings("sr-03", String.raw`\beta`)).toEqual({ "\\beta": "lorentzFactor" });
    expect(bindings("lq-06", "W")).toEqual({ W: "configurationProbability" });
  });

  test("every entry names a letter its lab's page writes, so none is dead", async () => {
    const file = loadLabInlineTerms();
    const entries = [...file.readings, ...file.unread, ...file.exceptions];
    expect(entries.length).toBeGreaterThan(0);
    const written = new Map<string, readonly string[]>();
    const dead: string[] = [];
    for (const entry of entries) {
      if (!written.has(entry.lab))
        written.set(
          entry.lab,
          [...(await page(entry.lab)).querySelectorAll(`[data-lab-formula="${entry.lab}"]`)].map(
            (f) =>
              f.querySelector("[data-latex]")?.getAttribute("data-latex") ??
              f.getAttribute("data-latex") ??
              "",
          ),
        );
      // The glyph as a whole name: not inside a longer command or word.
      const escaped = entry.glyph.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
      const atom = new RegExp(`(^|[^A-Za-z\\\\])${escaped}($|[^A-Za-z])`);
      if (!written.get(entry.lab)?.some((latex) => atom.test(latex)))
        dead.push(`${entry.lab} ${entry.glyph}`);
    }
    expect(dead).toEqual([]);
  });

  test("the file's entries are checked (lab-inline-terms-invalid)", () => {
    const refusal = (raw: unknown) => {
      try {
        parseLabInlineTerms(raw, LAB_INLINES_PATH, (id) => id === "workFunction");
      } catch (error) {
        expect(error).toBeInstanceOf(LabInlineTermsError);
        return (error as LabInlineTermsError).code;
      }
      return "accepted";
    };
    const reason = "A reason long enough to be a sentence about the lab.";
    expect(refusal({ readings: { lab: "lq-08" } })).toBe("lab-inline-terms-invalid");
    expect(refusal({ unread: [{ lab: "lab-8", glyph: "W", reason }] })).toBe(
      "lab-inline-terms-invalid",
    );
    expect(refusal({ exceptions: [{ lab: "sr-03", glyph: "AB", reason }] })).toBe(
      "lab-inline-terms-invalid",
    );
    expect(
      refusal({ readings: [{ lab: "lq-08", glyph: "W", quantityId: "workFunktion", reason }] }),
    ).toBe("lab-inline-terms-invalid");
    expect(refusal({ unread: [{ lab: "sr-05", glyph: "\\beta", reason: "v/V" }] })).toBe(
      "lab-inline-terms-invalid",
    );
    expect(
      refusal({ readings: [{ lab: "lq-08", glyph: "W", quantityId: "workFunction", reason }] }),
    ).toBe("accepted");
  });
});
