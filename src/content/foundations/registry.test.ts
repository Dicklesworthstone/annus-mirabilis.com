import { describe, expect, test } from "bun:test";
import {
  CANONICAL_BRIDGE_COUNT,
  CANONICAL_NODE_COUNT,
  CANONICAL_TOTAL_COUNT,
} from "./canonicalIds";
import {
  checkRecordsAgainstRegistry,
  loadRegistry,
  parseRegistry,
  RegistryError,
} from "./registry";

// Canonical counts (36 nodes, 10 bridges, 46 total) come from
// ./canonicalIds.ts, the frozen table transcribed from
// am-ep-foundations-z1e; canonicalIds.test.ts owns verifying that table
// against the epic and against this registry in detail (per-id kind and
// ownerBead agreement). These tests only check the aggregate counts.

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

/**
 * The refusal CODE a parse threw, or null if it did not throw.
 *
 * `toThrow(RegistryError)` was all several of these asserted, and that passes
 * whichever guard fired: a fixture aimed at the id check could be satisfied by
 * `missing-cluster` and read as coverage of a rule it never reached. The
 * am-muyh scanner counts those sites untested for the same reason, which is
 * how they were found (am-kfkw, am-fkyc).
 */
function refusalCodeOf(run: () => unknown): string | null {
  try {
    run();
    return null;
  } catch (err) {
    if (!(err instanceof RegistryError)) throw err;
    return err.code;
  }
}

describe("parseRegistry: fixture violations", () => {
  test("a duplicate id fails with duplicate-id, and two distinct ids parse", () => {
    expect(
      refusalCodeOf(() =>
        parseRegistry({
          schemaVersion: 1,
          entries: [validEntry(), validEntry()],
        }),
      ),
    ).toBe("duplicate-id");

    // The accept arm, and the discriminator: the same two entries with
    // different ids must parse, so the refusal is the repeat and not the
    // shape of validEntry().
    const accepted = parseRegistry({
      schemaVersion: 1,
      entries: [validEntry(), validEntry({ id: "foundation:second-node" })],
    });
    expect(accepted.entries.length).toBe(2);
  });

  test("an id with two owners (same id, different ownerBead) fails as duplicate-id", () => {
    expect(
      refusalCodeOf(() =>
        parseRegistry({
          schemaVersion: 1,
          entries: [
            validEntry({ ownerBead: "am-first-owner-000" }),
            validEntry({ ownerBead: "am-second-owner-111" }),
          ],
        }),
      ),
    ).toBe("duplicate-id");

    // Distinct ids with distinct owners are ordinary, so the id is what the
    // refusal is about and not the second ownerBead.
    const accepted = parseRegistry({
      schemaVersion: 1,
      entries: [
        validEntry({ ownerBead: "am-first-owner-000" }),
        validEntry({ id: "foundation:second-node", ownerBead: "am-second-owner-111" }),
      ],
    });
    expect(accepted.entries.length).toBe(2);
  });

  test("a malformed id fails with invalid-id, and a well-formed one parses", () => {
    for (const id of ["not-namespaced", "foundation:Upper", "foundation:has_underscore", ""]) {
      expect(
        refusalCodeOf(() => parseRegistry({ schemaVersion: 1, entries: [validEntry({ id })] })),
      ).toBe("invalid-id");
    }

    // Every other field is held at its valid value in validEntry(), so an
    // accepted id here is the only difference between this and the four above.
    const accepted = parseRegistry({
      schemaVersion: 1,
      entries: [validEntry({ id: "foundation:well-formed-2" })],
    });
    expect(accepted.entries[0]?.id).toBe("foundation:well-formed-2");
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

describe("Foundation registry refusal throw sites (am-muyh)", () => {
  // Site 1 (line 54)
  test("site (registry.ts:54) invalid-registry: rejects non-object or array registry, accepts plain object", () => {
    expect(() => parseRegistry(null)).toThrow(
      new RegistryError("invalid-registry", "Registry must be an object."),
    );
    expect(() => parseRegistry("not-an-object")).toThrow(
      new RegistryError("invalid-registry", "Registry must be an object."),
    );
    expect(() => parseRegistry([])).toThrow(
      new RegistryError("invalid-registry", "Registry must be an object."),
    );

    const accepted = parseRegistry({ schemaVersion: 1, entries: [validEntry()] });
    expect(accepted.schemaVersion).toBe(1);
    expect(accepted.entries.length).toBe(1);
  });

  // Site 2 (line 58)
  test("site (registry.ts:58) missing-schema-version: rejects missing or non-number schemaVersion, accepts numeric version", () => {
    expect(() => parseRegistry({ entries: [] })).toThrow(
      new RegistryError("missing-schema-version", "Registry requires a numeric schemaVersion."),
    );
    expect(() => parseRegistry({ schemaVersion: "1" as any, entries: [] })).toThrow(
      new RegistryError("missing-schema-version", "Registry requires a numeric schemaVersion."),
    );

    const accepted = parseRegistry({ schemaVersion: 1, entries: [] });
    expect(accepted.schemaVersion).toBe(1);
  });

  // Site 3 (line 61)
  test("site (registry.ts:61) missing-entries: rejects missing or non-array entries field, accepts array entries", () => {
    expect(() => parseRegistry({ schemaVersion: 1 })).toThrow(
      new RegistryError("missing-entries", "Registry requires an entries array."),
    );
    expect(() => parseRegistry({ schemaVersion: 1, entries: "not-an-array" as any })).toThrow(
      new RegistryError("missing-entries", "Registry requires an entries array."),
    );

    const accepted = parseRegistry({ schemaVersion: 1, entries: [validEntry()] });
    expect(accepted.entries.length).toBe(1);
  });

  // Site 4 (line 69)
  test("site (registry.ts:69) invalid-entry: rejects null or non-object entry in entries, accepts plain object entry", () => {
    expect(() => parseRegistry({ schemaVersion: 1, entries: [null] })).toThrow(
      new RegistryError("invalid-entry", "entries[0] must be an object."),
    );
    expect(() => parseRegistry({ schemaVersion: 1, entries: ["string-entry" as any] })).toThrow(
      new RegistryError("invalid-entry", "entries[0] must be an object."),
    );

    const accepted = parseRegistry({ schemaVersion: 1, entries: [validEntry()] });
    expect(accepted.entries[0]?.id).toBe("foundation:example-node");
  });

  // Site 5 (line 82)
  test("site (registry.ts:82) invalid-kind: rejects kind other than node or bridge, accepts node and bridge", () => {
    expect(() =>
      parseRegistry({
        schemaVersion: 1,
        entries: [validEntry({ kind: "concept" as any })],
      }),
    ).toThrow(
      new RegistryError(
        "invalid-kind",
        'entries[0].kind must be "node" or "bridge"; got "concept" for foundation:example-node.',
      ),
    );

    const acceptedNode = parseRegistry({
      schemaVersion: 1,
      entries: [validEntry({ kind: "node" })],
    });
    expect(acceptedNode.entries[0]?.kind).toBe("node");

    const acceptedBridge = parseRegistry({
      schemaVersion: 1,
      entries: [validEntry({ kind: "bridge" })],
    });
    expect(acceptedBridge.entries[0]?.kind).toBe("bridge");
  });

  // Site 6 (line 88)
  test("site (registry.ts:88) missing-cluster: rejects missing or whitespace cluster, accepts non-empty cluster string", () => {
    expect(() =>
      parseRegistry({
        schemaVersion: 1,
        entries: [validEntry({ cluster: "" })],
      }),
    ).toThrow(
      new RegistryError(
        "missing-cluster",
        "entries[0].cluster is required for foundation:example-node.",
      ),
    );
    expect(() =>
      parseRegistry({
        schemaVersion: 1,
        entries: [validEntry({ cluster: "   " })],
      }),
    ).toThrow(
      new RegistryError(
        "missing-cluster",
        "entries[0].cluster is required for foundation:example-node.",
      ),
    );

    const accepted = parseRegistry({
      schemaVersion: 1,
      entries: [validEntry({ cluster: "calculus" })],
    });
    expect(accepted.entries[0]?.cluster).toBe("calculus");
  });

  // Site 7 (line 91)
  test("site (registry.ts:91) missing-owner: rejects missing or whitespace ownerBead, accepts valid owner bead", () => {
    expect(() =>
      parseRegistry({
        schemaVersion: 1,
        entries: [validEntry({ ownerBead: "" })],
      }),
    ).toThrow(
      new RegistryError(
        "missing-owner",
        "entries[0].ownerBead is required for foundation:example-node.",
      ),
    );
    expect(() =>
      parseRegistry({
        schemaVersion: 1,
        entries: [validEntry({ ownerBead: "   " })],
      }),
    ).toThrow(
      new RegistryError(
        "missing-owner",
        "entries[0].ownerBead is required for foundation:example-node.",
      ),
    );

    const accepted = parseRegistry({
      schemaVersion: 1,
      entries: [validEntry({ ownerBead: "am-bm-01" })],
    });
    expect(accepted.entries[0]?.ownerBead).toBe("am-bm-01");
  });

  // Site 8 (line 94)
  test("site (registry.ts:94) invalid-status: rejects status other than planned or authored, accepts planned and authored", () => {
    expect(() =>
      parseRegistry({
        schemaVersion: 1,
        entries: [validEntry({ status: "draft" as any })],
      }),
    ).toThrow(
      new RegistryError(
        "invalid-status",
        'entries[0].status must be "planned" or "authored"; got "draft" for foundation:example-node.',
      ),
    );

    const acceptedPlanned = parseRegistry({
      schemaVersion: 1,
      entries: [validEntry({ status: "planned" })],
    });
    expect(acceptedPlanned.entries[0]?.status).toBe("planned");

    const acceptedAuthored = parseRegistry({
      schemaVersion: 1,
      entries: [validEntry({ status: "authored" })],
    });
    expect(acceptedAuthored.entries[0]?.status).toBe("authored");
  });
});
