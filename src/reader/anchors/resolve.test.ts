import { describe, expect, test } from "bun:test";
import type { AliasRecord } from "../../content/aliases.ts";
import { parseReaderLocation, type ReaderRegistry } from "../navigation/state.ts";
import {
  type ContentUnit,
  documentByContentId,
  lookupByContentId,
  resolveRegistryAnchor,
  resolveRequestedAnchor,
} from "./resolve.ts";

const RELATIVITY_SENTENCE =
  "That electrodynamics of moving bodies, as presently conceived, leads to asymmetries that do not appear to be inherent in the phenomena.";

function unit(id: string, text: string): ContentUnit {
  return { id, text };
}

/**
 * The donor keyed parallel readings by block index. This helper is the
 * scheme under test as a negative: it must disagree with content-id lookup
 * after an insertion. It is not imported from production code.
 */
function donorLookupByIndex(units: readonly ContentUnit[], index: number): ContentUnit {
  const found = units[index];
  if (!found) throw new RangeError(`No unit at donor index ${index}.`);
  return found;
}

const ORIGINAL: readonly ContentUnit[] = [
  unit("s0-p1-s1", "The opening of the paper."),
  unit("s4-p2-s1", RELATIVITY_SENTENCE),
  unit("s4-p2-s2", "A later sentence in the same paragraph."),
  unit("s5-p1-s1", "A downstream section."),
];

function alias(retiredId: string, replacementIds: readonly string[]): AliasRecord {
  return {
    retiredId,
    kind: replacementIds.length > 1 ? "split" : "retired",
    replacementIds,
    reason: "fixture",
    date: "2026-01-01",
    editor: "test",
  };
}

describe("PLANTED: inserting a paragraph must not move a content-id anchor", () => {
  test("the donor index for the relativity sentence shifts; the content id does not", () => {
    const originalDoc = documentByContentId(ORIGINAL);
    const donorIndex = ORIGINAL.findIndex((u) => u.id === "s4-p2-s1");
    expect(donorIndex).toBe(1);
    expect(donorLookupByIndex(ORIGINAL, donorIndex).text).toBe(RELATIVITY_SENTENCE);
    expect(lookupByContentId(originalDoc, "s4-p2-s1")?.text).toBe(RELATIVITY_SENTENCE);

    const opening = ORIGINAL[0];
    if (!opening) throw new Error("fixture missing opening sentence");
    const inserted: readonly ContentUnit[] = [
      opening,
      unit("s0-p1a-s1", "A paragraph inserted into the explanation, mid-document."),
      ...ORIGINAL.slice(1),
    ];
    const insertedDoc = documentByContentId(inserted);

    // Donor scheme: the annotation at the old index now names the inserted paragraph.
    expect(donorLookupByIndex(inserted, donorIndex).id).toBe("s0-p1a-s1");
    expect(donorLookupByIndex(inserted, donorIndex).text).not.toBe(RELATIVITY_SENTENCE);

    // Content-id scheme: the shared link still names the same sentence.
    const still = lookupByContentId(insertedDoc, "s4-p2-s1");
    expect(still?.text).toBe(RELATIVITY_SENTENCE);
    expect(still?.id).toBe("s4-p2-s1");

    for (const id of ["s0-p1-s1", "s4-p2-s1", "s4-p2-s2", "s5-p1-s1"] as const) {
      expect(lookupByContentId(insertedDoc, id)?.text).toBe(
        lookupByContentId(originalDoc, id)?.text,
      );
    }
  });

  test("a published source-block id is not reassigned when a neighbour is inserted", () => {
    const after = documentByContentId([
      unit("s0-p0-s1", "inserted"),
      unit("s0-p1-s1", "The opening of the paper."),
    ]);
    expect(lookupByContentId(after, "s0-p1-s1")?.text).toBe("The opening of the paper.");
    expect(lookupByContentId(after, "s0-p0-s1")?.text).toBe("inserted");
  });
});

describe("resolveRequestedAnchor consumes the alias table", () => {
  test("PLANTED: a retired id lands on its successor, not on a neighbour", () => {
    const doc = documentByContentId(ORIGINAL);
    const aliases = [alias("s4-p2-s1-old", ["s4-p2-s1"])];
    const resolved = resolveRequestedAnchor("#s4-p2-s1-old", doc, aliases);
    expect(resolved.kind).toBe("found");
    if (resolved.kind !== "found") throw new Error("expected found");
    expect(resolved.viaAlias).toBe(true);
    expect(resolved.id).toBe("s4-p2-s1");
    expect(resolved.unit.text).toBe(RELATIVITY_SENTENCE);
  });

  test("a living id is not rewritten", () => {
    const doc = documentByContentId(ORIGINAL);
    const resolved = resolveRequestedAnchor("s4-p2-s1", doc, [alias("s4-p2-s1-old", ["s4-p2-s1"])]);
    expect(resolved.kind).toBe("found");
    if (resolved.kind !== "found") throw new Error("expected found");
    expect(resolved.viaAlias).toBe(false);
    expect(resolved.id).toBe("s4-p2-s1");
  });

  test("an unknown id without an alias is missing, not the first unit", () => {
    const doc = documentByContentId(ORIGINAL);
    expect(resolveRequestedAnchor("#nowhere", doc, []).kind).toBe("missing");
  });

  test("a split retired id lands on the first successor", () => {
    const doc = documentByContentId(ORIGINAL);
    const aliases = [alias("s4-p2-old", ["s4-p2-s1", "s4-p2-s2"])];
    const resolved = resolveRequestedAnchor("s4-p2-old", doc, aliases);
    expect(resolved.kind).toBe("found");
    if (resolved.kind !== "found") throw new Error("expected found");
    expect(resolved.id).toBe("s4-p2-s1");
    expect(resolved.unit.text).toBe(RELATIVITY_SENTENCE);
  });
});

describe("route-level hash parse consumes aliases", () => {
  const registry: ReaderRegistry = {
    paperId: "special-relativity",
    anchors: ["s0-p1-s1", "s4-p2-s1", "s5-p1-s1"],
    foundations: [],
    aliases: [alias("s4-p2-s1-old", ["s4-p2-s1"])],
  };

  test("a retired hash is rewritten to the living successor", () => {
    const state = parseReaderLocation("", "#s4-p2-s1-old", registry);
    expect(state.anchor).toBe("s4-p2-s1");
  });

  test("a living hash is unchanged", () => {
    expect(parseReaderLocation("", "#s4-p2-s1", registry).anchor).toBe("s4-p2-s1");
  });

  test("resolveRegistryAnchor never treats the requested id as an array index", () => {
    expect(resolveRegistryAnchor("s4-p2-s1", registry.anchors)).toBe("s4-p2-s1");
    expect(resolveRegistryAnchor("1", registry.anchors)).toBe("s0-p1-s1");
  });
});
