import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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

  it("static scan confirms exactly one registration call site in align-editions.ts and editionContract.ts with no bypass", () => {
    const alignScriptPath = path.resolve(process.cwd(), "scripts/align-editions.ts");
    const editionContractPath = path.resolve(
      process.cwd(),
      "src/testing/editions/editionContract.ts",
    );

    const alignScriptSource = fs.readFileSync(alignScriptPath, "utf8");
    const editionContractSource = fs.readFileSync(editionContractPath, "utf8");

    // Each must have exactly one call to registerEditionReviewState()
    const alignMatches = alignScriptSource.match(/\bregisterEditionReviewState\s*\(\s*\)/g) ?? [];
    assert.equal(
      alignMatches.length,
      1,
      "scripts/align-editions.ts must have exactly one registerEditionReviewState() call site",
    );

    const contractMatches =
      editionContractSource.match(/\bregisterEditionReviewState\s*\(\s*\)/g) ?? [];
    assert.equal(
      contractMatches.length,
      1,
      "src/testing/editions/editionContract.ts must have exactly one registerEditionReviewState() call site",
    );

    // Neither should call registerReviewStateCheck directly (they must use registerEditionReviewState)
    assert.equal(
      /\bregisterReviewStateCheck\b/.test(alignScriptSource),
      false,
      "scripts/align-editions.ts must not call registerReviewStateCheck directly",
    );
    assert.equal(
      /\bregisterReviewStateCheck\b/.test(editionContractSource),
      false,
      "src/testing/editions/editionContract.ts must not call registerReviewStateCheck directly",
    );

    // Neither should locally implement a ReviewStateCheck
    assert.equal(
      /function\s+\w+Check|\bconst\s+\w+Check\s*=\s*\([^)]*\)\s*=>/.test(alignScriptSource),
      false,
      "scripts/align-editions.ts must not define a local review-state check",
    );
    assert.equal(
      /function\s+\w+Check|\bconst\s+\w+Check\s*=\s*\([^)]*\)\s*=>/.test(editionContractSource),
      false,
      "src/testing/editions/editionContract.ts must not define a local review-state check",
    );
  });
});
