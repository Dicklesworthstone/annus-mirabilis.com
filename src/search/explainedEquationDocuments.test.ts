/**
 * THE PRINTED DISPLAYS AS SEARCH DOCUMENTS.
 *
 * The defect being closed is a silence: measured on the index of 2026-10-22, 0 of 998 documents
 * routed under /equations/, so a reader searching for the words of a printed equation found
 * neither the equation nor the page explaining it. A silence is also the failure mode of the
 * repair, which is why the assertions below are about the DOCUMENT a row becomes rather than about
 * the builder running: a row dropped here is a page a reader cannot find, and nothing else notices.
 *
 * The negatives are the three ways this builder could be wrong while looking right: a non-scaffold
 * profile must publish nothing (the corpus is explanatory previews, which the other profiles may
 * not ship through search), the route must be the explanation's page rather than a position inside
 * the paper, and the TITLE must be the locator rather than the spoken form, because the spoken
 * forms run to 1,672 characters and /search/ renders a title with no clamp.
 */
import { describe, expect, test } from "bun:test";
import { searchResultHref, validateSearchDocument } from "./core.ts";
import { explainedEquationDocuments, type SearchExplainedEquation } from "./documents.ts";

const ROW: SearchExplainedEquation = Object.freeze({
  display: "eq-s1-d2",
  paper: "special-relativity",
  paperTitle: "Special relativity",
  locator: "§1, display 2",
  words:
    "Twice the distance between A and B, divided by the time at which the ray returns to A less the time at which it left A, equals the velocity of light in empty space, a universal constant.",
  spoken: "two A B over t prime A minus t A equals V.",
});

describe("explainedEquationDocuments", () => {
  test("a row becomes a document pointing at the explanation's own page", () => {
    const [document] = explainedEquationDocuments([ROW], "scaffold");
    expect(document).toBeDefined();
    expect(document?.id).toBe("equation-explained:special-relativity:eq-s1-d2");
    expect(document?.type).toBe("equation");
    expect(document?.route).toBe("/equations/special-relativity/eq-s1-d2/");
    // No face and no anchor: the page is the destination, so the href is the page and nothing else.
    expect(searchResultHref(document as NonNullable<typeof document>)).toBe(
      "/equations/special-relativity/eq-s1-d2/",
    );
    expect(document?.text).toBe(`${ROW.words} ${ROW.spoken}`);
    expect(document?.scopeLabel).toBe("Special relativity · printed display, with its explanation");
  });

  test("the title is the locator, and the longest spoken form in the corpus is accepted", () => {
    const [document] = explainedEquationDocuments([ROW], "scaffold");
    expect(document?.title).toBe("§1, display 2");
    expect(document?.terms).toEqual(["eq-s1-d2"]);

    /*
     * The two planted negatives for the two measurements that shaped this builder. A title taken
     * from `spoken` would be a 1,672-character link text, and a TERM of that length is refused
     * outright by validateSearchDocument, so the document would not exist at all. Relativity's
     * § 6 really is that long: six equations read out.
     */
    const long = { ...ROW, display: "eq-s2-d1", spoken: "x".repeat(1672) };
    const [second] = explainedEquationDocuments([long], "scaffold");
    expect(second?.title).toBe("§1, display 2");
    expect((second?.title ?? "").length).toBeLessThan(60);
    expect(second?.text).toContain("x".repeat(1672));
    for (const term of second?.terms ?? []) expect(term.length).toBeLessThanOrEqual(1000);
  });

  test("an explanation with no drawn equation keeps its document and gains no empty text", () => {
    // 8 of the 279 explanations carry no `printed` block, so `spoken` is empty. Joining blindly
    // would leave a trailing space on the searchable text of every one of them.
    const [document] = explainedEquationDocuments([{ ...ROW, spoken: "" }], "scaffold");
    expect(document?.terms).toEqual(["eq-s1-d2"]);
    expect(document?.text).toBe(ROW.words);
  });

  test("only the scaffold profile publishes them", () => {
    expect(explainedEquationDocuments([ROW], "scaffold").length).toBe(1);
    expect(explainedEquationDocuments([ROW], "preview")).toEqual([]);
    expect(explainedEquationDocuments([ROW], "launch")).toEqual([]);
  });

  test("the order is by id, so two builds of one corpus shard identically", () => {
    const rows = [
      { ...ROW, display: "eq-s3-d1" },
      { ...ROW, display: "eq-s1-d1" },
      { ...ROW, display: "eq-s2-d1" },
    ];
    expect(explainedEquationDocuments(rows, "scaffold").map((d) => d.id)).toEqual([
      "equation-explained:special-relativity:eq-s1-d1",
      "equation-explained:special-relativity:eq-s2-d1",
      "equation-explained:special-relativity:eq-s3-d1",
    ]);
  });

  test("PLANTED: the route family was widened by exactly one, and traversal is still refused", () => {
    /*
     * `validateSearchDocument` keeps an allowlist of route families, and /equations/ was not on it,
     * so the index COULD NOT have carried one of these documents even if a builder had offered it.
     * That is the half of this change that is a validator edit, so it gets a control in both
     * directions: the new family is accepted, and the traversal cases the allowlist exists for are
     * still refused under it.
     */
    const base = {
      id: "equation-explained:x",
      type: "equation",
      paper: "special-relativity",
      section: "",
      lang: "en",
      title: "§1, display 2",
      text: "words",
      terms: [],
      anchor: "",
      face: "",
      scopeLabel: "scope",
    };
    expect(
      validateSearchDocument({ ...base, route: "/equations/special-relativity/eq-s1-d2/" }).route,
    ).toBe("/equations/special-relativity/eq-s1-d2/");
    for (const route of [
      "/equations/../admin",
      "/equations/%2e%2e/",
      "/equationz/eq-s1-d2/",
      "/equations//eq-s1-d2/",
      "https://elsewhere.example/equations/",
    ])
      expect(() => validateSearchDocument({ ...base, route }), route).toThrow();
  });

  test("an empty input is an empty index, not a throw", () => {
    expect(explainedEquationDocuments([], "scaffold")).toEqual([]);
  });
});
