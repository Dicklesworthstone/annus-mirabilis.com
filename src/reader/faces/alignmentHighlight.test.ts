import { describe, expect, test } from "bun:test";
import {
  FIXTURE_1_TO_2_ALIGNMENT,
  FIXTURE_1_TO_2_SOURCE_BLOCK,
  FIXTURE_1_TO_2_TRANSLATION_UNITS,
  FIXTURE_BROWNIAN_ALIGNMENT,
  FIXTURE_BROWNIAN_SOURCE_BLOCKS,
  FIXTURE_BROWNIAN_TRANSLATION_UNITS,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import {
  buildAlignmentIndex,
  getAlignedSources,
  getAlignedTargets,
  isSourceAlignedToTarget,
} from "./alignment.ts";
import { computeHighlights, nextSentenceId, prevSentenceId } from "./alignmentHighlight.ts";

describe("alignment indexing and lookups (many-to-many)", () => {
  const index = buildAlignmentIndex(
    FIXTURE_BROWNIAN_ALIGNMENT,
    FIXTURE_BROWNIAN_SOURCE_BLOCKS,
    FIXTURE_BROWNIAN_TRANSLATION_UNITS,
  );

  const index1to2 = buildAlignmentIndex(
    FIXTURE_1_TO_2_ALIGNMENT,
    [FIXTURE_1_TO_2_SOURCE_BLOCK],
    FIXTURE_1_TO_2_TRANSLATION_UNITS,
  );

  test("1:1 alignment: single source sentence maps to single target translation unit", () => {
    const targets = getAlignedTargets(index, "bm-s4-p1-s1");
    expect(targets).toEqual(["tr-bm-s4-p1-u1"]);

    const sources = getAlignedSources(index, "tr-bm-s4-p1-u1");
    expect(sources).toContain("bm-s4-p1-s1");
    expect(isSourceAlignedToTarget(index, "bm-s4-p1-s1", "tr-bm-s4-p1-u1")).toBe(true);
  });

  test("2:1 alignment: two source sentences map to one merged target unit", () => {
    const target1 = getAlignedTargets(index, "bm-s5-p1-s1");
    expect(target1).toEqual(["tr-bm-s5-p1-u1"]);

    const target2 = getAlignedTargets(index, "bm-s5-p1-s2");
    expect(target2).toEqual(["tr-bm-s5-p1-u1"]);

    const sources = getAlignedSources(index, "tr-bm-s5-p1-u1");
    expect(sources).toContain("bm-s5-p1-s1");
    expect(sources).toContain("bm-s5-p1-s2");
  });

  test("1:2 alignment: single source sentence maps to two split target units (s3-p2-s1 -> s3-p2-s1a, s3-p2-s1b)", () => {
    const targets = getAlignedTargets(index1to2, "s3-p2-s1");
    expect(targets).toContain("s3-p2-s1a");
    expect(targets).toContain("s3-p2-s1b");
    expect(targets.length).toBe(2);

    const sourcesA = getAlignedSources(index1to2, "s3-p2-s1a");
    expect(sourcesA).toContain("s3-p2-s1");

    const sourcesB = getAlignedSources(index1to2, "s3-p2-s1b");
    expect(sourcesB).toContain("s3-p2-s1");

    expect(isSourceAlignedToTarget(index1to2, "s3-p2-s1", "s3-p2-s1a")).toBe(true);
    expect(isSourceAlignedToTarget(index1to2, "s3-p2-s1", "s3-p2-s1b")).toBe(true);
  });

  test("block-level alignment for headings and equations", () => {
    const headingTargets = getAlignedTargets(index, "bm-s4-h1");
    expect(headingTargets).toEqual(["tr-bm-s4-h1"]);

    const eqTargets = getAlignedTargets(index, "bm-s4-eq1");
    expect(eqTargets).toEqual(["tr-bm-s4-eq1"]);
  });

  test("ordered sentence IDs preserve document order", () => {
    expect(index.orderedSentenceIds).toContain("bm-s4-p1-s1");
    expect(index.orderedSentenceIds).toContain("bm-s4-p1-s2");
    expect(index.orderedSentenceIds).toContain("bm-s5-p1-s1");
    expect(index.orderedSentenceIds).toContain("bm-s5-p1-s2");
  });
});

describe("alignmentHighlight: computeHighlights sets", () => {
  const index = buildAlignmentIndex(
    FIXTURE_BROWNIAN_ALIGNMENT,
    FIXTURE_BROWNIAN_SOURCE_BLOCKS,
    FIXTURE_BROWNIAN_TRANSLATION_UNITS,
  );

  const index1to2 = buildAlignmentIndex(
    FIXTURE_1_TO_2_ALIGNMENT,
    [FIXTURE_1_TO_2_SOURCE_BLOCK],
    FIXTURE_1_TO_2_TRANSLATION_UNITS,
  );

  test("highlighting source sentence lights itself and aligned translation unit", () => {
    const res = computeHighlights(index, "bm-s4-p1-s1", "source");
    expect(res.activeId).toBe("bm-s4-p1-s1");
    expect(res.activeKind).toBe("source");
    expect(Array.from(res.highlightedSourceIds)).toEqual(["bm-s4-p1-s1"]);
    expect(Array.from(res.highlightedTargetIds)).toEqual(["tr-bm-s4-p1-u1"]);
  });

  test("highlighting target unit in 2:1 alignment lights both source sentences", () => {
    const res = computeHighlights(index, "tr-bm-s5-p1-u1", "target");
    expect(res.activeId).toBe("tr-bm-s5-p1-u1");
    expect(res.activeKind).toBe("target");
    expect(Array.from(res.highlightedTargetIds)).toEqual(["tr-bm-s5-p1-u1"]);
    expect(Array.from(res.highlightedSourceIds)).toContain("bm-s5-p1-s1");
    expect(Array.from(res.highlightedSourceIds)).toContain("bm-s5-p1-s2");
  });

  test("highlighting source sentence in 1:2 alignment lights both split target units", () => {
    const res = computeHighlights(index1to2, "s3-p2-s1", "source");
    expect(res.activeId).toBe("s3-p2-s1");
    expect(res.activeKind).toBe("source");
    expect(Array.from(res.highlightedSourceIds)).toEqual(["s3-p2-s1"]);
    expect(Array.from(res.highlightedTargetIds)).toContain("s3-p2-s1a");
    expect(Array.from(res.highlightedTargetIds)).toContain("s3-p2-s1b");
  });

  test("highlighting either target unit in 1:2 alignment lights itself and the single source sentence", () => {
    const resA = computeHighlights(index1to2, "s3-p2-s1a", "target");
    expect(resA.activeId).toBe("s3-p2-s1a");
    expect(Array.from(resA.highlightedTargetIds)).toEqual(["s3-p2-s1a"]);
    expect(Array.from(resA.highlightedSourceIds)).toContain("s3-p2-s1");

    const resB = computeHighlights(index1to2, "s3-p2-s1b", "target");
    expect(resB.activeId).toBe("s3-p2-s1b");
    expect(Array.from(resB.highlightedTargetIds)).toEqual(["s3-p2-s1b"]);
    expect(Array.from(resB.highlightedSourceIds)).toContain("s3-p2-s1");
  });

  test("null or empty activeId returns empty highlight sets", () => {
    const res = computeHighlights(index, null);
    expect(res.activeId).toBeNull();
    expect(res.highlightedSourceIds.size).toBe(0);
    expect(res.highlightedTargetIds.size).toBe(0);
  });
});

describe("sentence-mode navigation (keyboard stepping)", () => {
  const index = buildAlignmentIndex(
    FIXTURE_BROWNIAN_ALIGNMENT,
    FIXTURE_BROWNIAN_SOURCE_BLOCKS,
    FIXTURE_BROWNIAN_TRANSLATION_UNITS,
  );

  test("nextSentenceId steps forward through ordered sentences", () => {
    const s0 = nextSentenceId(index, null);
    expect(s0).toBe(index.orderedSentenceIds[0]);

    const s1 = nextSentenceId(index, s0);
    expect(s1).toBe(index.orderedSentenceIds[1]);
  });

  test("prevSentenceId steps backward through ordered sentences", () => {
    const lastId = index.orderedSentenceIds[index.orderedSentenceIds.length - 1];
    const prevId = prevSentenceId(index, lastId);
    expect(prevId).toBe(index.orderedSentenceIds[index.orderedSentenceIds.length - 2]);

    const firstId = index.orderedSentenceIds[0];
    const clampedFirst = prevSentenceId(index, firstId);
    expect(clampedFirst).toBe(firstId);
  });
});
