import { describe, expect, it } from "bun:test";
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
    expect(getReviewStateCheck()).toBe(strictNoReviewedCheck);

    const checkContext = {
      unitId: "unit-reg-test",
      paper: "brownian-motion",
      layer: "translation",
      revision: 1,
    };

    const resStrict = getReviewStateCheck()(checkContext);
    expect(resStrict.ok).toBe(false);
    expect(resStrict.code).toBe("review-records-not-available");

    // 2. Install record-backed check
    registerEditionReviewState();
    expect(getReviewStateCheck()).toBe(recordBackedReviewStateCheck);

    // Call installer again -> still single active check
    registerEditionReviewState();
    expect(getReviewStateCheck()).toBe(recordBackedReviewStateCheck);

    // With record-backed registered: fails missing rather than not-available
    const resRecordBacked = getReviewStateCheck()(checkContext);
    expect(resRecordBacked.ok).toBe(false);
    expect(resRecordBacked.code).toBe("review-record-missing");

    // 3. Reset back to strict default
    resetReviewStateCheck();
    expect(getReviewStateCheck()).toBe(strictNoReviewedCheck);
    const resReset = getReviewStateCheck()(checkContext);
    expect(resReset.ok).toBe(false);
    expect(resReset.code).toBe("review-records-not-available");
  });
});
