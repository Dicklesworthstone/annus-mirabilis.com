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
  connectionDocuments,
  marginNoteDocuments,
  type SearchCapstone,
  type SearchConnectionThread,
  type SearchMarginNote,
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

describe("marginNoteDocuments", () => {
  const NOTE: SearchMarginNote = Object.freeze({
    id: "note-bm-k-is-viscosity",
    paper: "brownian-motion",
    paperTitle: "Brownian motion",
    locator: "§3, paragraph 6",
    text: "Einstein's k in this paper is the viscosity of the liquid, not Boltzmann's constant.",
    kind: "historian-margin",
  });

  test("the note reaches its own element on the paper page, doubled prefix and all", () => {
    const [document] = marginNoteDocuments([NOTE], "scaffold");
    expect(document?.id).toBe("margin:note-bm-k-is-viscosity");
    expect(document?.type).toBe("margin");
    expect(document?.title).toBe("§3, paragraph 6");
    /*
     * PaperMargins renders `id={`note-${note.id}`}` and the record ids already begin with `note-`,
     * so the element id in the built HTML is doubled. Spelled here the way the PAGE spells it,
     * which is not the way it reads; src/testing/searchAnchorsResolve.test.ts holds the two
     * together against out/, so this is verified rather than agreed between two files.
     */
    expect(document?.anchor).toBe("note-note-bm-k-is-viscosity");
    expect(searchResultHref(document as NonNullable<typeof document>)).toBe(
      "/papers/brownian-motion/#note-note-bm-k-is-viscosity",
    );
  });

  test("the scope line names which margin the note belongs to", () => {
    const of = (kind: string) =>
      marginNoteDocuments([{ ...NOTE, kind }], "scaffold")[0]?.scopeLabel ?? "";
    expect(of("historian-margin")).toContain("the historian's margin");
    expect(of("side-note")).toContain("a side note");
    expect(of("dispute")).toContain("a recorded disagreement");
    // Every kind says "with its sources", because a historical claim without them is the thing
    // AGENTS.md forbids.
    for (const kind of ["historian-margin", "side-note", "dispute"])
      expect(of(kind)).toContain("with its sources");
  });

  test("only the scaffold profile publishes them", () => {
    expect(marginNoteDocuments([NOTE], "preview")).toEqual([]);
    expect(marginNoteDocuments([], "scaffold")).toEqual([]);
  });
});

describe("connectionDocuments", () => {
  const CONNECTION: SearchConnectionThread = Object.freeze({
    id: "energy-transformation",
    what: "The September paper takes the light-energy transformation from relativity §8.",
    label: "Uses a result",
    papers: ["special-relativity", "mass-energy"],
    text: "The September paper takes the light-energy transformation from relativity §8. The mass-energy paper starts from this transformation, citing § 8.",
  });

  test("a connection reaches its own element on the connections page", () => {
    const [document] = connectionDocuments([CONNECTION], "scaffold");
    expect(document?.id).toBe("connection:energy-transformation");
    expect(document?.type).toBe("connection-thread");
    expect(document?.anchor).toBe("energy-transformation");
    expect(searchResultHref(document as NonNullable<typeof document>)).toBe(
      "/connections/#energy-transformation",
    );
  });

  test("it is filed cross-paper, not under one of the two it joins", () => {
    const [document] = connectionDocuments([CONNECTION], "scaffold");
    /*
     * A connection belongs to no single paper, and filing it under one of its two would hide it
     * from a filter on the other. `cross-paper` is what this index already uses for a document
     * with no single paper (a walkthrough with no resolved passage takes the same value).
     */
    expect(document?.paper).toBe("cross-paper");
    /*
     * AND IT CARRIES NO TERMS. The first version had `[id, ...papers]`, and queryQuality.test.ts
     * went red on two typo queries: a term match outweighs body text, so all five connections
     * outranked the papers themselves and "relativity" returned three connection records with no
     * relativity paper in the top three. These five ids each contain a word a reader types for
     * something else (`relativity-premises`, `molecular-number`, `counting`), which is what makes
     * this builder the exception; `eq-s3-d7` and `misc-bm-proves-molecules` do not and stay terms.
     */
    expect(document?.terms).toEqual([]);
    // Both papers are searchable terms, which is how a reader looking for one of them finds it.
    expect(document?.scopeLabel).toContain("uses a result");
    expect(document?.scopeLabel).toContain("joining 2 of the four");
  });

  test("only the scaffold profile publishes them", () => {
    expect(connectionDocuments([CONNECTION], "launch")).toEqual([]);
    expect(connectionDocuments([], "scaffold")).toEqual([]);
  });
});
