/**
 * The red first-use callout (firstUse.ts, FirstUseCallout.tsx): Einstein's beta in paper 3 and
 * his k in paper 2, where the explanation first uses them, in both notation states.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadConcordanceForPaper } from "../content/notation/loader.ts";
import type { ConcordanceEntry } from "../content/schemas/concordance.ts";
import { loadPaper } from "../content/server.ts";
import { FirstUseCallout } from "./FirstUseCallout.tsx";
import { FIRST_USE_CALLOUTS, firstUseCallouts } from "./firstUse.ts";
import { paperEquations } from "./paperEquations.ts";

/** The callouts the explanation face places for a paper: argument id to entry ids. */
async function placed(paper: string) {
  const { arguments: passages } = await loadPaper(paper);
  const equations = [...paperEquations(paper).values()];
  const map = firstUseCallouts(loadConcordanceForPaper(paper).entries, passages, (id) => {
    return new Set(
      equations.filter((e) => e.argument === id).flatMap((e) => e.terms.map((t) => t.quantityId)),
    );
  });
  return Object.fromEntries([...map].map(([a, es]) => [a, es.map((e) => e.id)]));
}

describe("where a dangerous letter is first met", () => {
  test("k at the first passage that binds the viscosity in each section the concordance records it first used", async () => {
    // The concordance records k's first use in §3 and in §5. Until dispatch 215 no passage was
    // filed under §3, so the only callout sat in §5; with the §3 passage filed under §3, each
    // section's first binding passage carries one, so a reader who opens §5's page is warned too.
    const k = loadConcordanceForPaper("brownian-motion").entries.find(
      (e) => e.id === "bm.k.viscosity",
    ) as ConcordanceEntry;
    const sections = (k.collision?.firstUseBySection ?? []).map((f) =>
      f.sectionId.replace(/^bm-/, ""),
    );
    expect(sections).toEqual(["s3", "s5"]);
    const quantityId = (k.binding as { quantityId: string }).quantityId;
    const { arguments: passages } = await loadPaper("brownian-motion");
    const equations = [...paperEquations("brownian-motion").values()];
    const binds = (id: string) =>
      equations.some((e) => e.argument === id && e.terms.some((t) => t.quantityId === quantityId));
    const expected: Record<string, string[]> = {};
    for (const section of sections) {
      const first = passages.find((p) => p.section === section && binds(p.id));
      if (first) expected[first.id] = [...(expected[first.id] ?? []), "bm.k.viscosity"];
    }
    // Non-vacuity: some passage binds the viscosity, so some callout is expected.
    expect(Object.keys(expected).length).toBeGreaterThan(0);
    expect(await placed("brownian-motion")).toEqual(expected);
  });

  test("beta at the first passage of section 3 that binds the Lorentz factor, and only beta", async () => {
    // Relativity marks six more entries "danger" (xi, tau, x', t_A, L, N); none is on the list.
    expect(await placed("special-relativity")).toEqual({
      "arg-sr-lorentz-map": ["sr.beta.lorentzFactor"],
    });
  });

  test("papers with neither letter get none", async () => {
    expect(await placed("light-quanta")).toEqual({});
    expect(await placed("mass-energy")).toEqual({});
  });

  test("the first passage that binds the quantity, not the section's first passage", () => {
    const beta = loadConcordanceForPaper("special-relativity").entries.find(
      (e) => e.id === "sr.beta.lorentzFactor",
    ) as ConcordanceEntry;
    const passages = [
      { id: "opens-without-beta", section: "s3" },
      { id: "first-with-beta", section: "s3" },
      { id: "second-with-beta", section: "s3" },
    ];
    const binds = (id: string) => new Set(id.includes("with-beta") ? ["lorentzFactor"] : []);
    expect([...firstUseCallouts([beta], passages, binds).keys()]).toEqual(["first-with-beta"]);
  });
});

describe("what the callout says", () => {
  const listed = ["special-relativity", "brownian-motion"]
    .flatMap((paper) => loadConcordanceForPaper(paper).entries)
    .filter((e) => FIRST_USE_CALLOUTS.has(e.id));

  test("every listed entry exists, is marked danger, and has notes a reader can read", () => {
    expect(listed.map((e) => e.id).sort()).toEqual([...FIRST_USE_CALLOUTS].sort());
    for (const entry of listed) {
      expect(entry.collision?.severity).toBe("danger");
      expect(entry.notes).toBeDefined();
      // No code identifier in reader copy (the kind of note that says "properTimeElapsed").
      expect(entry.notes ?? "").not.toMatch(/\b[a-z]+[A-Z][A-Za-z]*\b/);
    }
  });

  test("its words are the entry's notes, it links to the entry, and nothing hides it by notation", () => {
    const k = listed.find((e) => e.id === "bm.k.viscosity") as ConcordanceEntry;
    const html = renderToStaticMarkup(<FirstUseCallout entry={k} />);
    expect(html).toContain("Easily misread.");
    expect(html).toContain((k.notes ?? "").replace(/'/g, "&#x27;"));
    expect(html).toContain('href="/notation/#bm.k.viscosity"');
    expect(html).not.toContain("data-notation");
  });
});
