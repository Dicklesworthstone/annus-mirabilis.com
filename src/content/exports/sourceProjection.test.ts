import { describe, expect, it } from "bun:test";
import type { BilingualEdition } from "../../reader/faces/bilingualLoader.ts";
import {
  FIXTURE_BROWNIAN_ALIGNMENT,
  FIXTURE_BROWNIAN_PAPER,
  FIXTURE_BROWNIAN_SOURCE_BLOCKS,
  FIXTURE_BROWNIAN_TRANSLATION_UNITS,
  FIXTURE_1_TO_2_SOURCE_BLOCK,
  FIXTURE_1_TO_2_TRANSLATION_UNITS,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import { plainText } from "../schemas/inlines.ts";
import { spanTextDigest } from "../schemas/spans.ts";
import { projectEditionSources } from "./sourceProjection.ts";

const edition: BilingualEdition = {
  paper: FIXTURE_BROWNIAN_PAPER,
  blocks: FIXTURE_BROWNIAN_SOURCE_BLOCKS,
  units: FIXTURE_BROWNIAN_TRANSLATION_UNITS,
  alignment: FIXTURE_BROWNIAN_ALIGNMENT,
};
const sections = ["bm-sec-04", "bm-sec-05"];

describe("live source export projection", () => {
  it("keeps true sentence spans, many-to-one alignment, and the closing record exactly once", () => {
    const projected = projectEditionSources("brownian-motion", sections, edition);
    const first = projected.get("bm-sec-04");
    const second = projected.get("bm-sec-05");
    const sourceSentence = first?.sentences.find((sentence) => sentence.id === "bm-s4-p1-s1");
    expect(sourceSentence?.sourceSpan).toEqual(
      FIXTURE_BROWNIAN_SOURCE_BLOCKS.find((block) => block.id === "bm-s4-p1")?.sentenceSpans[0]?.span,
    );
    expect(sourceSentence?.german).not.toBe(
      FIXTURE_BROWNIAN_SOURCE_BLOCKS.find((block) => block.id === "bm-s4-p1")?.diplomaticText,
    );
    const merged = second?.sentences.filter((sentence) => sentence.sourceBlockId === "bm-s5-p1");
    expect(merged).toHaveLength(2);
    expect(merged?.map((sentence) => sentence.translationUnitId)).toEqual([
      "tr-bm-s5-p1-u1", "tr-bm-s5-p1-u1",
    ]);
    expect([...projected.values()].flatMap((section) => section.blocks)
      .filter((block) => block.id === "bm-closing")).toHaveLength(1);
    expect(second?.blocks.some((block) => block.id === "bm-closing")).toBe(true);
    expect(first?.sentences.some((sentence) => sentence.id.startsWith("bm-s4-eq1-s"))).toBe(false);
    // The heading is aligned at block level; its sole real sentence inherits that exact link.
    expect(first?.sentences.find((sentence) => sentence.id === "bm-s4-h1-s1")?.english)
      .toBe(plainText(FIXTURE_BROWNIAN_TRANSLATION_UNITS[0]?.inlines ?? []));
  });

  it("retains both halves of a one-to-two translation without inventing a single unit id", () => {
    const split: BilingualEdition = {
      ...edition,
      blocks: [...edition.blocks, { ...FIXTURE_1_TO_2_SOURCE_BLOCK, section: "bm-sec-04" }],
      units: [...edition.units, ...FIXTURE_1_TO_2_TRANSLATION_UNITS],
      alignment: {
        ...FIXTURE_BROWNIAN_ALIGNMENT,
        edges: [
          ...FIXTURE_BROWNIAN_ALIGNMENT.edges,
          ...FIXTURE_1_TO_2_TRANSLATION_UNITS.map((unit) => ({
            source: { paper: "brownian-motion", blockId: "s3-p2", sentenceId: "s3-p2-s1" },
            target: { translationUnitId: unit.id },
          })),
        ],
      },
    };
    const sentence = projectEditionSources("brownian-motion", sections, split)
      .get("bm-sec-04")?.sentences.find((item) => item.id === "s3-p2-s1");
    expect(sentence?.translationUnitId).toBeUndefined();
    expect(sentence?.translationUnitIds).toEqual(FIXTURE_1_TO_2_TRANSLATION_UNITS.map((unit) => unit.id));
    expect(sentence?.english).toBe(
      FIXTURE_1_TO_2_TRANSLATION_UNITS.map((unit) => plainText(unit.inlines)).join(" "),
    );
    expect(sentence?.reviewState).toBe("reviewed");
    expect(sentence?.draft).toBe(false);
    const mixed: BilingualEdition = {
      ...split,
      units: split.units.map((unit) => unit.id === "s3-p2-s1b"
        ? { ...unit, reviewState: "draft" as const }
        : unit),
    };
    const mixedSentence = projectEditionSources("brownian-motion", sections, mixed)
      .get("bm-sec-04")?.sentences.find((item) => item.id === "s3-p2-s1");
    expect(mixedSentence?.reviewState).toBe("mixed");
    expect(mixedSentence?.draft).toBe(true);
  });

  it("honors target ranges and keeps unaligned source-referenced translation units", () => {
    const unit = FIXTURE_BROWNIAN_TRANSLATION_UNITS.find((item) => item.id === "tr-bm-s4-p1-u1");
    if (!unit) throw new Error("The translation-range fixture is missing.");
    const ranged: BilingualEdition = {
      ...edition,
      alignment: {
        ...FIXTURE_BROWNIAN_ALIGNMENT,
        edges: FIXTURE_BROWNIAN_ALIGNMENT.edges.map((edge) =>
          edge.target.translationUnitId === unit?.id ? {
            ...edge,
            target: {
              ...edge.target,
              range: {
                start: 0, end: 5, blockRevision: unit.revision,
                textDigest: spanTextDigest(plainText(unit.inlines)),
              },
            },
          } : edge,
        ),
      },
    };
    const projection = projectEditionSources("brownian-motion", sections, ranged);
    expect(projection.get("bm-sec-04")?.sentences
      .find((sentence) => sentence.id === "bm-s4-p1-s1")?.english)
      .toBe(Array.from(plainText(unit?.inlines ?? [])).slice(0, 5).join(""));
    const exportedIds = new Set([...projection.values()]
      .flatMap((section) => section.translationUnits ?? []).map((item) => item.id));
    for (const item of edition.units) expect(exportedIds.has(item.id)).toBe(true);
  });

  it("refuses cross-paper blocks and unresolved alignment targets", () => {
    expect(() => projectEditionSources("brownian-motion", sections, {
      ...edition,
      blocks: edition.blocks.map((block, i) => i === 0 ? { ...block, paper: "mass-energy" } : block),
    })).toThrow("export-source-identity");
    expect(() => projectEditionSources("brownian-motion", sections, {
      ...edition,
      alignment: {
        ...FIXTURE_BROWNIAN_ALIGNMENT,
        edges: FIXTURE_BROWNIAN_ALIGNMENT.edges.map((edge, i) =>
          i === 0 ? { ...edge, target: { translationUnitId: "does-not-exist" } } : edge,
        ),
      },
    })).toThrow("export-alignment-unresolved");
  });

  it("refuses an edition mismatch, absent alignment, wrong-paper alignment, and undeclared source section", () => {
    expect(() => projectEditionSources("mass-energy", sections, edition))
      .toThrow("export-edition-identity");
    expect(() => projectEditionSources("brownian-motion", [], edition))
      .toThrow("export-edition-identity");
    expect(() => projectEditionSources("brownian-motion", sections, {
      ...edition, alignment: undefined,
    })).toThrow("export-alignment-missing");
    expect(() => projectEditionSources("brownian-motion", sections, {
      ...edition, alignment: { ...FIXTURE_BROWNIAN_ALIGNMENT, paper: "mass-energy" },
    })).toThrow("export-alignment-paper");
    expect(() => projectEditionSources("brownian-motion", sections, {
      ...edition,
      blocks: edition.blocks.map((block, i) =>
        i === 0 ? { ...block, section: "bm-sec-99" } : block,
      ),
    })).toThrow("export-source-section");
  });

  it("keeps translation review distinct from a draft German source", () => {
    const draftSource: BilingualEdition = {
      ...edition,
      blocks: edition.blocks.map((block) => ({
        ...block,
        status: { ...block.status, review: "draft" },
      })),
    };
    const sentence = projectEditionSources("brownian-motion", sections, draftSource)
      .get("bm-sec-04")?.sentences.find((item) => item.id === "bm-s4-p1-s1");
    expect(sentence?.reviewState).toBe("reviewed");
    expect(sentence?.draft).toBe(true);
  });
});
