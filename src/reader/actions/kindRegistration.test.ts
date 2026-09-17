import { describe, expect, test } from "bun:test";
import { getClarificationKind, registerClarificationKind } from "../stack/kinds.ts";
import { registerPassageActionKinds } from "./kindRegistration.ts";

describe("example and obstacle kind registration", () => {
  test("both kinds register exactly once", () => {
    registerPassageActionKinds();
    expect(getClarificationKind("example")?.kind).toBe("example");
    expect(getClarificationKind("obstacle")?.kind).toBe("obstacle");
    expect(getClarificationKind("example")?.descends).toBe(true);
    expect(getClarificationKind("obstacle")?.descends).toBe(true);
    registerPassageActionKinds();
    expect(getClarificationKind("example")?.staticHref({ id: "mean-variance-rms" })).toBe(
      "/foundations/mean-variance-rms/",
    );
    expect(
      getClarificationKind("obstacle")?.staticHref({
        passageId: "arg-bm-observable",
        kind: "algebraicMove",
      }),
    ).toBe("#arg-bm-observable-obstacle-algebraicMove");
  });

  test("planted negative: a duplicate kind name fails loudly", () => {
    expect(() =>
      registerClarificationKind("example", {
        parseId: () => ({ id: "x" }),
        staticHref: () => "#x",
        title: () => "x",
        descends: true,
      }),
    ).toThrow(/already registered/);
  });

  test("obstacle parseId refuses an unknown kind id", () => {
    const def = getClarificationKind("obstacle");
    expect(def?.parseId("arg-bm-observable/notARealKind")).toBeFalsy();
    expect(def?.parseId("arg-bm-observable/algebraicMove")).toEqual({
      passageId: "arg-bm-observable",
      kind: "algebraicMove",
    });
  });
});
