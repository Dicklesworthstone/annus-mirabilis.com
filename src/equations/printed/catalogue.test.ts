/**
 * THE EQUATIONS CATALOGUE, AGAINST THE REAL PAYLOAD.
 *
 * What is worth asserting here is not that the function returns rows. It is the two properties a
 * catalogue can quietly lose: that it holds EVERY explained equation (a row dropped is a page a
 * reader cannot find, and the page still answers 200, so nothing else notices), and that the
 * printed ones are in PRINTED order rather than in the lexicographic order the payload happens to
 * carry, which puts § 10 between § 1 and § 2.
 *
 * The planted negative is the classification: `kindOf` is private, so the plant is run through the
 * public surface by asking what the four authored labels map to and what an unmet label does. A
 * kind that fell through to `elsewhere` silently would be a row the page still draws, which is the
 * whole reason that bucket exists rather than a filter.
 */
import { describe, expect, test } from "bun:test";
import { CATALOGUE_GROUPS, cataloguePapers, equationCatalogue } from "./catalogue.ts";
import { everyExplanationRoute, fullExplanation } from "./fullExplanations.ts";
import { printedDisplayOrder } from "./printedDisplays.ts";

const PAPERS = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"] as const;

describe("the equations catalogue", () => {
  test("every explained equation is listed exactly once, and nothing else is", () => {
    const routes = everyExplanationRoute();
    // Denominator: measured 2026-10-22. A zero here would make every assertion below vacuous.
    expect(routes.length).toBeGreaterThanOrEqual(279);

    const listed = PAPERS.flatMap((paper) =>
      equationCatalogue(paper).map((row) => `${paper}/${row.display}`),
    );
    const expected = routes.map((route) => `${route.paper}/${route.display}`);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual([...expected].sort());
  });

  test("a row's words and address come from the record, not from this module", () => {
    const rows = equationCatalogue("mass-energy");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const explanation = fullExplanation("mass-energy", row.display);
      expect(row.words).toBe((explanation?.inWords ?? []).map((phrase) => phrase.text).join(""));
      expect(row.words.length).toBeGreaterThan(0);
      expect(row.href).toBe(`/equations/mass-energy/${row.display}/`);
    }
  });

  test("printed displays are in printed order, which no sort of the ids reproduces", () => {
    for (const paper of PAPERS) {
      const printed = equationCatalogue(paper)
        .filter((row) => row.kind === "printed")
        .map((row) => row.display);
      const order = printedDisplayOrder(paper).filter((display) => printed.includes(display));
      expect(printed, `${paper} printed displays are not in the payload's printed order`).toEqual(
        order,
      );
    }
    /*
     * The control: that printed order is not just alphabetical order wearing a different name, so
     * the assertion above can fail. Brownian § 3 prints `eq-s3-1` between `eq-s3-d3` and
     * `eq-s3-d4`, and relativity's § 10 falls after § 9 rather than after § 1.
     */
    const brownian = equationCatalogue("brownian-motion")
      .filter((row) => row.kind === "printed")
      .map((row) => row.display);
    expect(brownian).not.toEqual([...brownian].sort());
    expect(brownian.indexOf("eq-s3-1")).toBeGreaterThan(brownian.indexOf("eq-s3-d3"));
    expect(brownian.indexOf("eq-s3-1")).toBeLessThan(brownian.indexOf("eq-s3-d4"));
    const relativity = equationCatalogue("special-relativity")
      .filter((row) => row.kind === "printed")
      .map((row) => row.display);
    expect(relativity.indexOf("eq-s10-d1")).toBeGreaterThan(relativity.indexOf("eq-s9-d1"));
  });

  test("PLANTED: the four authored labels classify, and an unmet label is shown rather than dropped", () => {
    const labels = new Set(
      everyExplanationRoute().map(
        (route) => fullExplanation(route.paper, route.display)?.source?.label ?? "",
      ),
    );
    // The labels the module knows, read off the live payload rather than copied from it.
    expect([...labels].sort()).toEqual([
      "Go back to the route",
      "Open the laboratory",
      "Read it in the paper",
      "Read the step it belongs to",
    ]);

    const rows = PAPERS.flatMap((paper) => equationCatalogue(paper));
    // Every row classified, none in the fallthrough, today.
    expect(rows.filter((row) => row.kind === "elsewhere")).toEqual([]);
    // And the plant: a label the module has not met must still produce a row with a kind the page
    // draws, which is what `elsewhere` being a GROUP rather than a filter buys.
    expect(CATALOGUE_GROUPS.some((group) => group.kind === "elsewhere")).toBe(true);
    expect(new Set(CATALOGUE_GROUPS.map((group) => group.kind)).size).toBe(CATALOGUE_GROUPS.length);
    for (const group of CATALOGUE_GROUPS) {
      expect(group.heading.length).toBeGreaterThan(4);
      expect(group.clause.length).toBeGreaterThan(40);
    }
    // Every kind a row can carry has a group to be drawn in; a kind with no group is a row the
    // page silently omits, which is the defect this whole file is about.
    const kinds = new Set(rows.map((row) => row.kind));
    const drawn = new Set(CATALOGUE_GROUPS.map((group) => group.kind));
    expect([...kinds].filter((kind) => !drawn.has(kind))).toEqual([]);
  });

  test("the per-paper counts add up, and a paper with no explanations is left out", () => {
    const papers = cataloguePapers();
    expect(papers.map((entry) => entry.paper)).toEqual([
      "light-quanta",
      "brownian-motion",
      "special-relativity",
      "mass-energy",
    ]);
    // The companion dissertation has no explained equations and must not appear as an empty row.
    expect(papers.some((entry) => entry.paper === "molecular-dimensions")).toBe(false);
    for (const entry of papers) {
      const byKind = Object.values(entry.byKind).reduce((sum, n) => sum + n, 0);
      expect(byKind).toBe(entry.total);
      expect(entry.total).toBe(equationCatalogue(entry.paper).length);
      expect(entry.byKind.printed).toBeGreaterThan(0);
    }
    // Measured 2026-10-22: 279 across the four, 200 of them printed displays.
    expect(papers.reduce((sum, entry) => sum + entry.total, 0)).toBeGreaterThanOrEqual(279);
    expect(papers.reduce((sum, entry) => sum + entry.byKind.printed, 0)).toBe(200);
  });

  test("printedDisplayOrder deduplicates and keeps the paper's own displays", () => {
    // The payload carries 201 rows for 200 displays: mass-energy/eq-s0-d1 under two LaTeX forms.
    const massEnergy = printedDisplayOrder("mass-energy");
    expect(new Set(massEnergy).size).toBe(massEnergy.length);
    expect(massEnergy).toContain("eq-s0-d1");
    expect(printedDisplayOrder("special-relativity")).not.toContain("eq-s0-d1");
    expect(printedDisplayOrder("not-a-paper")).toEqual([]);
  });
});
