import { expect, test } from "bun:test";
import { AVOGADRO_DEFAULTS } from "./definition.ts";
import { pinMolecularObservations } from "./identification.ts";
import { createAvogadroSession } from "./session.ts";

const sourceDigest = `source:sha256:${"a".repeat(64)}`;
const snapshot = () => createAvogadroSession("identification-test").getSnapshot().accepted!;

test("the handoff copies accepted solute observations and their exact constant basis, never inferred answers", () => {
  const accepted = snapshot();
  const decision = pinMolecularObservations(accepted, sourceDigest);
  if (decision.kind !== "accepted") throw new Error(decision.reason);
  const pinned = decision.observations;
  expect(pinned.inputs.diffusion).toBe(AVOGADRO_DEFAULTS.soluteDiffusionUm2S * 1e-12);
  expect(pinned.inputs.viscosity).toBe(AVOGADRO_DEFAULTS.viscosityMpaS * 1e-3);
  expect(pinned.inputs).not.toHaveProperty("radius");
  expect(pinned.inputs).not.toHaveProperty("molecularNumber");
  expect(pinned.basis.setId).toBe("modern-si-2019");
  expect(pinned.source).toEqual({
    instanceId: accepted.instanceId,
    runId: accepted.runId,
    snapshotVersion: accepted.snapshotVersion,
    sourceDigest,
  });
  expect(Object.isFrozen(pinned.inputs)).toBe(true);
  expect(Object.isFrozen(pinned.source)).toBe(true);
});

test("switching the real source lab to historical gas data cannot rewrite an already pinned observation", () => {
  const session = createAvogadroSession("historical-identification");
  const before = pinMolecularObservations(session.getSnapshot().accepted!, sourceDigest);
  if (before.kind !== "accepted") throw new Error(before.reason);
  const saved = JSON.stringify(before.observations);
  session.apply({ ...AVOGADRO_DEFAULTS, constantBasis: 1, soluteDiffusionUm2S: 1000 });
  const after = pinMolecularObservations(session.getSnapshot().accepted!, sourceDigest);
  if (after.kind !== "accepted") throw new Error(after.reason);
  expect(after.observations.basis.setId).toBe("einstein-1905-brownian-printed");
  expect(after.observations.inputs.gasConstant).toBe(8.31);
  expect(after.observations.inputs.diffusion).toBe(1e-9);
  expect(JSON.stringify(before.observations)).toBe(saved);
  expect(after.observations.source.snapshotVersion).toBeGreaterThan(
    before.observations.source.snapshotVersion,
  );
});

test("foreign, unfinished and malformed snapshots refuse the handoff", () => {
  const accepted = snapshot();
  for (const invalid of [
    { ...accepted, experimentId: "bm-07" },
    { ...accepted, final: false },
    { ...accepted, parameters: { ...accepted.parameters, constantBasis: 2 } },
  ]) {
    const decision = pinMolecularObservations(invalid, sourceDigest);
    expect(decision.kind).toBe("refused");
    if (decision.kind === "refused") expect(decision.refusal.code).toBe("invalid-parameter");
  }
});
