/**
 * A derivation chain must still ARRIVE somewhere, and in order (am-nu8e).
 *
 * `verifyChain` checked every step against its own rule and nothing against the chain, so
 * on `fixturePaper4TwoLedgers` the bead measured: the full chain passed with 3 of 3 steps
 * verified; the chain with its LAST STEP REMOVED passed with 2 step reports; steps 1 and 2
 * SWAPPED passed. Only corrupting a step's own arithmetic failed. A chain that never reaches
 * its declared target, and a chain whose steps do not connect, both read as verified.
 *
 * Two repairs, because the two failures are not the same shape:
 *
 *   TRUNCATION is invisible from inside the chain. Dropping the last step leaves a shorter
 *   chain that is still internally consistent, so nothing local can object. The chain has to
 *   SAY where it arrives, which is `targetStepId`, and `validateChainStructure` then refuses
 *   a chain that has lost it or no longer ends on it.
 *
 *   ORDER is visible from inside, but only weakly. The literal rule the bead asked for --
 *   step n's result equals step n+1's input -- is not this corpus's convention and would
 *   redden three real chains (the measurement is in verifyChain.ts beside the check). What
 *   holds is the weaker claim: IF a step's result is used, it is used by its successor.
 *
 * The two negatives below are the point of the file. Everything else here is the control
 * that keeps them honest: a rule that refused every chain would also redden both plants.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  fixtureBrownianPedagogicalReconstruction,
  fixtureBrownianSourceOrder,
  fixtureLorentzMapConstruction,
  fixturePaper1WienEntropy,
  fixturePaper4TwoLedgers,
} from "../../equations/derivations/fixtures.ts";
import { containsSubtree } from "../../equations/derivations/treeUtils.ts";
import type { DerivationChain } from "../../equations/derivations/types.ts";
import { verifyChain } from "../../equations/derivations/verifyChain.ts";

const REAL_CHAINS: readonly DerivationChain[] = [
  fixtureBrownianPedagogicalReconstruction,
  fixtureBrownianSourceOrder,
  fixturePaper1WienEntropy,
  fixturePaper4TwoLedgers,
  fixtureLorentzMapConstruction,
];

/** The chain the bead measured, and the one both plants are made from. */
const LEDGERS = fixturePaper4TwoLedgers;

function withSteps(chain: DerivationChain, steps: DerivationChain["steps"]): DerivationChain {
  return { ...chain, steps };
}

test("the control: every real chain verifies, so neither new rule refuses everything", () => {
  for (const chain of REAL_CHAINS) {
    const report = verifyChain(chain);
    assert.equal(
      report.passed,
      true,
      `${chain.id} should still verify. errors: ${report.errors.join(" | ")}`,
    );
    assert.equal(report.errors.length, 0, `${chain.id}: ${report.errors.join(" | ")}`);
  }
  // Named rather than counted: these five are the signature chains, and a sixth arriving
  // should be added here deliberately rather than slipping past a number.
  assert.deepEqual(
    REAL_CHAINS.map((c) => c.id),
    [
      "chain-bm-pedagogical-variance",
      "chain-bm-source-diffusion-equation",
      "chain-lq-wien-entropy",
      "chain-me-two-ledgers",
      "chain-sr-lorentz-boost-construction",
    ],
  );
});

test("PLANT, truncation: the chain with its last step removed is refused, naming the target", () => {
  assert.equal(LEDGERS.steps.length, 3);
  assert.equal(LEDGERS.targetStepId, "me-step-3");
  assert.equal(verifyChain(LEDGERS).passed, true);

  const truncated = withSteps(LEDGERS, LEDGERS.steps.slice(0, -1));
  // Print what landed before reading the verdict: the plant is only evidence if the step
  // it was supposed to remove is actually gone.
  assert.deepEqual(
    truncated.steps.map((s) => s.id),
    ["me-step-1", "me-step-2"],
  );

  const report = verifyChain(truncated);
  assert.equal(report.passed, false);
  const joined = report.errors.join(" | ");
  assert.match(joined, /me-step-3/);
  assert.match(joined, /eq-me-01-mass-energy/);
});

test("the truncation is caught by the DECLARATION, which is what the bead's chain lacked", () => {
  // Without `targetStepId` the same truncated chain passes, exactly as measured on
  // 2026-09-24. This is not a gap left open: it is the defect, kept here so that removing
  // a chain's declaration can never look like a harmless edit.
  const undeclared: DerivationChain = { ...LEDGERS, targetStepId: undefined };
  const truncated = withSteps(undeclared, undeclared.steps.slice(0, -1));
  const report = verifyChain(truncated);
  assert.equal(report.passed, true);
  assert.equal(report.stepReports.length, 2);
});

test("PLANT, reordering: steps 1 and 2 swapped are refused, naming both steps", () => {
  const [one, two, three] = LEDGERS.steps;
  assert.ok(one && two && three);
  const swapped = withSteps(LEDGERS, [two, one, three]);
  assert.deepEqual(
    swapped.steps.map((s) => s.id),
    ["me-step-2", "me-step-1", "me-step-3"],
  );
  // The last step is untouched, so `targetStepId` is still satisfied and the refusal below
  // can only come from the order rule.
  assert.equal(swapped.steps[swapped.steps.length - 1]?.id, swapped.targetStepId);

  const report = verifyChain(swapped);
  assert.equal(report.passed, false);
  const orderErrors = report.errors.filter((e) => e.includes("is out of order"));
  assert.equal(orderErrors.length > 0, true, `errors were: ${report.errors.join(" | ")}`);
  const joined = orderErrors.join(" | ");
  assert.match(joined, /me-step-1/);
  assert.match(joined, /me-step-3/);
});

test("the order rule is not a ban on chains that change subject", () => {
  // Three real chains contain adjacencies where the next step does NOT continue from the
  // previous result: `chain-sr-lorentz-boost-construction` begins three steps from named
  // forms, and `chain-bm-source-diffusion-equation` works on part of a sum. The rule must
  // stay quiet on all of them, which the first test asserts as a whole and this one
  // asserts for the specific error text, so a future rule that refuses them cannot hide
  // behind a different message.
  for (const chain of REAL_CHAINS) {
    const outOfOrder = verifyChain(chain).errors.filter((e) => e.includes("is out of order"));
    assert.deepEqual(outOfOrder, [], `${chain.id} should not be called out of order`);
  }
});

test("the order rule has something to see: the corpus holds real consumption links", () => {
  // An order rule over a corpus where no step uses another's result cannot fail, and would
  // look identical to this one. Count the links the shipped predicate actually finds, and
  // floor it: 13 across the five real chains when measured on 2026-10-14.
  let links = 0;
  for (const chain of REAL_CHAINS) {
    for (let i = 0; i < chain.steps.length; i++) {
      const producer = chain.steps[i];
      if (!producer) continue;
      if (producer.to.kind === "symbol" || producer.to.kind === "number") continue;
      for (let j = 0; j < chain.steps.length; j++) {
        if (i === j) continue;
        const consumer = chain.steps[j];
        if (consumer && containsSubtree(consumer.from, producer.to)) links += 1;
      }
    }
  }
  assert.equal(links >= 10, true, `expected at least 10 consumption links, found ${links}`);
});

test("every real chain declares the step it arrives at", () => {
  for (const chain of REAL_CHAINS) {
    assert.equal(
      typeof chain.targetStepId,
      "string",
      `${chain.id} declares no targetStepId, so nothing would notice it being truncated`,
    );
    assert.equal(chain.targetStepId, chain.steps[chain.steps.length - 1]?.id);
  }
});
