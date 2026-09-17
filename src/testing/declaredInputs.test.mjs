import test from "node:test";
import assert from "node:assert/strict";
import {
  createDeclaredConstantSet,
  freezeConstantSet,
  evidentialRoleText,
} from "../physics/reference/constants.ts";
import { identifiabilityFamily } from "../physics/reference/inference.ts";
import {
  printedBrownianConstantSet,
  computeBm01StokesEinsteinTrace,
} from "../content/kernel/trace.ts";
test("teaching trace evaluates declared inputs without claiming measured or reviewed constants", () => {
  const set = printedBrownianConstantSet(),
    trace = computeBm01StokesEinsteinTrace();
  assert.equal(set.gasConstantProvenance, "not-applicable");
  assert.ok(
    set.entries.every((e) => e.evidentialRole === "declared-input" && e.uncertainty === undefined),
  );
  assert.match(trace.constantSetLabel, /source review pending/);
  assert.ok(
    Math.abs(
      trace.rows[4].value / ((8.31 * 290.15) / (6e23 * 6 * Math.PI * 1.35e-3 * 0.5e-6)) - 1,
    ) < 1e-14,
  );
  assert.match(evidentialRoleText(set.entries[0]), /chosen/);
  const result = identifiabilityFamily(
    { D: 1e-12, T: 293, eta: 0.001, radiusRange: [1e-8, 1e-6], synthetic: false },
    set,
  );
  assert.notEqual(result.kind, "accepted");
});
test("declared-input support does not weaken measured uncertainty or historical-role checks", () => {
  const set = printedBrownianConstantSet();
  assert.throws(
    () =>
      createDeclaredConstantSet({
        ...set,
        entries: set.entries.map((e) => ({ ...e, evidentialRole: "measured-observation" })),
      }),
    (e) => e.code === "measured-missing-uncertainty",
  );
  assert.throws(
    () =>
      freezeConstantSet({ ...set, entries: set.entries.map((e) => ({ ...e, kind: "measured" })) }),
    (e) => e.code === "invalid-evidential-role",
  );
  assert.throws(
    () =>
      freezeConstantSet({
        ...set,
        entries: set.entries.map((e) => ({ ...e, kind: "printed-historical" })),
      }),
    (e) => e.code === "invalid-evidential-role",
  );
});
