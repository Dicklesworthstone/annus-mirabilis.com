/**
 * THE RELATIVITY CAPSTONE'S PRESETS, AGAINST THE EVALUATORS THAT ISSUE THEM
 * (am-disc-capstone-relativity-t8hg, dispatch 373 addendum).
 *
 * WHY THIS FILE IS HERE AND NOT BESIDE THE PAGE IT TESTS, which is the whole reason it exists.
 * `src/testing/noPhysicsInComponents.test.ts` forbids importing `src/physics/reference/**` from any
 * watched module, because components "never independently recompute physics". These two assertions
 * first lived in the capstone's `page.test.tsx`, where they turned that boundary red and refused a
 * deployment candidate.
 *
 * READ `isWatchedPath` RATHER THAN ITS DESCRIPTION, because the rule is wider than "no .tsx" and I
 * got it wrong once by trusting the summary. A path is watched when it ends `.tsx` OR when it starts
 * with `src/visuals/`, `src/reader/`, `src/equations/` or `src/app/`. So moving the physics into a
 * plain `.ts` BESIDE the page does not help: anything under `src/app/` is watched whatever its
 * extension, and my first repair failed for exactly that reason. `src/testing/` is not watched, and
 * `src/testing/bm07.presets.test.ts` is the established precedent for preset values checked against
 * the real evaluators from here.
 *
 * The gate is right and was not touched. page.test.tsx keeps every assertion that reads the record or
 * the rendered page, and keeps the scenario-golden comparisons, which reach the owners through the
 * scenario registry rather than through physics/reference.
 *
 * WHY THESE TWO ARE NOT SCENARIO GOLDENS. Both compute something no scenario record carries, which is
 * why the evaluator call is not a re-derivation of a value that already exists:
 *   - `measureRodLength` returns a typed REFUSAL, `not-applicable` with
 *     `non-simultaneous-endpoints`. The bead requires it and `kinematics-boost-0.6c` records only
 *     numeric outputs, so no golden states it.
 *   - `e2MinusC2B2` is an output of no scenario: `fields-sr08-frame-change` carries gamma, EprimeY
 *     and BprimeZ, and `fields-invariants` carries E dot B rather than this combination.
 *
 * The inputs still come from the real scenarios through the registry, so nothing here is a number
 * typed by hand except the printed values the bead names.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { measureRodLength } from "../physics/reference/events.ts";
import { fieldInvariants } from "../physics/reference/fields.ts";
import { withinTolerance } from "../units/tolerance.ts";
import { loadScenarioFile } from "./scenario-registry/load.ts";
import { getOwner } from "./scenario-registry/owners.ts";

/** Every output one scenario's owner computes from that scenario's own inputs. */
function ownerOutputs(scenarioId: string): Record<string, number> {
  const { scenario: record } = loadScenarioFile(
    join(process.cwd(), `content/scenarios/${scenarioId}.yaml`),
  );
  const inputs = Object.fromEntries(
    Object.entries(record.inputs).map(([key, entry]) => [key, Number(entry.value)]),
  );
  const result = getOwner(record.owner ?? "").fn({
    inputs,
    constantSetId: record.constantSetId ?? "modern-si-2019",
  });
  expect([scenarioId, "refused", "refused" in result]).toEqual([scenarioId, "refused", false]);
  return result as Record<string, number>;
}

describe("the relativity capstone's presets, at the evaluators", () => {
  test("SR-03: the separation that is not a length is refused, and the one that is gets credited", () => {
    const boost = ownerOutputs("kinematics-boost-0.6c");
    // Non-vacuity: the three inputs to the calls below are real owner outputs, not zeros from a
    // missing key, and they are the values the bead names.
    expect(boost.deltaTPrimeS).toBe(-7.5);
    expect(boost.deltaXPrimeLs).toBe(12.5);
    expect(boost.contractedLengthLs).toBe(8);

    // The refusal itself, from the owner that issues it. The pair simultaneous in the stationary
    // system is not simultaneous in the moving one, so its separation is not a length.
    const refused = measureRodLength(
      { t: 0, x: 0, y: 0, z: 0 },
      { t: boost.deltaTPrimeS ?? Number.NaN, x: boost.deltaXPrimeLs ?? Number.NaN, y: 0, z: 0 },
      "k",
      "K",
      0.6,
      10,
      1,
    );
    expect(refused.status).toBe("not-applicable");
    expect(refused.condition).toBe("non-simultaneous-endpoints");
    expect(refused.measuredLength).toBeUndefined();

    // Positive control: a pair simultaneous in the measuring frame IS a length, and it is the
    // contracted one. Without this the refusal above could come from a broken call.
    const credited = measureRodLength(
      { t: 0, x: 0, y: 0, z: 0 },
      { t: 0, x: boost.contractedLengthLs ?? Number.NaN, y: 0, z: 0 },
      "k",
      "K",
      0.6,
      10,
      1,
    );
    expect(credited.status).toBe("value");
    expect(withinTolerance(credited.measuredLength ?? 0, 8, { absolute: 1e-12 }).ok).toBe(true);
  });

  test("SR-08: the field combination the bead names is the same in both systems", () => {
    const fields = ownerOutputs("fields-sr08-frame-change");
    expect(fields.EprimeY).toBe(1.25);
    expect(withinTolerance(fields.BprimeZ ?? 0, -2.50173072552e-9, { relative: 1e-6 }).ok).toBe(
      true,
    );

    const rest = fieldInvariants({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
    const moving = fieldInvariants(
      { x: 0, y: fields.EprimeY ?? Number.NaN, z: 0 },
      { x: 0, y: 0, z: fields.BprimeZ ?? Number.NaN },
    );
    expect(withinTolerance(rest.e2MinusC2B2, 1, { absolute: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(moving.e2MinusC2B2, 1, { absolute: 1e-12 }).ok).toBe(true);
    // Negative control: the combination is not trivially one for any pair of fields, so the two
    // agreements above are the invariance rather than a constant the function returns.
    expect(
      withinTolerance(fieldInvariants({ x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: 0 }).e2MinusC2B2, 1, {
        absolute: 1e-12,
      }).ok,
    ).toBe(false);
  });
});
