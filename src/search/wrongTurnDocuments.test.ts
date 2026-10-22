/**
 * THE COMMON WRONG TURNS AND THE CAPSTONES AS SEARCH DOCUMENTS.
 *
 * Both builders close the same silence: measured on the index of 2026-10-22, `misconception` and
 * `capstone` were two of EIGHT declared search types with zero documents, each with a heading
 * already written in TYPE_LABELS and a route family already allowed by the validator. The records
 * had been there since September.
 *
 * The assertion that matters is the ANCHOR, because a wrong one fails invisibly: the reader lands
 * at the top of the paper page, which looks like a page rather than like a defect. The spelling is
 * `misconception-<id>`, which is MisconceptionCallout's own element id, and
 * src/testing/searchAnchorsResolve.test.ts holds every indexed anchor to the built HTML so that
 * this spelling is verified against the page rather than agreed between two files.
 */
import { describe, expect, test } from "bun:test";
import { searchResultHref } from "./core.ts";
import {
  capstoneDocuments,
  type SearchCapstone,
  type SearchWrongTurn,
  wrongTurnDocuments,
} from "./documents.ts";

const WRONG_TURN: SearchWrongTurn = Object.freeze({
  id: "misc-bm-proves-molecules",
  paper: "brownian-motion",
  paperTitle: "Brownian motion",
  claim: "Einstein's paper proved that molecules exist.",
  text: "The paper is often described that way. What it gives is a quantitative prediction.",
});

const CAPSTONE: SearchCapstone = Object.freeze({
  paper: "mass-energy",
  paperTitle: "Mass and energy",
  title: "Rebuild the September argument",
  text: "Which premise does the work, and which subtraction removes what cannot be measured?",
});

describe("wrongTurnDocuments", () => {
  test("the reader's own wrong belief is the title, and the href reaches the callout", () => {
    const [document] = wrongTurnDocuments([WRONG_TURN], "scaffold");
    expect(document?.id).toBe("misconception:misc-bm-proves-molecules");
    expect(document?.type).toBe("misconception");
    expect(document?.title).toBe("Einstein's paper proved that molecules exist.");
    // The anchor is the callout's element id. Not `common-wrong-turns`, the section: a reader who
    // searched one claim is owed that claim, not a list of ten.
    expect(document?.anchor).toBe("misconception-misc-bm-proves-molecules");
    expect(searchResultHref(document as NonNullable<typeof document>)).toBe(
      "/papers/brownian-motion/#misconception-misc-bm-proves-molecules",
    );
  });

  test("the scope line says the edition does not endorse the claim in the title", () => {
    const [document] = wrongTurnDocuments([WRONG_TURN], "scaffold");
    /*
     * This is the one assertion here that is about editorial honesty rather than plumbing. The
     * title is a false statement, verbatim, because that is what a reader types; two things have to
     * carry the frame, and only one of them lives in this repository's search UI (the "Common wrong
     * turns" heading from TYPE_LABELS). The other is this line, beside every hit.
     */
    expect(document?.scopeLabel).toContain("examines rather than endorses");
    expect(document?.scopeLabel).toContain("what is true");
  });

  test("the text carries why it tempts and what is true, so the hit is findable by either", () => {
    const [document] = wrongTurnDocuments([WRONG_TURN], "scaffold");
    expect(document?.text).toBe(WRONG_TURN.text);
    expect(document?.terms).toEqual(["misc-bm-proves-molecules"]);
  });

  test("only the scaffold profile publishes them, and the order is by id", () => {
    expect(wrongTurnDocuments([WRONG_TURN], "preview")).toEqual([]);
    expect(wrongTurnDocuments([WRONG_TURN], "launch")).toEqual([]);
    const rows = [
      { ...WRONG_TURN, id: "misc-c" },
      { ...WRONG_TURN, id: "misc-a" },
      { ...WRONG_TURN, id: "misc-b" },
    ];
    expect(wrongTurnDocuments(rows, "scaffold").map((d) => d.id)).toEqual([
      "misconception:misc-a",
      "misconception:misc-b",
      "misconception:misc-c",
    ]);
  });
});

describe("capstoneDocuments", () => {
  test("a capstone's own title reaches its own page", () => {
    const [document] = capstoneDocuments([CAPSTONE], "scaffold");
    expect(document?.id).toBe("capstone:mass-energy");
    expect(document?.type).toBe("capstone");
    expect(document?.title).toBe("Rebuild the September argument");
    expect(document?.anchor).toBe("");
    expect(searchResultHref(document as NonNullable<typeof document>)).toBe(
      "/capstones/mass-energy/",
    );
    expect(document?.text).toContain("Which premise does the work");
  });

  test("the scope line says what a capstone is for, and only scaffold publishes it", () => {
    const [document] = capstoneDocuments([CAPSTONE], "scaffold");
    expect(document?.scopeLabel).toContain("claims to arrange");
    expect(document?.scopeLabel).toContain("optional");
    expect(capstoneDocuments([CAPSTONE], "launch")).toEqual([]);
    expect(capstoneDocuments([], "scaffold")).toEqual([]);
  });
});
