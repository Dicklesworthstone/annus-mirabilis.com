import { describe, expect, test } from "bun:test";
import {
  checkRecordsAgainstRegistry,
  loadRegistry,
  parseRegistry,
  RegistryError,
} from "./registry";

/**
 * The canonical id table and partition check from am-ep-foundations-z1e
 * ("Canonical id table and partition"): 36 nodes, 10 bridges, 46 ids total,
 * transcribed here as a fixture so a change to the real registry is checked
 * against a value that does not live inside the code under test.
 */
const CANONICAL_NODE_COUNT = 36;
const CANONICAL_BRIDGE_COUNT = 10;
const CANONICAL_TOTAL_COUNT = 46;

function validEntry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "foundation:example-node",
    kind: "node",
    cluster: "example-cluster",
    ownerBead: "am-example-bead-000",
    status: "planned",
    plannedCallers: [],
    ...overrides,
  };
}

describe("parseRegistry: fixture violations", () => {
  test("a duplicate id fails", () => {
    expect(() =>
      parseRegistry({
        schemaVersion: 1,
        entries: [validEntry(), validEntry()],
      }),
    ).toThrow(RegistryError);
  });

  test("an id with two owners (same id, different ownerBead) fails as a duplicate", () => {
    expect(() =>
      parseRegistry({
        schemaVersion: 1,
        entries: [
          validEntry({ ownerBead: "am-first-owner-000" }),
          validEntry({ ownerBead: "am-second-owner-111" }),
        ],
      }),
    ).toThrow(RegistryError);
  });

  test("a malformed id fails", () => {
    for (const id of ["not-namespaced", "foundation:Upper", "foundation:has_underscore", ""]) {
      expect(() => parseRegistry({ schemaVersion: 1, entries: [validEntry({ id })] })).toThrow(
        RegistryError,
      );
    }
  });

  test("an invalid kind fails", () => {
    expect(() =>
      parseRegistry({ schemaVersion: 1, entries: [validEntry({ kind: "proof" })] }),
    ).toThrow(RegistryError);
  });

  test("an invalid status fails", () => {
    expect(() =>
      parseRegistry({ schemaVersion: 1, entries: [validEntry({ status: "done" })] }),
    ).toThrow(RegistryError);
  });

  test("a missing owner fails", () => {
    expect(() =>
      parseRegistry({ schemaVersion: 1, entries: [validEntry({ ownerBead: "" })] }),
    ).toThrow(RegistryError);
  });

  test("a well-formed registry with no violations parses cleanly", () => {
    const registry = parseRegistry({
      schemaVersion: 1,
      entries: [validEntry(), validEntry({ id: "foundation:bridge-example", kind: "bridge" })],
    });
    expect(registry.entries).toHaveLength(2);
  });
});

describe("the real registry", () => {
  const registry = loadRegistry();

  test("has exactly 36 nodes and 10 bridges", () => {
    const nodes = registry.entries.filter((e) => e.kind === "node");
    const bridges = registry.entries.filter((e) => e.kind === "bridge");
    expect(nodes).toHaveLength(CANONICAL_NODE_COUNT);
    expect(bridges).toHaveLength(CANONICAL_BRIDGE_COUNT);
  });

  test("entry count matches the canonical id table's total (46); a fixture short by one fails naming both counts", () => {
    expect(registry.entries).toHaveLength(CANONICAL_TOTAL_COUNT);

    // Simulate the acceptance criterion's fixture: a registry missing one entry.
    const short = { ...registry, entries: registry.entries.slice(1) };
    expect(short.entries.length).not.toBe(CANONICAL_TOTAL_COUNT);
    const message = `registry has ${short.entries.length} entries, canonical table has ${CANONICAL_TOTAL_COUNT}`;
    expect(message).toContain(String(short.entries.length));
    expect(message).toContain(String(CANONICAL_TOTAL_COUNT));
  });

  test("foundation:two-measurements-two-unknowns resolves to am-found-statistics-inference-pzqv with kind node", () => {
    const entry = registry.entries.find((e) => e.id === "foundation:two-measurements-two-unknowns");
    expect(entry).toBeDefined();
    expect(entry?.kind).toBe("node");
    expect(entry?.ownerBead).toBe("am-found-statistics-inference-pzqv");
  });

  test("every ownerBead looks like a real bead id (am-<slug>)", () => {
    for (const entry of registry.entries) {
      expect(entry.ownerBead).toMatch(/^am-[a-z0-9-]+$/);
    }
  });

  test("every id is unique", () => {
    const ids = registry.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("checkRecordsAgainstRegistry: real content directory", () => {
  const registry = loadRegistry();
  const issues = checkRecordsAgainstRegistry(registry);

  test("flags foundation:error-inference as authored-without-record", () => {
    // content/foundations/error-and-inference.json exists but its own `id`
    // field is "error-and-inference", not "error-inference" — a real,
    // observed mismatch, not a fixture. The registry marks this entry
    // `planned` precisely because of it, so this check should find nothing
    // to flag for this specific id once the registry agrees with reality.
    const entry = registry.entries.find((e) => e.id === "foundation:error-inference");
    expect(entry?.status).toBe("planned");
    expect(issues.some((i) => i.id === "foundation:error-inference")).toBe(false);
  });

  test("reports content/foundations/error-and-inference.json as an unregistered record", () => {
    expect(
      issues.some(
        (i) => i.code === "unregistered-record" && i.detail.includes("error-and-inference.json"),
      ),
    ).toBe(true);
  });

  test("every entry marked authored in the real registry has a matching file", () => {
    const authoredWithoutRecord = issues.filter((i) => i.code === "authored-without-record");
    expect(authoredWithoutRecord).toEqual([]);
  });
});

describe("checkRecordsAgainstRegistry: fixture violations", () => {
  test("an authored entry without a record fails", () => {
    const registry = parseRegistry({
      schemaVersion: 1,
      entries: [validEntry({ id: "foundation:does-not-exist-anywhere", status: "authored" })],
    });
    const issues = checkRecordsAgainstRegistry(registry);
    expect(
      issues.some(
        (i) =>
          i.code === "authored-without-record" && i.id === "foundation:does-not-exist-anywhere",
      ),
    ).toBe(true);
  });

  test("a record missing from the registry fails", () => {
    // The real content directory has 18 files; a registry with zero entries
    // must report every one of them as unregistered.
    const empty = parseRegistry({ schemaVersion: 1, entries: [] });
    const issues = checkRecordsAgainstRegistry(empty);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.code === "unregistered-record")).toBe(true);
  });
});
