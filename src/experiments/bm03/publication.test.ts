import { expect, test } from "bun:test";
import { weaveOutputs } from "../weave/sessionSource.ts";
import { BM03_DEFAULTS, BM03_OUTPUTS } from "./definition.ts";
import { createBm03Session } from "./session.ts";

test("BM03 publishes distinct typed identities for the two pressures and the symbolic terms", () => {
  const session = createBm03Session("osmotic-output-identities");
  const snapshot = session.getSnapshot().accepted;
  expect(new Set(snapshot.outputs.map((out) => out.quantityId)).size).toBe(snapshot.outputs.length);
  for (const output of snapshot.outputs) {
    const contract = BM03_OUTPUTS[output.quantityId as keyof typeof BM03_OUTPUTS];
    expect(contract).toBeDefined();
    expect(output.unit).toBe(contract.unit);
    expect(output.ownerId).toBe(contract.ownerId);
    expect(output.semanticKind).toBe(contract.semanticKind);
    expect(contract.statuses).toContain(output.status);
  }
  const outputs = weaveOutputs(snapshot);
  expect(outputs.factorRatio?.value).toBe(4);
  expect(outputs.pressure?.value).toBeCloseTo(2 * Number(outputs.lockedClusterPressure?.value), 18);
  expect(outputs.volumeIndependentFactor?.status).toBe("symbolic");
  expect(outputs.momentumIntegrals?.status).toBe("symbolic");
  expect(outputs.freeEnergyOffset?.status).toBe("symbolic");
});

test("an overflowed or underflowed ratio never masquerades as its logarithm or zero", () => {
  for (const volumeRatio of [2, 0.5]) {
    const session = createBm03Session(`osmotic-range-${volumeRatio}`, {
      ...BM03_DEFAULTS,
      Np: 1_000_000,
      volumeRatio,
    });
    const outputs = weaveOutputs(session.getSnapshot().accepted);
    expect(outputs.factorRatio?.status).toBe("outside-domain");
    expect(outputs.factorRatio?.value).toBeUndefined();
    expect(outputs.logFactorRatio?.status).toBe("value");
    expect(outputs.log10FactorRatio?.status).toBe("value");
    expect(Number.isFinite(outputs.logFactorRatio?.value)).toBe(true);
    expect(Number.isFinite(outputs.log10FactorRatio?.value)).toBe(true);
    expect(outputs.deltaF?.status).toBe("value");
  }
});

test("presentation changes and refused drafts retain the exact accepted evaluation", () => {
  const session = createBm03Session("osmotic-cache");
  const first = session.getSnapshot();
  expect(session.apply({ ...BM03_DEFAULTS, notation: "modern", step: "derivative" }).kind).toBe(
    "accepted",
  );
  expect(session.getSnapshot().evaluation).toBe(first.evaluation);
  const accepted = session.getSnapshot();
  expect(session.apply({ ...BM03_DEFAULTS, Np: 0 }).kind).toBe("refused");
  expect(session.getSnapshot().evaluation).toBe(accepted.evaluation);
  expect(session.getSnapshot().accepted).toBe(accepted.accepted);
  expect(session.getServerSnapshot()).toBe(first);
  expect(session.apply({ ...BM03_DEFAULTS, model: "locked-cluster" }).kind).toBe("accepted");
  expect(session.getSnapshot().evaluation).not.toBe(first.evaluation);
  const locked = weaveOutputs(session.getSnapshot().accepted);
  expect(locked.pressure?.status).toBe("outside-domain");
  expect(locked.lockedClusterPressure?.status).toBe("value");
  expect(locked.factorRatio?.value).toBe(2);
  expect(session.getServerSnapshot()).toBe(first);
});
