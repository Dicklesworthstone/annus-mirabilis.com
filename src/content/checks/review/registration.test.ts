import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getReviewStateCheck,
  resetReviewStateCheck,
  strictNoReviewedCheck,
} from "../../editions/reviewState.ts";
import { recordBackedReviewStateCheck, registerEditionReviewState } from "./editionReviewState.ts";

describe("Review State Check Registration Seam", () => {
  it("registers record-backed check and verifies single slot behavior and reset", () => {
    // 1. Initial state is strict default
    resetReviewStateCheck();
    assert.equal(getReviewStateCheck(), strictNoReviewedCheck);

    const checkContext = {
      unitId: "unit-reg-test",
      paper: "brownian-motion",
      layer: "translation" as const,
      revision: 1,
    };

    const resStrict = getReviewStateCheck()(checkContext);
    assert.equal(resStrict.ok, false);
    assert.equal(resStrict.code, "review-records-not-available");

    // 2. Install record-backed check
    registerEditionReviewState();
    assert.equal(getReviewStateCheck(), recordBackedReviewStateCheck);

    // Call installer again -> still single active check
    registerEditionReviewState();
    assert.equal(getReviewStateCheck(), recordBackedReviewStateCheck);

    // With record-backed registered: fails missing rather than not-available
    const resRecordBacked = getReviewStateCheck()(checkContext);
    assert.equal(resRecordBacked.ok, false);
    assert.equal(resRecordBacked.code, "review-record-missing");

    // 3. Reset back to strict default
    resetReviewStateCheck();
    assert.equal(getReviewStateCheck(), strictNoReviewedCheck);
    const resReset = getReviewStateCheck()(checkContext);
    assert.equal(resReset.ok, false);
    assert.equal(resReset.code, "review-records-not-available");
  });
});
