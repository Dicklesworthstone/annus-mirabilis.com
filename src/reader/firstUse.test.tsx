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
  test("k at the first passage of section 5 that binds the viscosity; section 3 has no passage", async () => {
    expect(await placed("brownian-motion")).toEqual({ "arg-bm-diffusivity": ["bm.k.viscosity"] });
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
