import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CompanionKindError, resolveCompanionKind } from "./companionKind.ts";

describe("companion kind (am-read-page-anatomy-l0b)", () => {
  it("blank query uses explanation", () => {
    assert.equal(resolveCompanionKind(undefined), "explanation");
    assert.equal(resolveCompanionKind(""), "explanation");
    assert.equal(resolveCompanionKind("  "), "explanation");
  });

  it("accepts the four companion surfaces", () => {
    assert.equal(resolveCompanionKind("original"), "original");
    assert.equal(resolveCompanionKind("laboratory"), "laboratory");
  });

  it("Planted Negative: an unknown companion kind is refused by typed code", () => {
    assert.throws(() => resolveCompanionKind("slides"), CompanionKindError);
    try {
      resolveCompanionKind("slides");
    } catch (err) {
      assert.equal((err as CompanionKindError).code, "unknown-companion-kind");
      assert.equal((err as CompanionKindError).raw, "slides");
    }
  });
});
