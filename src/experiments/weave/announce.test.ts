import { describe, expect, test } from "bun:test";
import { selectAnnouncement, selectExpandedOutsideDomain } from "./announce.ts";
import type { WeaveDerived, WeaveFlag } from "./types.ts";

function flag(overrides: Partial<WeaveFlag> & Pick<WeaveFlag, "predicateId">): WeaveFlag {
  return {
    meaning: "quantity-compared",
    lit: false,
    state: "not-evaluable",
    pointerText: "pointer",
    targets: [],
    ...overrides,
  };
}

function derived(
  runId: string,
  snapshotVersion: number,
  flags: readonly WeaveFlag[],
): WeaveDerived {
  return {
    runId,
    snapshotVersion,
    flags: Object.fromEntries(flags.map((f) => [f.predicateId, f])),
  };
}

describe("selectAnnouncement: one announcement per accepted snapshot", () => {
  test("a predicate lighting for the first time (no previous derived result) is announced", () => {
    const next = derived("run-1", 1, [flag({ predicateId: "p1", lit: true, state: "enter" })]);
    expect(selectAnnouncement(undefined, next)?.predicateId).toBe("p1");
  });

  test("a predicate that stays lit across snapshots is not re-announced", () => {
    const prev = derived("run-1", 1, [flag({ predicateId: "p1", lit: true, state: "enter" })]);
    const next = derived("run-1", 2, [flag({ predicateId: "p1", lit: true, state: "hold" })]);
    expect(selectAnnouncement(prev, next)).toBeUndefined();
  });

  test("a predicate that re-lights after clearing is announced again", () => {
    const prev = derived("run-1", 2, [flag({ predicateId: "p1", lit: false, state: "exit" })]);
    const next = derived("run-1", 3, [flag({ predicateId: "p1", lit: true, state: "enter" })]);
    expect(selectAnnouncement(prev, next)?.predicateId).toBe("p1");
  });

  test("two predicates lighting on the same snapshot announce only the first by id", () => {
    const next = derived("run-1", 1, [
      flag({ predicateId: "z-predicate", lit: true, state: "enter" }),
      flag({ predicateId: "a-predicate", lit: true, state: "enter" }),
    ]);
    expect(selectAnnouncement(undefined, next)?.predicateId).toBe("a-predicate");
  });

  test("no flags lit produces no announcement", () => {
    const next = derived("run-1", 1, [
      flag({ predicateId: "p1", lit: false, state: "not-evaluable" }),
    ]);
    expect(selectAnnouncement(undefined, next)).toBeUndefined();
  });
});

describe("selectExpandedOutsideDomain: at most one predicate expanded per face", () => {
  test("no lit outside-selected-domain flags selects nothing", () => {
    expect(selectExpandedOutsideDomain([])).toBeUndefined();
  });

  test("a single lit outside-selected-domain flag is selected", () => {
    const f = flag({
      predicateId: "p1",
      lit: true,
      meaning: "outside-selected-domain",
      state: "enter",
    });
    expect(selectExpandedOutsideDomain([f])).toBe("p1");
  });

  test("two lit outside-selected-domain flags select only the first by predicate id", () => {
    const a = flag({
      predicateId: "b-predicate",
      lit: true,
      meaning: "outside-selected-domain",
      state: "enter",
    });
    const b = flag({
      predicateId: "a-predicate",
      lit: true,
      meaning: "outside-selected-domain",
      state: "enter",
    });
    expect(selectExpandedOutsideDomain([a, b])).toBe("a-predicate");
  });

  test("an unlit outside-selected-domain flag is never selected", () => {
    const f = flag({
      predicateId: "p1",
      lit: false,
      meaning: "outside-selected-domain",
      state: "exit",
    });
    expect(selectExpandedOutsideDomain([f])).toBeUndefined();
  });

  test("a lit flag of a different meaning is never selected", () => {
    const f = flag({ predicateId: "p1", lit: true, meaning: "quantity-compared", state: "enter" });
    expect(selectExpandedOutsideDomain([f])).toBeUndefined();
  });
});
