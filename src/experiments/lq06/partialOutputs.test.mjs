/**
 * LQ-06 may publish exactly one non-value output, and this says which and why.
 *
 * `allowPartial: true` on its own is an open door: it lets ANY output arrive as a
 * non-value without anything noticing. That would be the wrong repair for the outage
 * of 2026-09-20, where `bun run build` stopped in prepare:lab with
 *
 *     ExperimentRuntimeError [lq-06] publication-refused
 *     LQ-06 initial publication failed: malformed-publication.
 *
 * The underlying refusal was `ResultDecodeError: batch.outputs: partial results not
 * admitted by the manifest`, from results/codec.ts:349, which forbids a batch MIXING
 * value and non-value outputs when allowPartial is false. Meanwhile definition.ts:110
 * declares correspondenceVerdict as admitting ["value", "not-applicable"]. The two
 * declarations arrived together in 70fe7616 and contradict each other: at the default
 * parameters selectedSubexpression is "none", so the verdict is legitimately
 * not-applicable while the other outputs are values - a mixed batch by construction.
 *
 * So the manifest was right and allowPartial was wrong. This file is what keeps that a
 * decision rather than a silenced guard: it pins which output goes partial AT THE
 * DEFAULTS and in which state, so an accidental partial there still fails, and it pins
 * the justification itself, so allowPartial cannot outlive the contract it rests on.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { LQ06_DEFAULTS, LQ06_OUTPUTS } from "./definition.ts";
import { evaluateLq06 } from "./session.ts";

/** The only output LQ-06 may publish as a non-value, and the only status it may take. */
const PERMITTED_PARTIAL = Object.freeze({
  quantityId: "correspondenceVerdict",
  status: "not-applicable",
  because: "no subexpression is selected at the default parameters",
});

test("at the defaults, exactly one output is non-value and it is the declared one", () => {
  const outputs = evaluateLq06(LQ06_DEFAULTS);

  // Reachability before the claim: a mixed batch has to actually occur, or
  // "only the permitted one is partial" is true of a batch with no partials at all
  // and this test would pass for the wrong reason for the rest of its life.
  const nonValue = outputs.filter((output) => output.status !== "value");
  assert.equal(
    nonValue.length,
    1,
    `expected exactly one non-value output at the defaults, got ${nonValue.length}: ${nonValue
      .map((o) => `${o.quantityId}=${o.status}`)
      .join(", ")}`,
  );
  assert.ok(
    outputs.some((output) => output.status === "value"),
    "the batch must also contain values, or it is not the mixed case allowPartial governs",
  );

  const partial = nonValue[0];
  assert.equal(partial.quantityId, PERMITTED_PARTIAL.quantityId);
  assert.equal(partial.status, PERMITTED_PARTIAL.status);
});

test("the manifest itself admits that status for that output", () => {
  // The fix rests on this: allowPartial was corrected to match the manifest, not the
  // other way round. If someone narrows the contract later, the correction loses its
  // justification and this fails rather than leaving allowPartial standing on nothing.
  const contract = LQ06_OUTPUTS[PERMITTED_PARTIAL.quantityId];
  assert.ok(contract, `${PERMITTED_PARTIAL.quantityId} is not a declared output`);
  assert.ok(
    contract.statuses.includes(PERMITTED_PARTIAL.status),
    `the manifest must admit ${PERMITTED_PARTIAL.status} for ${PERMITTED_PARTIAL.quantityId}; it lists ${contract.statuses.join(", ")}`,
  );
});

test("the contract admits non-value statuses widely, which is why allowPartial is true", () => {
  // My first version of this test asserted the opposite - that every OTHER output
  // admits only "value", so the verdict was the single exception. That was an
  // invented constraint and it failed immediately: ten of the seventeen outputs
  // declare "outside-domain" and "not-applicable" alongside "value", because this
  // instrument has real domains where a quantity is not defined. AGENTS.md names
  // that exact case - a Wien-only entropy comparison in a dense state.
  //
  // So the finding is stronger than "one output was the exception". An instrument
  // whose manifest admits typed non-values on most of its outputs cannot coherently
  // declare that a batch may never mix them. allowPartial: false was inconsistent
  // with the contract from the moment both were written, not merely inconvenient.
  const admitsNonValue = Object.entries(LQ06_OUTPUTS).filter(([, contract]) =>
    contract.statuses.some((status) => status !== "value"),
  );

  assert.ok(
    admitsNonValue.length > 1,
    `allowPartial is true for this instrument on the grounds that its manifest admits ` +
      `typed non-values. Only ${admitsNonValue.length} output(s) now do, so that ground ` +
      `is gone: either narrow allowPartial again or record why it still holds.`,
  );
  assert.ok(
    admitsNonValue.some(([id]) => id === PERMITTED_PARTIAL.quantityId),
    "the output that actually goes partial at the defaults must be among them",
  );
});
