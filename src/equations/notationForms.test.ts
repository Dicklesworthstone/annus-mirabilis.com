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
import { componentKey, type PrintedForm, printedForm } from "./notationForms.ts";
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

  test("one unresolved symbol keeps the whole formula in today's letters: V too", () => {
    // Einstein's phi' has no entry yet. Drawing the rest would give his V beside our phi', a
    // formula in nobody's notation.
    const f = form("eq-model-sr-aberration", "s7");
    expect(reasons(f)).toEqual(["propagationAngleMoving:no-entry"]);
    expect(drawn("eq-model-sr-aberration", f)).toBe(
      expressionLatex(tree("eq-model-sr-aberration"), table),
    );
    expect(drawn("eq-model-sr-aberration", f)).not.toContain("V");
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
