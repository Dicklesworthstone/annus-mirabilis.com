import { describe, expect, test } from "bun:test";
import { passageKind } from "./passageKind.ts";

describe("a passage's kind in a reader's words", () => {
  test("the role is named, and an exact step says nothing more", () => {
    expect(passageKind({ logicalRole: "derivation", modelStatus: "exact-within-model" })).toBe(
      "A derivation",
    );
    expect(passageKind({ logicalRole: "assumption", modelStatus: "exact-within-model" })).toBe(
      "An assumption",
    );
  });

  test("an approximation says so, because that is the exception", () => {
    expect(passageKind({ logicalRole: "heuristic-inference", modelStatus: "approximation" })).toBe(
      "A heuristic step, to an approximation",
    );
  });

  test("the record's taxonomy never reaches the reader, even for a role it does not know", () => {
    const label = passageKind({
      logicalRole: "magical-inference",
      modelStatus: "exact-within-model",
    });
    expect(label).toBe("A step");
    expect(label).not.toMatch(/within the stated model|-/i);
  });
});
