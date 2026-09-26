/**
 * Einstein's letters for a formula come from the notation concordance, and a formula takes them
 * only when every symbol resolves (notationForms.ts, ruling (c): no formula mixes notations).
 * Checked on the real special-relativity concordance and records.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConcordanceForPaper } from "../content/notation/loader.ts";
import type { ConcordanceEntry } from "../content/schemas/concordance.ts";
import type { Expression } from "./ast.ts";
import { expressionLatex } from "./latex.ts";
import { componentKey, type PrintedForm, printedForm, printsValue } from "./notationForms.ts";
import { recordQuantities } from "./printedGlyphs.ts";
import type { QuantityRegistry } from "./quantities.ts";
import { teachingProfile } from "./teachingProfiles.ts";

const ROOT = process.cwd();
const DIR = join(ROOT, "content/equations/special-relativity");
const table = teachingProfile("special-relativity")?.quantities ?? {};
const { entries } = loadConcordanceForPaper("special-relativity");
const tree = (id: string): Expression =>
  JSON.parse(readFileSync(join(DIR, `${id}.json`), "utf8")).tree;
const form = (id: string, section: string, from = entries, registry = table) =>
  printedForm(tree(id), registry, from, section);
/** The formula as printed mode draws it: Einstein's letters, or today's when it keeps them. */
const drawn = (id: string, f: PrintedForm, registry: QuantityRegistry = table) =>
  f.state === "modern"
    ? expressionLatex(tree(id), registry)
    : expressionLatex(tree(id), {
        registry: recordQuantities(
          registry,
          Object.fromEntries(Object.entries(f.letters).map(([q, l]) => [q, l.latex])),
        ),
        componentGlyphs: Object.fromEntries(
          Object.entries(f.components).map(([k, l]) => [k, l.latex]),
        ),
        strictConcordance: false,
      });
const reasons = (f: PrintedForm) =>
  f.state === "modern" ? f.unprinted.map((u) => `${u.quantityId}:${u.reason}`) : [];

describe("printedForm", () => {
  test("V for the speed of light and beta for the Lorentz factor, when every symbol resolves", () => {
    const f = form("eq-model-sr-slow-clock", "s4");
    expect(f.state).toBe("printed");
    expect(drawn("eq-model-sr-slow-clock", f)).toBe(
      "1 - \\frac{1}{\\beta} \\approx \\frac{1}{2}\\,\\frac{v^{2}}{V^{2}}",
    );
    // The same tree with the table's letters is what readers see today.
    expect(expressionLatex(tree("eq-model-sr-slow-clock"), table)).toBe(
      "1 - \\frac{1}{\\gamma} \\approx \\frac{1}{2}\\,\\frac{v^{2}}{c^{2}}",
    );
  });

  test("one unresolved symbol keeps the whole formula in today's letters: V and beta too", () => {
    // The Doppler factor has no entry. Drawing the rest would give his V and beta beside our D, a
    // formula in nobody's notation.
    const f = form("eq-model-sr-doppler-factor", "s7");
    expect(reasons(f)).toEqual(["dopplerFactor:no-entry"]);
    expect(drawn("eq-model-sr-doppler-factor", f)).toBe(
      expressionLatex(tree("eq-model-sr-doppler-factor"), table),
    );
    expect(drawn("eq-model-sr-doppler-factor", f)).not.toContain("V");
    expect(drawn("eq-model-sr-doppler-factor", f)).not.toContain("\\beta");
  });

  test("the aberration law draws whole once phi' has its entry (p. 912)", () => {
    const f = form("eq-model-sr-aberration", "s7");
    expect(f.state).toBe("printed");
    if (f.state === "printed") expect(Object.keys(f.letters)).toEqual(["speedOfLight"]);
  });

  test("kinetic energy is Einstein's W: the section 10 result draws whole in his letters", () => {
    // Data 3, read from the plate of page 920. Before the ruling this formula drew K beside his
    // mu, V and beta; with no W it now either draws whole or not at all.
    const f = form("eq-model-sr-electron-work-result", "s10");
    expect(f.state).toBe("printed");
    if (f.state === "printed") expect(f.letters.kineticEnergy?.entryId).toBe("sr.W.electronWork");
    expect(drawn("eq-model-sr-electron-work-result", f)).toBe(
      "W = \\mu\\,V^{2}\\,\\left(\\beta - 1\\right)",
    );
  });

  test("an electromagnetic quantity keeps its formula in today's letters: SI records, Gaussian print", () => {
    const f = form("eq-model-sr-field-ey", "s6");
    expect(new Set(reasons(f))).toEqual(
      new Set([
        "electricFieldMoving:electromagnetic-units",
        "electricFieldStationary:electromagnetic-units",
        "magneticFieldStationary:electromagnetic-units",
      ]),
    );
    expect(drawn("eq-model-sr-field-ey", f)).toBe(
      "E'_{y} = \\gamma\\,\\left(E_{y} - v\\,B_{z}\\right)",
    );
  });

  test("the units rule is what holds the fields: without it Data 1's component letters draw", () => {
    // The fields' dimensions with the current exponent zeroed: the one change that lifts the units
    // rule. Every component then reaches its own entry through its index (Y', Y, N; beta is the
    // Lorentz factor), never through a letter. The result is also why the rule exists: the plate
    // of page 909 prints Y' = beta(Y - v/V N), and this SI tree has no 1/V.
    const lifted: QuantityRegistry = Object.fromEntries(
      Object.entries(table).map(([id, q]) => [
        id,
        q.dimension[4] === "0"
          ? q
          : { ...q, dimension: q.dimension.map((d, i) => (i === 4 ? "0" : d)) },
      ]),
    );
    const f = form("eq-model-sr-field-ey", "s6", entries, lifted);
    expect(f.state).toBe("printed");
    if (f.state !== "printed") return;
    expect(f.components[componentKey("electricFieldMoving", "y")]?.entryId).toBe(
      "sr.Yprime.electricFieldMoving",
    );
    expect(f.components[componentKey("electricFieldStationary", "y")]?.entryId).toBe(
      "sr.Y.electricFieldStationary",
    );
    expect(f.components[componentKey("magneticFieldStationary", "z")]?.entryId).toBe(
      "sr.N.magneticFieldStationary",
    );
    expect(drawn("eq-model-sr-field-ey", f, lifted)).toBe("Y' = \\beta\\,\\left(Y - v\\,N\\right)");
  });

  test("a component label that no entry names stays on the quantity's own letter", () => {
    // t_0 and t_1 are two readings of one clock, not components: the entry for t applies and the
    // label is kept. Nothing is recorded as a component letter.
    const f = form("eq-model-sr-transported-clock", "s4");
    if (f.state === "printed") expect(Object.keys(f.components)).toEqual([]);
    expect(reasons(f).filter((r) => r.startsWith("coordinateTimeStationary"))).toEqual([]);
  });

  test("a quantity whose concordance target differs from the record's letter keeps the formula modern", () => {
    // The real V entry with its modern letter changed: the records print c, so V no longer maps
    // onto the letter the formula prints and nothing in the formula changes.
    const v = entries.find((e) => e.id === "sr.V.speedOfLight") as ConcordanceEntry;
    const moved = {
      ...v,
      operation: { kind: "rename", target: { form: "symbol", modernGlyph: "C" } },
    } as ConcordanceEntry;
    const f = form(
      "eq-model-sr-slow-clock",
      "s4",
      entries.map((e) => (e.id === v.id ? moved : e)),
    );
    expect(reasons(f)).toEqual(["speedOfLight:target-differs"]);
  });

  test("two entries for one quantity in one section: neither is taken, and the formula stays modern", () => {
    const v = entries.find((e) => e.id === "sr.V.speedOfLight") as ConcordanceEntry;
    expect(v).toBeDefined();
    const twin = { ...v, id: "sr.C.speedOfLight", glyph: { unicode: "C", latex: "C" } };
    const f = form("eq-model-sr-slow-clock", "s4", [...entries, twin]);
    expect(reasons(f)).toEqual(["speedOfLight:ambiguous"]);
  });

  describe("a printed number bound to a quantity is its value, not a letter (Brownian p. 559)", () => {
    const bmTable = recordQuantities(teachingProfile("brownian-motion")?.quantities ?? {}, {
      avogadroConstant: "N_A",
    });
    const bm = loadConcordanceForPaper("brownian-motion").entries;
    const molar = (): Expression =>
      JSON.parse(
        readFileSync(
          join(ROOT, "content/equations/brownian-motion/eq-model-bm-diffusivity-molar.json"),
          "utf8",
        ),
      ).tree;
    const boundTo = (e: ConcordanceEntry, q: string) =>
      "quantityId" in e.binding && e.binding.quantityId === q;

    test("section 5's viscosity is k, beside the entry that records k = 1,35 . 10⁻²", () => {
      // Not vacuous: section 5 has both an entry giving viscosity a letter and one recording its
      // printed value, so without the rule the letter would be refused as ambiguous.
      const here = bm.filter((e) => boundTo(e, "viscosity") && e.scope.includes("bm-s5"));
      expect(here.map((e) => e.glyph.latex).sort()).toEqual(["1{,}35 . 10^{-2}", "k"]);
      const f = printedForm(molar(), bmTable, bm, "s5");
      expect(reasons(f)).toEqual([]);
      expect(f.state === "printed" ? f.letters.viscosity?.latex : undefined).toBe("k");
    });

    test("only a numeral is a value: 1,35 . 10⁻², 1 and 2,5 are; 2κ and every letter are not", () => {
      const all = ["brownian-motion", "molecular-dimensions", "special-relativity", "light-quanta"]
        .flatMap((p) => loadConcordanceForPaper(p).entries)
        .filter((e) => "quantityId" in e.binding);
      const values = all.filter(printsValue).map((e) => e.id);
      // The printed values, by identity: water's viscosity on p. 559 and the dissertation's two
      // viscosity-law coefficients (1 in 1906, 2,5 after the 1911 correction).
      for (const id of [
        "bm.poise.viscosityUnitConversion",
        "md.one.viscosityLawCoefficient1906",
        "md.fiveHalves.viscosityLawCoefficient1911",
      ])
        expect(values).toContain(id);
      // Whatever the corpus holds: a value prints no letter, and a letter is never a value.
      const letterIn = (latex: string) => /[A-Za-z]/.test(latex.replace(/\\(?:cdot|times)/g, ""));
      for (const e of all)
        expect([e.id, printsValue(e) && letterIn(e.glyph.latex)]).toEqual([e.id, false]);
      expect(all.filter((e) => letterIn(e.glyph.latex)).length).toBeGreaterThan(0);
      // A product of a number and a letter, bound to Boltzmann's constant, is not a value.
      const twoKappa = bm.find((e) => e.id === "bm.2kappa.groupBoltzmann") as ConcordanceEntry;
      expect(twoKappa.glyph.latex).toBe("2\\varkappa");
      expect(printsValue(twoKappa)).toBe(false);
    });

    test("the record prints N_A, so D = RT/(6πkPN) draws whole in Einstein's letters (p. 559)", () => {
      // The record's own letters, not the override above: it prints today's N_A for Avogadro's
      // number (TanElk's option (a)), which is the concordance's target for Einstein's N.
      const record = JSON.parse(
        readFileSync(
          join(ROOT, "content/equations/brownian-motion/eq-model-bm-diffusivity-molar.json"),
          "utf8",
        ),
      );
      expect(record.printedGlyphs).toEqual({ avogadroConstant: "N_A" });
      const own = recordQuantities(
        teachingProfile("brownian-motion")?.quantities ?? {},
        record.printedGlyphs,
      );
      const f = printedForm(record.tree, own, bm, "s5");
      expect(reasons(f)).toEqual([]);
      const letters = f.state === "printed" ? f.letters : {};
      expect(Object.fromEntries(Object.entries(letters).map(([q, l]) => [q, l.latex]))).toEqual({
        viscosity: "k",
        particleRadius: "P",
        avogadroConstant: "N",
      });
    });

    test("two entries that both print a letter for viscosity are still ambiguous", () => {
      const k = bm.find((e) => e.id === "bm.k.viscosity") as ConcordanceEntry;
      const twin = { ...k, id: "bm.eta.viscosity", glyph: { unicode: "η", latex: "\\eta" } };
      expect(reasons(printedForm(molar(), bmTable, [...bm, twin], "s5"))).toEqual([
        "viscosity:ambiguous",
      ]);
    });
  });

  test("an entry applies only in its sections", () => {
    // Einstein's beta is introduced in section 3; a section 2 formula that uses gamma has no
    // printed letter for it.
    const f = form("eq-model-sr-simultaneity-offset", "s2");
    expect(reasons(f)).toContain("lorentzFactor:no-entry");
    expect(reasons(form("eq-model-sr-simultaneity-offset", "s3"))).not.toContain(
      "lorentzFactor:no-entry",
    );
  });

  test("what Einstein wrote out is not a letter: the formula keeps today's letters", () => {
    // The mass-energy paper writes the Lorentz factor out as 1/sqrt(1 - v^2/V^2) and the kinetic
    // energy drop as K_0 - K_1. In a symbol's place either can lose the brackets it needs.
    const meTable = teachingProfile("mass-energy")?.quantities ?? {};
    const me = loadConcordanceForPaper("mass-energy").entries;
    const meTree = (id: string): Expression =>
      JSON.parse(readFileSync(join(ROOT, "content/equations/mass-energy", `${id}.json`), "utf8"))
        .tree;
    expect(reasons(printedForm(meTree("eq-model-me-lorentz-factor"), meTable, me, "s0"))).toContain(
      "lorentzFactor:not-a-letter",
    );
    expect(
      reasons(printedForm(meTree("eq-model-me-kinetic-drop-definition"), meTable, me, "s0")),
    ).toContain("kineticEnergyDifference:not-a-letter");
  });

  test("every letter drawn names the entry that gives it, bound to that quantity and component", () => {
    let printed = 0;
    for (const file of readdirSync(DIR).filter((n) => n.endsWith(".json"))) {
      const id = file.replace(/\.json$/, "");
      for (const section of ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"]) {
        const f = form(id, section);
        if (f.state !== "printed") continue;
        printed++;
        for (const [quantityId, letter] of Object.entries(f.letters)) {
          const entry = entries.find((e) => e.id === letter.entryId);
          expect(entry && "quantityId" in entry.binding ? entry.binding.quantityId : "").toBe(
            quantityId,
          );
          expect(entry && "quantityId" in entry.binding ? entry.binding.index : "none").toBe(
            undefined,
          );
          expect(entry?.glyph.latex).toBe(letter.latex);
        }
        for (const [key, letter] of Object.entries(f.components)) {
          const entry = entries.find((e) => e.id === letter.entryId);
          const b = entry && "quantityId" in entry.binding ? entry.binding : undefined;
          expect(b ? componentKey(b.quantityId, b.index ?? "") : "").toBe(key);
        }
      }
    }
    // Not vacuous: some formula in some section is drawn in Einstein's letters.
    expect(printed).toBeGreaterThan(0);
  });
});
