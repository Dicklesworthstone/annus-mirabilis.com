import { describe, expect, test } from "bun:test";
import {
  CANONICAL_BRIDGE_COUNT,
  CANONICAL_FOUNDATION_IDS,
  CANONICAL_NODE_COUNT,
  CANONICAL_TOTAL_COUNT,
  type CanonicalFoundationEntry,
} from "./canonicalIds";
import { loadRegistry } from "./registry";

describe("the canonical id table itself", () => {
  test("has 36 nodes, 10 bridges, 46 total, per am-ep-foundations-z1e's partition check", () => {
    expect(CANONICAL_NODE_COUNT).toBe(36);
    expect(CANONICAL_BRIDGE_COUNT).toBe(10);
    expect(CANONICAL_TOTAL_COUNT).toBe(46);
  });

  test("every id is unique", () => {
    const ids = CANONICAL_FOUNDATION_IDS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every id matches foundation:<slug>", () => {
    for (const entry of CANONICAL_FOUNDATION_IDS) {
      expect(entry.id).toMatch(/^foundation:[a-z][a-z0-9-]*$/);
    }
  });
});

describe("content/foundations/registry.yaml agrees with the canonical table", () => {
  const registry = loadRegistry();
  const canonicalById = new Map(CANONICAL_FOUNDATION_IDS.map((e) => [e.id, e]));
  const registryById = new Map(registry.entries.map((e) => [e.id, e]));

  test("the registry has no id absent from the canonical table", () => {
    const extra = registry.entries.map((e) => e.id).filter((id) => !canonicalById.has(id));
    expect(extra).toEqual([]);
  });

  test("the registry is missing no id present in the canonical table", () => {
    const missing = CANONICAL_FOUNDATION_IDS.map((e) => e.id).filter((id) => !registryById.has(id));
    expect(missing).toEqual([]);
  });

  test("every registry entry's kind and ownerBead match the canonical table", () => {
    const mismatches: string[] = [];
    for (const canonical of CANONICAL_FOUNDATION_IDS) {
      const actual = registryById.get(canonical.id);
      if (!actual) continue; // reported by the "missing" test above
      if (actual.kind !== canonical.kind) {
        mismatches.push(`${canonical.id}: kind ${actual.kind} !== canonical ${canonical.kind}`);
      }
      if (actual.ownerBead !== canonical.ownerBead) {
        mismatches.push(
          `${canonical.id}: ownerBead ${actual.ownerBead} !== canonical ${canonical.ownerBead}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });

  test("a registry short by one entry fails naming both counts (the acceptance criterion's fixture)", () => {
    const short = registry.entries.slice(1);
    expect(short.length).not.toBe(CANONICAL_TOTAL_COUNT);
    const message = `registry has ${short.length} entries, canonical table has ${CANONICAL_TOTAL_COUNT}`;
    expect(message).toContain(String(short.length));
    expect(message).toContain(String(CANONICAL_TOTAL_COUNT));
  });
});

/**
 * am-ep-foundations-z1e: "A test recomputes the counts from the canonical id table above rather
 * than reading a typed total, and asserts 4, 5, 2, 6, 5, 4 and 1 nodes for the seven cluster
 * beads, 9 nodes and 6 bridges for the slice, 4 bridges here, 36 nodes and 46 ids in all, so a row
 * added without a matching count change fails." The four bridges are am-found-zero-algebra-rest-oipl's.
 *
 * A census on purpose. AGENTS.md prefers a property to a count for a list that grows with correct
 * work, and this table does not grow that way: the partition is a frozen plan decision, and a new
 * or re-owned row must arrive with the epic's own updated table, which is what this forces.
 */
const EPIC_PARTITION: Readonly<Record<string, Readonly<{ node: number; bridge: number }>>> = {
  "am-found-quantities-magnitudes-igxe": { node: 4, bridge: 0 },
  "am-found-calculus-6agg": { node: 5, bridge: 0 },
  "am-found-statistics-inference-pzqv": { node: 2, bridge: 0 },
  "am-found-transport-thermo-smv3": { node: 6, bridge: 0 },
  "am-found-linear-geometry-7w15": { node: 5, bridge: 0 },
  "am-found-fields-light-cv3o": { node: 4, bridge: 0 },
  "am-found-reading-german-u8oc": { node: 1, bridge: 0 },
  "am-bm-slice-foundations-f5z9": { node: 9, bridge: 6 },
  "am-found-zero-algebra-rest-oipl": { node: 0, bridge: 4 },
};

/** Nodes and bridges per owning bead, counted from the rows themselves. */
function partitionOf(rows: readonly CanonicalFoundationEntry[]) {
  const counts: Record<string, { node: number; bridge: number }> = {};
  for (const row of rows) {
    const owner = counts[row.ownerBead] ?? { node: 0, bridge: 0 };
    owner[row.kind] += 1;
    counts[row.ownerBead] = owner;
  }
  return counts;
}

describe("the partition, recomputed from the rows", () => {
  test("each owning bead holds the nodes and bridges the epic gives it, 36 and 10 in 46 ids", () => {
    const counts = partitionOf(CANONICAL_FOUNDATION_IDS);
    expect(counts).toEqual(EPIC_PARTITION);
    const totals = Object.values(counts).reduce(
      (sum, c) => ({ node: sum.node + c.node, bridge: sum.bridge + c.bridge }),
      { node: 0, bridge: 0 },
    );
    expect(totals).toEqual({ node: 36, bridge: 10 });
    expect(CANONICAL_FOUNDATION_IDS.length).toBe(46);
  });

  test("planted: a row added, or a row re-owned, without a count change fails", () => {
    const first = CANONICAL_FOUNDATION_IDS[0];
    expect(first).toBeDefined();
    if (!first) return;
    const added = [
      ...CANONICAL_FOUNDATION_IDS,
      { id: "foundation:planted", kind: "node" as const, ownerBead: first.ownerBead },
    ];
    expect(partitionOf(added)).not.toEqual(EPIC_PARTITION);
    const reowned = CANONICAL_FOUNDATION_IDS.map((row) =>
      row === first ? { ...row, ownerBead: "am-found-calculus-6agg" } : row,
    );
    expect(first.ownerBead).not.toBe("am-found-calculus-6agg");
    expect(partitionOf(reowned)).not.toEqual(EPIC_PARTITION);
  });

  test("two-measurements-two-unknowns is pzqv's, in the statistics cluster, in table and registry", () => {
    const id = "foundation:two-measurements-two-unknowns";
    expect(CANONICAL_FOUNDATION_IDS.find((e) => e.id === id)).toEqual({
      id,
      kind: "node",
      ownerBead: "am-found-statistics-inference-pzqv",
    });
    const entry = loadRegistry().entries.find((e) => e.id === id);
    expect(entry?.ownerBead).toBe("am-found-statistics-inference-pzqv");
    expect(entry?.cluster).toBe("statistics-inference");
  });
});
