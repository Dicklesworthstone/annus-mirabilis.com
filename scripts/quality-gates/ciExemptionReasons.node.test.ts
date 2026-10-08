/**
 * Every CI exemption carries its reason as DATA (am-xoxn, acceptance criterion 5).
 *
 * The bead's words: the registry must record, per step, WHY a step is not required in CI, "so
 * `requiredInCi false` stops being a flag whose reason lives only in a code comment".
 *
 * Most exemptions did have a reason and it was written in prose beside the entry, where nothing
 * could read it and nothing noticed when one was missing. FOUR HAD NONE AT ALL - ubs-diff,
 * ubs-staged, voice-lint and resource-stress - and writing them is what turned up the one worth
 * seeing: voice-lint is exempt because it EXITS 1 at HEAD, which is a reason to fix the errors or
 * declare the flags acceptable rather than a permanent exemption. A comment nobody reads cannot
 * raise that question; a required field does.
 *
 * BOTH DIRECTIONS ARE ENFORCED, and the second matters as much as the first. A reason is REQUIRED
 * when requiredInCi is false and FORBIDDEN when it is true: an optional field that may appear
 * anywhere becomes decoration, and a step that flipped to required while keeping its stale excuse
 * would read as deliberate.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { QUALITY_GATE_STEPS } from "./registry.ts";

/** Long enough to be a reason rather than a label. The shortest real one here is 180 characters. */
const MINIMUM_REASON = 80;

test("every step not required in CI states why, and no required step carries an excuse", () => {
  const exempt = QUALITY_GATE_STEPS.filter((step) => !step.requiredInCi);
  const required = QUALITY_GATE_STEPS.filter((step) => step.requiredInCi);
  console.log(
    `[ci exemptions] ${QUALITY_GATE_STEPS.length} registry steps: ${required.length} required in CI, ` +
      `${exempt.length} exempt, ${exempt.filter((s) => s.notRequiredInCiReason).length} of the exempt stating why`,
  );

  // NON-VACUITY FIRST, in both directions: a registry where every step were required, or none
  // were, would satisfy one of the two assertions below while proving nothing.
  assert.ok(exempt.length > 0, "no step is exempt, so this test examined nothing");
  assert.ok(required.length > 0, "no step is required, so the forbidden half examined nothing");

  const silent = exempt.filter((s) => !s.notRequiredInCiReason).map((s) => s.id);
  assert.deepEqual(silent, [], `exempt steps with no recorded reason: ${silent.join(", ")}`);

  const tooShort = exempt
    .filter((s) => (s.notRequiredInCiReason ?? "").trim().length < MINIMUM_REASON)
    .map((s) => s.id);
  assert.deepEqual(tooShort, [], `reasons too short to be reasons: ${tooShort.join(", ")}`);

  const excused = required.filter((s) => s.notRequiredInCiReason).map((s) => s.id);
  assert.deepEqual(
    excused,
    [],
    `required steps carrying a CI exemption reason: ${excused.join(", ")}`,
  );
});

test("a reason names a condition, not merely the family or the cadence", () => {
  // The weakest passing reason would be "it is in the perf family", which restates the row above
  // it. Each reason must say something the other fields do not already carry, so it is checked
  // for a word that describes a CONDITION rather than a classification. This is a coarse check
  // and is meant to be: it catches a placeholder, not a bad argument.
  const SUBSTANCE =
    /\b(because|so that|so |since|would|cannot|does not|nothing|no \w+|exits?|empty|none)\b/i;
  const thin = QUALITY_GATE_STEPS.filter(
    (s) => s.notRequiredInCiReason && !SUBSTANCE.test(s.notRequiredInCiReason),
  ).map((s) => s.id);
  assert.deepEqual(
    thin,
    [],
    `reasons that restate a field instead of giving a condition: ${thin.join(", ")}`,
  );
});

test("the exemptions are the ones expected, named rather than counted", () => {
  // An identity assertion, not a census: the bead asks which steps are exempt and why, and a count
  // would pass while the SET changed underneath it. Adding an exemption should require saying so
  // here, which is the point of listing them.
  const ids = QUALITY_GATE_STEPS.filter((s) => !s.requiredInCi).map((s) => s.id);
  for (const expected of [
    "stashes",
    "ubs-diff",
    "ubs-staged",
    "voice-lint",
    "coverage-report",
    "facsimile-pins",
  ])
    assert.ok(
      ids.includes(expected),
      `${expected} is no longer exempt; update this list deliberately`,
    );
  /*
    `perf-budgets` AND `resource-stress` LEFT THIS LIST ON 2026-10-08, deliberately, which is what
    this assertion exists to force. Owner's decision on am-7bkr: both moved from `perf`/`nightly`,
    where no CI path reached them and nothing had ever run them, to `fast`/`every-run`, so
    `bun run gates` executes them. `requiredInCi` became true and their reasons were removed,
    because this file forbids an excuse on a required step.

    Measured before the move, since runtime was the obvious objection: perf-budgets 3 seconds,
    resource-stress under a second, both passing, neither vacuous. Verified after, through the real
    family: `--family fast --only perf-budgets --only resource-stress` selects 2 and passes both.

    They are asserted REQUIRED here rather than simply deleted from the list, so a silent flip back
    fails in the same place a silent flip out would have.
  */
  for (const nowRequired of ["perf-budgets", "resource-stress"]) {
    const step = QUALITY_GATE_STEPS.find((s) => s.id === nowRequired);
    assert.ok(step, `${nowRequired} is not in the registry`);
    assert.equal(
      step.requiredInCi,
      true,
      `${nowRequired} stopped being required in CI; if that is deliberate, restore its reason above`,
    );
    assert.ok(
      !ids.includes(nowRequired),
      `${nowRequired} is exempt again, which contradicts the am-7bkr decision`,
    );
  }
  // The apple family is generated by a map and every member is exempt for one reason.
  const apple = QUALITY_GATE_STEPS.filter((s) => s.family === "apple");
  assert.ok(apple.length > 0, "no apple steps, so the shared-reason case examined nothing");
  for (const step of apple) {
    assert.equal(step.requiredInCi, false, `${step.id} must stay off the website's CI lane`);
    assert.match(String(step.notRequiredInCiReason), /Apple validation runs locally/);
  }
});
