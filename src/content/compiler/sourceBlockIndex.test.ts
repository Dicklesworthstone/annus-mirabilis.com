/**
 * THE POPULATION, AND THE DECLINE THAT PROTECTS IT (am-as1w follow-on).
 *
 * `structural.ts` resolves an editorial note's `affectedIds` against the source blocks of its
 * paper. Until this index existed it had nothing to resolve against, and the value of that check is
 * entirely in two behaviours that look identical from outside and are opposite in meaning:
 *
 *   with a population, a bad id is REPORTED BY NAME;
 *   without one, the check DECLINES and counts, and reports nothing.
 *
 * The second is the one worth a test. A regression that empties the population turns the check
 * silent, and silence is what a clean run also looks like, so nothing else would notice.
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { checkMissingSourceBlock } from "../checks/structural/structural.ts";
import type { CheckContext, CheckReportItem } from "./checks/registry.ts";
import { recordKeyFor } from "./recordKey.ts";
import {
  loadSourceBlockIndex,
  type SourceBlockIndex,
  sourceBlockCount,
} from "./sourceBlockIndex.ts";

const ROOT = resolve(new URL("../../../", import.meta.url).pathname);

function contextWith(
  records: Record<string, unknown>,
  sourceBlockIndex?: SourceBlockIndex,
): { ctx: CheckContext; reports: CheckReportItem[] } {
  const reports: CheckReportItem[] = [];
  return {
    reports,
    ctx: {
      records: new Map<string, unknown>(Object.entries(records)),
      files: [],
      indexes: {},
      ...(sourceBlockIndex ? { sourceBlockIndex } : {}),
      report: (item: CheckReportItem) => reports.push(item),
    },
  };
}

/** One note whose affectedId names a paragraph that is not in the index. */
const NOTE = {
  [recordKeyFor("editorial-note", "paper-a", "note-1")]: {
    kind: "historian-margin",
    id: "note-1",
    affectedIds: ["s1-p1"],
  },
};

describe("the source-block index the structural pass resolves against", () => {
  test("the loader finds the corpus, keyed by paper", () => {
    const index = loadSourceBlockIndex(ROOT);
    // Floors on a measured count, not a census: measured 2026-09-28, 456 blocks across 4 papers
    // (special-relativity 214, light-quanta 129, brownian-motion 88, mass-energy 25). Authoring a
    // 457th block is correct work and must not turn this red; a run finding almost none means the
    // loader broke, which is the failure this floor exists for.
    expect(index.size).toBeGreaterThanOrEqual(4);
    expect(sourceBlockCount(index)).toBeGreaterThanOrEqual(400);
    const me = index.get("mass-energy");
    expect(me?.blocks.has("s0-p12")).toBe(true);
    // Sentence spans are resolvable too, and are a superset of the block ids.
    expect(me?.sentences.size).toBeGreaterThan(me?.blocks.size ?? 0);
    // The manifest is a different record kind and is not a block.
    expect(me?.blocks.has("manifest")).toBe(false);
  });

  test("with a population, an affectedId that names nothing is reported by name", () => {
    const index: SourceBlockIndex = new Map([
      ["paper-a", { blocks: new Set(["s1-p2"]), sentences: new Set(["s1-p2"]) }],
    ]);
    const { ctx, reports } = contextWith(NOTE, index);
    checkMissingSourceBlock.run(ctx);
    expect(reports).toHaveLength(1);
    expect(reports[0]?.rule).toBe("missing-source-block");
    expect(reports[0]?.message).toContain("s1-p1");
  });

  test("with the same population holding the id, nothing is reported", () => {
    const index: SourceBlockIndex = new Map([
      ["paper-a", { blocks: new Set(["s1-p1"]), sentences: new Set(["s1-p1"]) }],
    ]);
    const { ctx, reports } = contextWith(NOTE, index);
    checkMissingSourceBlock.run(ctx);
    expect(reports).toEqual([]);
  });

  test("with NO population the check declines: the same bad id is not condemned", () => {
    // The guard this whole file exists for. Enabling the check without it reported all 17
    // affectedIds of the 8 real notes as missing, which were false positives about an absent
    // population rather than findings about the notes.
    for (const empty of [undefined, new Map() as SourceBlockIndex]) {
      const { ctx, reports } = contextWith(NOTE, empty);
      checkMissingSourceBlock.run(ctx);
      expect(reports, `declined population still reported: ${JSON.stringify(reports)}`).toEqual([]);
    }
  });
});
