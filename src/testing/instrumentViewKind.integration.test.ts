import { describe, expect, it } from "bun:test";
import { getClarificationKind, type InstrumentViewTarget } from "../reader/stack/kinds.ts";

describe("instrumentViewKind.integration (am-read-return-stack-oxa)", () => {
  it("instrument-view is registered with descends: true", () => {
    const def = getClarificationKind("instrument-view");
    expect(def).toBeDefined();
    expect(def?.kind).toBe("instrument-view");
    expect(def?.descends).toBe(true);
    expect(def?.render).toBeDefined();
  });

  it("parseId validates catalogue address grammar only", () => {
    const def = getClarificationKind("instrument-view");
    if (!def) throw new Error("instrument-view kind not found");

    // Valid known id
    const parsedKnown = def.parseId("bm-01") as InstrumentViewTarget | null;
    expect(parsedKnown).toEqual({ raw: "bm-01" });

    // Valid unknown id
    const parsedUnknown = def.parseId("unknown-instrument") as InstrumentViewTarget | null;
    expect(parsedUnknown).toEqual({ raw: "unknown-instrument" });

    // Valid id with mode
    const parsedWithMode = def.parseId("bm-01:custom") as InstrumentViewTarget | null;
    expect(parsedWithMode).toEqual({ raw: "bm-01:custom" });

    // Invalid grammar (multiple colons)
    const parsedInvalid = def.parseId("bm-01:a:b");
    expect(parsedInvalid).toBeNull();
  });

  it("staticHref formats /lab route with id or encoded address", () => {
    const def = getClarificationKind("instrument-view");
    if (!def) throw new Error("instrument-view kind not found");

    expect(def.staticHref({ raw: "bm-01" })).toBe("/lab/bm-01");
    // Undeclared mode falls back to encoded route
    expect(def.staticHref({ raw: "bm-01:teaching" })).toBe("/lab/bm-01%3Ateaching");
  });

  it("title resolves label for known instruments and falls back to raw id for unknown", () => {
    const def = getClarificationKind("instrument-view");
    if (!def) throw new Error("instrument-view kind not found");

    const knownTitle = def.title({ raw: "bm-01" });
    expect(knownTitle).toBeDefined();
    expect(knownTitle).not.toBe("bm-01");

    const unknownTitle = def.title({ raw: "unknown-inst" });
    expect(unknownTitle).toBe("unknown-inst");
  });

  it("render mounts ExperimentDispatch with id and instanceId", () => {
    const def = getClarificationKind("instrument-view");
    if (!def?.render) throw new Error("instrument-view render function not found");

    const element = def.render({
      parsed: { raw: "bm-01" },
      instanceId: "test-instance-1",
    });

    expect(element).toBeDefined();
  });
});
