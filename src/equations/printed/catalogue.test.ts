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
import {
  CATALOGUE_GROUPS,
  cataloguePapers,
  equationCatalogue,
  equationLocator,
  explainedEquationTitle,
  marginNoteLocator,
  sectionShortLabel,
} from "./catalogue.ts";
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

  test("every printed display gets a locator the anchor grammar recognised", () => {
    /*
     * The locator is what a search result is titled by, so an id the grammar does not recognise
     * would put `eq-whatever` in front of a reader. The fallback is deliberate (a dropped row is
     * worse than an ugly one) and this is the assertion that keeps it a safety net: all 200 are
     * recognised today, and a new id shape turns this red rather than appearing in the index.
     */
    const sections = (section: string) => section.replace(/^s/, "§");
    const unrecognised: string[] = [];
    let printed = 0;
    for (const paper of PAPERS) {
      for (const row of equationCatalogue(paper)) {
        if (row.kind !== "printed") continue;
        printed += 1;
        if (equationLocator(row.display, sections) === row.display)
          unrecognised.push(`${paper}/${row.display}`);
      }
    }
    expect(printed).toBe(200);
    expect(unrecognised, unrecognised.join(", ")).toEqual([]);
  });

  test("PLANTED: the locator reads the grammar, and says so differently for each shape", () => {
    const sections = (section: string) => (section === "s3" ? "§3" : null);
    // The four shapes the corpus actually holds, measured 2026-10-22: 196, 2, 1 and 1 of them.
    expect(equationLocator("eq-s3-d7", sections)).toBe("§3, display 7");
    expect(equationLocator("eq-s3-1", sections)).toBe("§3, equation (1)");
    expect(equationLocator("eq-2", sections)).toBe("Equation (2)");
    expect(equationLocator("eq-A", sections)).toBe("Equation (A)");
    // A paper with no sections to cite: mass-energy prints none and its argument is all s0, so
    // "§0, display 1" would cite something that does not exist.
    expect(equationLocator("eq-s0-d1", () => null)).toBe("Display 1");
    expect(equationLocator("eq-s0-d1", (s) => (s === "s0" ? "Introduction" : null))).toBe(
      "Introduction, display 1",
    );
    // And the fallback, which must be the id itself rather than a blank or a throw.
    expect(equationLocator("lab-bm-05-discrete-walk", sections)).toBe("lab-bm-05-discrete-walk");
    expect(equationLocator("eq-s9-d1", sections)).toBe("Display 1");
  });

  test("PLANTED: marginNoteLocator reads the sentence-id grammar, and refuses to guess", () => {
    const sections = (section: string) =>
      section === "s3" ? "§3" : section === "s0" ? "Introduction" : null;
    // The shapes the 28 committed notes actually carry, measured 2026-10-22: 25 are s<n>-p<m>,
    // one is s1-fn1, one is closing-ack, one carries no affected id at all.
    expect(marginNoteLocator("s3-p6", sections)).toBe("§3, paragraph 6");
    expect(marginNoteLocator("s0-p1", sections)).toBe("Introduction, paragraph 1");
    expect(marginNoteLocator("s3-fn1", sections)).toBe("§3, footnote 1");
    expect(marginNoteLocator("closing-ack", sections)).toBe("The closing acknowledgment");
    expect(marginNoteLocator("closing-dateline", sections)).toBe("The date-line");
    // A sentence id narrows to its paragraph, because that is where the note is rendered.
    expect(marginNoteLocator("s3-p6-s2", sections)).toBe("§3, paragraph 6");
    // A paper with no sections to cite: mass-energy's notes are all under s0 and it prints none.
    expect(marginNoteLocator("s0-p12", () => null)).toBe("Paragraph 12");
    // And the refusals: no affected id, and an id the grammar does not know. `null` here is read
    // by the caller as "a note on the paper as a whole", never as a blank title.
    expect(marginNoteLocator(undefined, sections)).toBeNull();
    expect(marginNoteLocator("not-an-id", sections)).toBeNull();
    expect(marginNoteLocator("s9-p1", sections)).toBe("Paragraph 1");
  });

  test("sectionShortLabel takes the citation and leaves the editorial gloss", () => {
    // The 28 section titles in the four paper records all carry the interpunct.
    expect(sectionShortLabel("§1 · operational simultaneity")).toBe("§1");
    expect(sectionShortLabel("Introduction · a heuristic viewpoint")).toBe("Introduction");
    expect(sectionShortLabel("The unsectioned argument · explanatory reading")).toBe(
      "The unsectioned argument",
    );
    // No interpunct: the whole title, trimmed, rather than an empty label.
    expect(sectionShortLabel("  §4  ")).toBe("§4");
  });

  test("every paper the catalogue knows is one the content index compiles", async () => {
    /*
     * The two populations have different sources: this module reads the explanations payload, and
     * the search index and the catalogue pages read the compiled content index. A paper in the
     * first and not the second would lose between 40 and 122 search documents and would render a
     * page with no title, and both failures are quiet. Asserted here rather than refused at build
     * time because both sides are build-time constants: there is no run in which this can newly
     * become false without a commit.
     */
    const { contentIndex } = await import("../../content/server.ts");
    const compiled = new Set(
      (await contentIndex()).payloads
        .filter((payload) => payload.kind === "paper")
        .map((payload) => payload.id),
    );
    expect(compiled.size).toBeGreaterThanOrEqual(4);
    const missing = cataloguePapers()
      .map((entry) => entry.paper)
      .filter((paper) => !compiled.has(paper));
    expect(missing, missing.join(", ")).toEqual([]);
  });

  test("printedDisplayOrder deduplicates and keeps the paper's own displays", () => {
    // The payload carries 201 rows for 200 displays: mass-energy/eq-s0-d1 under two LaTeX forms.
    const massEnergy = printedDisplayOrder("mass-energy");
    expect(new Set(massEnergy).size).toBe(massEnergy.length);
    expect(massEnergy).toContain("eq-s0-d1");
    expect(printedDisplayOrder("special-relativity")).not.toContain("eq-s0-d1");
    expect(printedDisplayOrder("not-a-paper")).toEqual([]);
  });

  /*
   * am-ahgo item 3. The 44 explained equations that are not printed displays had no title and so
   * no search document: 36 on a discovery route, 8 behind a laboratory, each with an authored
   * explanation on a page of its own that no query could reach. These are the two directions of
   * the derivation that gives them one.
   */
  test("am-ahgo: every route and laboratory equation derives a title, and no two share one", () => {
    const seen = new Map<string, string[]>();
    let derived = 0;
    let rows = 0;
    for (const paper of cataloguePapers()) {
      for (const row of equationCatalogue(paper.paper)) {
        if (row.kind !== "route" && row.kind !== "instrument") continue;
        rows += 1;
        const title = explainedEquationTitle(paper.paper, row.display, row.kind);
        // Undefined means the document is omitted, which is the state this bead exists to end.
        expect(title, `${row.display} derives no title`).toBeTruthy();
        derived += 1;
        const key = `${paper.paper}|${title}`;
        seen.set(key, [...(seen.get(key) ?? []), row.display]);
      }
    }
    // The denominator beside the verdict: 44 when this landed, asserted as a floor rather than an
    // equality so that authoring a new route equation does not turn this red for being authored.
    expect(rows).toBeGreaterThanOrEqual(44);
    expect(derived).toBe(rows);
    const collisions = [...seen].filter(([, ids]) => ids.length > 1);
    expect(collisions.map(([key, ids]) => `${key} <- ${ids.join(", ")}`)).toEqual([]);
  });

  test("am-ahgo: the title is the id's own name, with the paper marker and the laboratory handled", () => {
    // The `-investigate-` shape: the slug is already an English phrase.
    expect(
      explainedEquationTitle(
        "special-relativity",
        "journey-discover-special-relativity-investigate-light-postulate",
        "route",
      ),
    ).toBe("Light postulate");

    // The camelCase shape, which reads "Bm mean square" if the paper marker is left on. The paper
    // is known here, and that is what makes stripping it safe rather than a guess.
    expect(explainedEquationTitle("brownian-motion", "journey-bmMeanSquare", "route")).toBe(
      "Mean square",
    );
    expect(explainedEquationTitle("light-quanta", "journey-lqiCounting", "route")).toBe("Counting");

    // A marker belonging to ANOTHER paper does not match, so nothing is stripped by accident.
    expect(explainedEquationTitle("mass-energy", "journey-bmMeanSquare", "route")).toBe(
      "Bm mean square",
    );

    // The two sr-03 laboratory formulas, which `labName` would have made identical. The slug is
    // the discriminator the laboratory's name lacks.
    expect(
      explainedEquationTitle("special-relativity", "lab-sr-03-contraction-ratio", "instrument"),
    ).toBe("SR-03: Contraction ratio");
    expect(
      explainedEquationTitle("special-relativity", "lab-sr-03-minkowski-interval", "instrument"),
    ).toBe("SR-03: Minkowski interval");

    // Without the laboratory qualifier this would collide with journey-lqQuantumSize below.
    expect(explainedEquationTitle("light-quanta", "lab-lq-06-quantum-size", "instrument")).toBe(
      "LQ-06: Quantum size",
    );
    expect(explainedEquationTitle("light-quanta", "journey-lqQuantumSize", "route")).toBe(
      "Quantum size",
    );

    // And the refusals: an unrecognised shape, and the kinds this does not title.
    expect(explainedEquationTitle("brownian-motion", "something-else", "route")).toBeUndefined();
    expect(explainedEquationTitle("brownian-motion", "lab-bm-05", "instrument")).toBeUndefined();
    expect(explainedEquationTitle("brownian-motion", "eq-s4-d2", "printed")).toBeUndefined();
    expect(explainedEquationTitle("brownian-motion", "eq-model-whatever", "step")).toBeUndefined();
  });
});
