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
import { hasPaperSegment, verifyChain } from "./verifyChain.ts";

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

describe("paper classification by id segment, not by substring (am-o44v)", () => {
  // The repair replaced chain.id.includes("me-") and .includes("sr-"), two- and
  // three-character substring tests that decided WHICH physics constraints a
  // chain is checked against. Both halves are asserted here, and the genuine
  // half uses REAL ids taken from the corpus rather than invented ones - the
  // lesson from ac0d401b, where a release gate was tightened against a bare
  // "READY" that the real input never contained and refused every deployment.
  const realMassEnergyIds = [
    "arg-me-import",
    "arg-me-two-ledgers",
    "arg-me-symmetric-emission",
    "eq-model-me-exact-drop",
    "eq-model-me-ledger-subtraction",
  ];
  const realRelativityIds = [
    "arg-sr-charge-current",
    "arg-sr-clock-and-length",
    "arg-sr-doppler-aberration",
    "arg-sr-field-components",
  ];

  test("every real mass-energy id in the corpus is still classified", () => {
    for (const id of realMassEnergyIds) {
      expect(hasPaperSegment(id, "me")).toBe(true);
      expect(hasPaperSegment(id, "sr")).toBe(false);
    }
  });

  test("every real relativity id in the corpus is still classified", () => {
    for (const id of realRelativityIds) {
      expect(hasPaperSegment(id, "sr")).toBe(true);
      expect(hasPaperSegment(id, "me")).toBe(false);
    }
  });

  test("an id that merely contains the marker inside a word is not classified", () => {
    // frame-simultaneous and time-average already exist in this corpus as ids
    // of other kinds, and both contain the characters "me-". Under the old
    // substring test a chain named either would have been held to mass-energy
    // constraints.
    for (const id of ["frame-simultaneous", "time-average", "runtime-utilities", "scheme-a"]) {
      expect(hasPaperSegment(id, "me")).toBe(false);
    }
    for (const id of ["usr-local-path", "browser-frame"]) {
      expect(hasPaperSegment(id, "sr")).toBe(false);
    }
  });

  test("the spelled-out namespaces classify too, as whole segments", () => {
    expect(hasPaperSegment("arg-mass-energy-scope", "me")).toBe(true);
    expect(hasPaperSegment("chain-lorentz-boost", "sr")).toBe(true);
    // and not as fragments inside a longer word
    expect(hasPaperSegment("nonlorentzian-limit", "sr")).toBe(false);
  });
});
