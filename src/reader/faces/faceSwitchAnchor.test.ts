/**
 * The two decisions behind carrying a reader's sentence across a face switch
 * (am-read-anchors-navigation-a6o criterion 2, first clause). The island around them sets `href`
 * and scrolls; everything arguable is here.
 *
 * The population these were written against was measured in the built site, not assumed:
 * sentence anchors are English 285, German 223, shared 223, so German is a SUBSET of English.
 * German to English therefore never needs mapping, and English to German needs it for exactly 62
 * ids, every one of them a split half.
 */
import { describe, expect, test } from "bun:test";
import {
  crossesFaces,
  faceHrefWithFragment,
  isPlaceKeepingUnit,
  resolvedFaceAnchor,
  resultsAnchorForSource,
} from "./FaceSwitchAnchor.tsx";

describe("resolvedFaceAnchor maps an absent id to one this face publishes", () => {
  const germanHas = (id: string) => id === "s1-p10-s1";
  const englishHas = (id: string) => id === "s1-p10-s1a" || id === "s1-p10-s1b";

  test("an id the face already publishes resolves to itself", () => {
    expect(resolvedFaceAnchor("s1-p10-s1", germanHas)).toBe("s1-p10-s1");
  });

  test("ENGLISH TO GERMAN: a split half resolves to its source sentence", () => {
    // The whole measured gap: 62 ids, all of this shape.
    expect(resolvedFaceAnchor("s1-p10-s1a", germanHas)).toBe("s1-p10-s1");
    expect(resolvedFaceAnchor("s1-p10-s1b", germanHas)).toBe("s1-p10-s1");
  });

  test("GERMAN TO ENGLISH: a source sentence resolves to the first half when only halves are there", () => {
    // Not needed on the current corpus, because German is a subset of English. Asserted anyway, so
    // the day an English face drops an unsplit id the behaviour is already defined and tested.
    expect(resolvedFaceAnchor("s1-p10-s1", englishHas)).toBe("s1-p10-s1a");
  });

  test("an id absent with no present variant resolves to null, not to a guess", () => {
    expect(resolvedFaceAnchor("s9-p9-s9", germanHas)).toBeNull();
  });

  test("a NON-sentence anchor is never remapped", () => {
    // A paragraph, a section, an equation and a result have no split-sentence concept. Remapping
    // them is how a reader ends up somewhere unrelated.
    expect(resolvedFaceAnchor("s1-p10", germanHas)).toBeNull();
    expect(resolvedFaceAnchor("s1", germanHas)).toBeNull();
    expect(resolvedFaceAnchor("eq-s1-d1", germanHas)).toBeNull();
    expect(resolvedFaceAnchor("arg-sr-clocks", germanHas)).toBeNull();
  });

  test("an empty id resolves to null", () => {
    expect(resolvedFaceAnchor("", germanHas)).toBeNull();
  });

  test("a RETIRED id is not remapped, which is why this island cannot fight the alias island", () => {
    // Measured over content/aliases: of 37 retired ids, ZERO are split halves, and the two that are
    // unsplit sentences (s3-p8-s3, s3-p8-s4) have successors that are different ids, so no variant
    // of theirs is present. The two islands therefore act on disjoint cases.
    const brownianGerman = (id: string) => id === "s3-p8-s2";
    expect(resolvedFaceAnchor("s3-p8-s3", brownianGerman)).toBeNull();
    expect(resolvedFaceAnchor("s2-p6", brownianGerman)).toBeNull();
  });
});

describe("crossesFaces: only the kinds both source faces publish are carried outward", () => {
  test("the eight measured cross-face kinds are carried", () => {
    // Shared-id counts, English against German on special-relativity, measured in the built site.
    for (const id of [
      "s1-p10-s1", // sentence, 223 shared
      "s1-p10-s1a", // sentence, split half
      "eq-s1-d1", // equation, 98
      "s1", // section, 10
      "s1-fn1", // footnote, 4
      "s1-p10-s1-m1", // inline-equation, 2
      "part-1", // part, 2
      "closing-dateline", // closing, 3
      "masthead-title", // masthead, 2
    ]) {
      expect(crossesFaces(id)).toBe(true);
    }
  });

  test("a PARAGRAPH id is not carried, because English publishes none", () => {
    // German publishes 111 and English zero, so carrying one the other way lands nowhere.
    expect(crossesFaces("s1-p10")).toBe(false);
  });

  test("an ARGUMENT id is not carried, which is the defect a peer's assertion caught", () => {
    // scripts/test-reader-browser.mjs:316 navigates to ?view=german#arg-bm-observable and then
    // asserts the German link's href ENDS at /view/german/. An earlier version appended every
    // fragment, which would have broken that AND sent a reader to a face with 0 arg-* ids.
    expect(crossesFaces("arg-bm-observable")).toBe(false);
    expect(crossesFaces("lab-sr-01")).toBe(false);
    expect(crossesFaces("entry-brownian-motion")).toBe(false);
  });

  test("what is not a content anchor at all is refused by the grammar, not by the list", () => {
    // Real ids measured on both faces: quantity ids and React's own. 68 were shared and none is a
    // place a reader can be sent.
    for (const id of ["acceleratingPotential", "chargeDensityMoving", "_R_", "reader-root", ""]) {
      expect(crossesFaces(id)).toBe(false);
    }
  });
});

describe("faceHrefWithFragment: the href is the input, never mutated in the document", () => {
  test("a sentence fragment is carried onto a bare face path", () => {
    expect(faceHrefWithFragment("/papers/special-relativity/view/german/", "#s1-p10-s1a")).toBe(
      "/papers/special-relativity/view/german/#s1-p10-s1a",
    );
  });

  test("a query-only face link gains it too, because the chooser emits ?view= as well", () => {
    expect(faceHrefWithFragment("?view=results", "#s3-p2-s1")).toBe("?view=results#s3-p2-s1");
  });

  test("an argument or paragraph fragment leaves the href EXACTLY as it was", () => {
    // Returning the input unchanged is what lets the caller compare and do nothing, so no
    // navigation is intercepted that should not be.
    const href = "/papers/brownian-motion/view/german/";
    expect(faceHrefWithFragment(href, "#arg-bm-observable")).toBe(href);
    expect(faceHrefWithFragment(href, "#s1-p10")).toBe(href);
  });

  test("no fragment, a bare hash, a malformed escape and an existing fragment all change nothing", () => {
    const href = "/papers/x/view/german/";
    expect(faceHrefWithFragment(href, "")).toBe(href);
    expect(faceHrefWithFragment(href, "#")).toBe(href);
    expect(faceHrefWithFragment(href, "#%E0%A4%A")).toBe(href);
    expect(faceHrefWithFragment(`${href}#s1`, "#s2")).toBe(`${href}#s1`);
    expect(faceHrefWithFragment("", "#s1-p1-s1")).toBe("");
  });
});

describe("isPlaceKeepingUnit: sentence-level or finer, which is the bead's own wording", () => {
  test("a sentence and a split half are units", () => {
    expect(isPlaceKeepingUnit("s3-p2-s1")).toBe(true);
    expect(isPlaceKeepingUnit("s3-p2-s1a")).toBe(true);
    expect(isPlaceKeepingUnit("s3-p2-s1b")).toBe(true);
  });

  test("an inline equation is the 'or finer' case", () => {
    // s3-p2-s1-m1 sits INSIDE a sentence, so restoring to it is finer than the sentence.
    expect(isPlaceKeepingUnit("s3-p2-s1-m1")).toBe(true);
  });

  test("a PARAGRAPH or SECTION is too coarse and must not be a unit", () => {
    // Restoring to a paragraph puts a reader at the top of a block they were reading the middle
    // of, which is a different place even though it is the right block. That is the whole reason
    // the bead says "sentence-level (or finer)".
    expect(isPlaceKeepingUnit("s3-p2")).toBe(false);
    expect(isPlaceKeepingUnit("s3")).toBe(false);
    expect(isPlaceKeepingUnit("part-1")).toBe(false);
  });

  test("an equation, footnote or closing block is not a position in the running text", () => {
    expect(isPlaceKeepingUnit("eq-s1-d1")).toBe(false);
    expect(isPlaceKeepingUnit("s1-fn1")).toBe(false);
    expect(isPlaceKeepingUnit("closing-dateline")).toBe(false);
    expect(isPlaceKeepingUnit("masthead-title")).toBe(false);
  });

  test("and it is NARROWER than crossesFaces, which is the point of having both", () => {
    // crossesFaces answers "can this id be carried to the other face"; this answers "is this a
    // place a reader can be restored to". A section crosses and is not a place; conflating them
    // would restore every switch to the top of a section.
    expect(crossesFaces("s3")).toBe(true);
    expect(isPlaceKeepingUnit("s3")).toBe(false);
    expect(crossesFaces("eq-s1-d1")).toBe(true);
    expect(isPlaceKeepingUnit("eq-s1-d1")).toBe(false);
  });

  test("non-anchors and empties are not units", () => {
    for (const id of ["acceleratingPotential", "_R_", "reader-root", "arg-bm-observable", ""]) {
      expect(isPlaceKeepingUnit(id)).toBe(false);
    }
  });
});

describe("resultsAnchorForSource: a source sentence finds its section's results card", () => {
  /** The shape read from the DOM: each card's id and the sections its record declares. */
  const cards = [
    { resultId: "sr-two-postulates", sections: ["s0"] },
    { resultId: "sr-synchronous-clocks", sections: ["s1"] },
    { resultId: "sr-moving-rigid-body", sections: ["s4"] },
    { resultId: "sr-moving-clock", sections: ["s4"] },
    { resultId: "sr-field-transformations", sections: ["s6"] },
  ];

  test("a sentence maps to the FIRST card of its section, in document order", () => {
    expect(resultsAnchorForSource("s4-p3-s1", cards)).toBe("result-sr-moving-rigid-body");
    expect(resultsAnchorForSource("s1-p2-s1", cards)).toBe("result-sr-synchronous-clocks");
  });

  test("a paragraph, an inline equation and a section itself all map the same way", () => {
    expect(resultsAnchorForSource("s4-p3", cards)).toBe("result-sr-moving-rigid-body");
    expect(resultsAnchorForSource("s4-p3-s1-m1", cards)).toBe("result-sr-moving-rigid-body");
    expect(resultsAnchorForSource("s4", cards)).toBe("result-sr-moving-rigid-body");
  });

  test("a split half maps through its source sentence's section", () => {
    expect(resultsAnchorForSource("s4-p3-s1a", cards)).toBe("result-sr-moving-rigid-body");
    expect(resultsAnchorForSource("s4-p3-s1b", cards)).toBe("result-sr-moving-rigid-body");
  });

  test("A SECTION WITH NO CARDS RETURNS NULL AND DOES NOT CLIMB TO A NEIGHBOUR", () => {
    // This is the assertion a naive implementation fails. Measured on the built site: of 29
    // section-scoped results routes across the four papers, THREE declare no cards -- light-quanta
    // s0, brownian-motion s0 and s2. Walking a parent chain, or falling back to the nearest
    // section that does have one, would show a reader in s2 the results of s1 or s3 and present
    // them as that section's. Returning null leaves them on the complete results face, which is
    // honest about having nothing section-specific to show.
    expect(resultsAnchorForSource("s2-p1-s1", cards)).toBeNull();
    expect(resultsAnchorForSource("s3-p1-s1", cards)).toBeNull();
    expect(resultsAnchorForSource("s5-p1-s1", cards)).toBeNull();
    // s0 and s6 bracket the gap, so the test cannot pass by the index being empty.
    expect(resultsAnchorForSource("s0-p1-s1", cards)).toBe("result-sr-two-postulates");
    expect(resultsAnchorForSource("s6-p1-s1", cards)).toBe("result-sr-field-transformations");
  });

  test("an id that encodes no section returns null", () => {
    // sectionAnchorOf returns null for these: the masthead's section is in its record, not its id,
    // and the closing blocks have none. Carrying them would be a lookup against the string "null".
    for (const id of ["masthead-title", "closing-dateline", "part-1", "eq-A", "_R_", ""]) {
      expect(resultsAnchorForSource(id, cards)).toBeNull();
    }
  });

  test("a card declaring two sections is found from either", () => {
    const shared = [{ resultId: "bm-diffusivity", sections: ["s3", "s4"] }];
    expect(resultsAnchorForSource("s3-p1-s1", shared)).toBe("result-bm-diffusivity");
    expect(resultsAnchorForSource("s4-p1-s1", shared)).toBe("result-bm-diffusivity");
  });

  test("no cards at all returns null rather than throwing", () => {
    expect(resultsAnchorForSource("s4-p3-s1", [])).toBeNull();
  });
});
