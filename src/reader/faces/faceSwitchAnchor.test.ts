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
import { resolvedFaceAnchor } from "./FaceSwitchAnchor.tsx";

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
