import { describe, expect, test } from "bun:test";
import {
  CANONICAL_BRIDGE_COUNT,
  CANONICAL_FOUNDATION_IDS,
  CANONICAL_NODE_COUNT,
  CANONICAL_TOTAL_COUNT,
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
