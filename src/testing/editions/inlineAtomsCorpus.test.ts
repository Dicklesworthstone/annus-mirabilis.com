/**
 * Rule C.4 against the corpus it governs (am-edn-alignment-tooling-do1).
 *
 * C.4 is the rule that says a translation can never silently drop a formula, a cross-paper
 * reference or a footnote mark. Until 2026-10-19 nothing built its input: `options.components`
 * came from the caller, no production caller supplied it, and the runner reported
 * `"outcome": "passed"` having compared zero components for every paper. With a population it
 * compares 742 components carrying 914 inline math atoms and 22 footnote marks.
 *
 * DISPLAY MATH IS EXCLUDED and that is the whole difficulty of the loader, not a detail. C.4
 * governs the multiset of INLINE math atoms; a display is a shared `equation` block that the
 * English refers to rather than repeats, and its byte identity is C.3's question. Counting
 * displays reported five atoms as missing from the English -- three in light-quanta's `s1-fn3`
 * (`Z = \sum ...`, `d W = f(...)`, `f(A_1, A_2 ...)`) and two in `s5-fn1` (`- d(E - T S) = ...`,
 * `p v = R \frac{n}{N} T.`) -- when the English was correct in every case. The plant below is
 * built from that exact mistake.
 */

import { describe, expect, test } from "bun:test";
import { reportPopulation } from "../../../scripts/gate-census/population.ts";
import {
  type AlignmentComponent,
  validateInlineMathematics,
} from "../../content/editions/alignment.ts";
import { loadAlignmentComponents } from "../../content/editions/authoredInputs.ts";
import type { RouteSlug } from "../../content/ids.ts";

const ROOT = process.cwd();
const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;

function loadAll() {
  return PAPERS.map((slug) => {
    const loaded = loadAlignmentComponents(slug as RouteSlug, ROOT);
    expect(loaded.issues, `${slug}: the loader could not read a record`).toEqual([]);
    return { slug, ...loaded };
  });
}

describe("every alignment edge resolves to content on both sides", () => {
  test("no component drops a source or a target", () => {
    // An unresolved endpoint is the quiet failure here: the component is still built, the
    // comparison still runs, and the atoms of the missing side are simply never counted.
    for (const { slug, examined } of loadAll()) {
      expect(examined.unresolvedSources, `${slug}: unresolved German sources`).toBe(0);
      expect(examined.unresolvedTargets, `${slug}: unresolved English targets`).toBe(0);
      expect(examined.components, `${slug}: no components built`).toBeGreaterThan(30);
    }
  });

  test("the atoms are counted, and the reference class is declared empty on purpose", () => {
    let components = 0;
    let mathAtoms = 0;
    let footnoteMarks = 0;
    let references = 0;
    for (const { examined } of loadAll()) {
      components += examined.components;
      mathAtoms += examined.mathAtoms;
      footnoteMarks += examined.footnoteMarks;
      references += examined.references;
    }
    expect(mathAtoms).toBeGreaterThan(800);
    expect(footnoteMarks).toBeGreaterThan(15);
    // Zero today because the corpus holds no `reference` inline: the German edition bead authors
    // them at their occurrence. Asserted rather than ignored, so the day the first one lands this
    // line says the class stopped being empty instead of the run quietly starting to mean more.
    expect(references).toBe(0);
    const vacuous = reportPopulation({
      gate: "inline-atoms-corpus",
      examined: components,
      noun: "alignment components compared for inline math, references and footnote marks",
      minimum: 600,
    });
    expect(vacuous).toBe(false);
  });
});

describe("rule C.4 over every alignment component", () => {
  test("no German atom is missing from its English side, and none is invented", () => {
    const errors: string[] = [];
    for (const { slug, components } of loadAll()) {
      for (const issue of validateInlineMathematics(components)) {
        if (issue.code === "math-order-differs") continue; // a permitted difference, see below
        errors.push(`${slug}: ${issue.code}: ${issue.message}`);
      }
    }
    expect(errors).toEqual([]);
  });

  test("order differences exist and are warnings, not errors", () => {
    // If this ever reaches zero the suite has stopped distinguishing the two channels, and the
    // test above would be passing because nothing reaches it rather than because nothing differs.
    const orders = loadAll().flatMap(({ components }) =>
      validateInlineMathematics(components).filter((i) => i.code === "math-order-differs"),
    );
    expect(orders.length).toBeGreaterThan(0);
  });

  test("CONTROL: a dropped formula is caught", () => {
    const { components } = loadAll()[3] as { components: readonly AlignmentComponent[] };
    const target = components.find(
      (c) => c.englishUnits.some((u) => (u.mathAtoms ?? []).length > 0) && c.germanUnits.length > 0,
    );
    expect(target).toBeDefined();
    const mutilated: AlignmentComponent = {
      germanUnits: target?.germanUnits ?? [],
      englishUnits: (target?.englishUnits ?? []).map((u) => ({ ...u, mathAtoms: [] })),
    };
    const issues = validateInlineMathematics([mutilated]);
    expect(issues.some((i) => i.code === "math-atoms-differ")).toBe(true);
  });

  test("CONTROL: a dropped footnote mark is caught", () => {
    const all = loadAll().flatMap(({ components }) => components);
    const target = all.find(
      (c) =>
        c.germanUnits.some((u) => (u.footnoteMarks ?? []).length > 0) &&
        c.englishUnits.some((u) => (u.footnoteMarks ?? []).length > 0),
    );
    expect(target, "no component carries a footnote mark on both sides").toBeDefined();
    const mutilated: AlignmentComponent = {
      germanUnits: target?.germanUnits ?? [],
      englishUnits: (target?.englishUnits ?? []).map((u) => ({ ...u, footnoteMarks: [] })),
    };
    expect(
      validateInlineMathematics([mutilated]).some((i) => i.code === "footnote-marks-differ"),
    ).toBe(true);
  });

  test("CONTROL: counting DISPLAY math would report the corpus as broken", () => {
    /*
     * The defect the loader actually had, planted so a refactor cannot reintroduce it quietly.
     * light-quanta's s1-fn3 and s5-fn1 reference display equations that the English does not
     * repeat; adding one back to the German side of a component must make C.4 complain, which is
     * what it did for all five before `display: true` was excluded.
     */
    const { components } = loadAll()[1] as { components: readonly AlignmentComponent[] };
    const target = components.find((c) => c.germanUnits.length > 0 && c.englishUnits.length > 0);
    expect(target).toBeDefined();
    const withDisplay: AlignmentComponent = {
      germanUnits: (target?.germanUnits ?? []).map((u, i) =>
        i === 0 ? { ...u, mathAtoms: [...(u.mathAtoms ?? []), "p v = R \\frac{n}{N} T."] } : u,
      ),
      englishUnits: target?.englishUnits ?? [],
    };
    const issues = validateInlineMathematics([withDisplay]);
    expect(issues.some((i) => i.code === "math-atoms-differ")).toBe(true);
    // Reported in the normalized form the comparison uses: whitespace is removed before the
    // multisets are built, so `p v = R ...` is named as `pv=R...`. Primes, subscripts,
    // `\varphi` versus `\phi` and `V` versus `v` stay distinct, which is the point of
    // normalizing only whitespace.
    expect(issues.find((i) => i.code === "math-atoms-differ")?.message).toContain(
      "pv=R\\frac{n}{N}T.",
    );
  });
});
