/**
 * Anti-circularity and self-citation tests for derivation chains.
 *
 * Enforces acceptance criteria for am-eq-derivation-chains-r4c:
 * - A derivation step citing chain.target as a premise must be rejected, naming the step (verifyChain.ts:88).
 * - A derivation chain entry assumption citing chain.target as a premise must be rejected, naming the chain (verifyChain.ts:96).
 * - Deliberately permitted counterpart: edgeType "cross-reference" is navigation, not a premise, and must be accepted for both.
 */

import { describe, expect, test } from "bun:test";
import {
  adversarialEntryAssumptionSelfCitation,
  adversarialStepSelfCitation,
  fixtureEntryAssumptionCrossReferenceTarget,
  fixtureStepCrossReferenceTarget,
} from "./fixtures.ts";
import { verifyChain } from "./verifyChain.ts";

describe("Derivation Anti-Circularity: Self-Citation Gating", () => {
  test("step citing chain.target as premise is rejected, naming the step ID and target (verifyChain.ts:88)", () => {
    const report = verifyChain(adversarialStepSelfCitation);
    expect(report.passed).toBe(false);
    const expectedError = `derivation step "adv-step-cite-target-1" relies on its own conclusion "eq-adv-conclusion-target" as a premise.`;
    expect(report.errors).toContain(expectedError);
  });

  test("step citing chain.target with edgeType 'cross-reference' is accepted (verifyChain.ts:88 counterpart)", () => {
    const report = verifyChain(fixtureStepCrossReferenceTarget);
    expect(report.passed).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  test("entry assumption citing chain.target as premise is rejected, naming the chain ID and target (verifyChain.ts:96)", () => {
    const report = verifyChain(adversarialEntryAssumptionSelfCitation);
    expect(report.passed).toBe(false);
    const expectedError = `derivation chain "chain-adv-entry-assumption-self-citation" entry assumption relies on its own conclusion "eq-adv-entry-target".`;
    expect(report.errors).toContain(expectedError);
  });

  test("entry assumption citing chain.target with edgeType 'cross-reference' is accepted (verifyChain.ts:96 counterpart)", () => {
    const report = verifyChain(fixtureEntryAssumptionCrossReferenceTarget);
    expect(report.passed).toBe(true);
    expect(report.errors).toHaveLength(0);
  });
});
