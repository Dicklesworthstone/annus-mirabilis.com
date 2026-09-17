import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPinnedEquation, pinEquation, unpinEquation } from "./pinnedEquationStore.ts";

describe("pinned equation store (am-read-page-anatomy-l0b)", () => {
  it("pin keeps equation id, form, and selection; unpin clears", () => {
    unpinEquation();
    const pinned = pinEquation({
      equationId: "eq-model-bm-rms",
      formId: "printed",
      selection: "s4-p2",
    });
    assert.deepEqual(getPinnedEquation(), pinned);
    pinEquation({
      equationId: "eq-model-bm-rms",
      formId: "modern",
      selection: "s4-p2",
    });
    assert.equal(getPinnedEquation()?.formId, "modern");
    assert.equal(getPinnedEquation()?.selection, "s4-p2");
    unpinEquation();
    assert.equal(getPinnedEquation(), null);
  });

  it("Planted Negative: pinning without an equation id or form is refused", () => {
    assert.throws(() => pinEquation({ equationId: "", formId: "printed", selection: "s4" }));
    assert.throws(() => pinEquation({ equationId: "eq-1", formId: "  ", selection: "s4" }));
  });
});
