import {
  C_SI,
  fieldInvariants,
  lorentzForce,
  type Sr08Input,
  type Sr08Snapshot,
  type Vec3,
} from "../../physics/reference/fields.ts";
import { transformThreeForce } from "../../physics/reference/forceTransform.ts";
import type { ScientificResult } from "../results/types.ts";
import type { OutputContract } from "../store/instanceStore.ts";

const contract = (unit: string, semanticKind: string, ownerId: string): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: ["value", "outside-domain"] as const });
export const SR08_FORCE_LEDGER_OUTPUTS = Object.freeze({
  electricForceStationary: contract("N", "electric-force-stationary", "fields.lorentzForce"),
  electricForceMoving: contract("N", "electric-force-moving", "fields.lorentzForce"),
  magneticForceStationary: contract("N", "magnetic-force-stationary", "fields.lorentzForce"),
  magneticForceMoving: contract("N", "magnetic-force-moving", "fields.lorentzForce"),
  forceMovingFromFourForce: contract(
    "N",
    "three-force-moving-modern-oracle",
    "host:three-force-transform-v1",
  ),
  forceTransformationResidual: contract(
    "N",
    "three-force-covariance-residual",
    "host:three-force-transform-v1",
  ),
  particleTimeJacobian: contract(
    "1",
    "dt-prime-over-dt-along-particle",
    "host:three-force-transform-v1",
  ),
  fieldInvariantEDotBMoving: contract(
    "T V/m",
    "field-invariant-dot-moving",
    "fields.fieldInvariants",
  ),
  fieldInvariantE2MinusC2B2Moving: contract(
    "V^2/m^2",
    "field-invariant-difference-moving",
    "fields.fieldInvariants",
  ),
});
export type ForceLedgerId = keyof typeof SR08_FORCE_LEDGER_OUTPUTS;
const zero: Vec3 = Object.freeze({ x: 0, y: 0, z: 0 });
const unpack = (result: ScientificResult): Vec3 | null => {
  if (
    result.status !== "value" ||
    !(result.value instanceof Float64Array) ||
    result.value.length !== 3 ||
    !result.value.every(Number.isFinite)
  )
    return null;
  const x = result.value[0];
  const y = result.value[1];
  const z = result.value[2];
  if (x === undefined || y === undefined || z === undefined) return null;
  return { x, y, z };
};
const vector = (v: Vec3) => new Float64Array([v.x, v.y, v.z]);
const identity = (quantityId: ForceLedgerId) => {
  const { statuses: _statuses, ...rest } = SR08_FORCE_LEDGER_OUTPUTS[quantityId];
  return { quantityId, ...rest };
};

/** Derive every extra reading from the same owner snapshot, before store publication. */
export function forceLedgerOutputs(input: Sr08Input, snapshot: Sr08Snapshot): ScientificResult[] {
  const outside = (reason: string, domainKind: "physical" | "numerical"): ScientificResult[] =>
    (Object.keys(SR08_FORCE_LEDGER_OUTPUTS) as ForceLedgerId[]).map((id) => ({
      ...identity(id),
      status: "outside-domain",
      domainKind,
      reason,
      condition: "finite admitted field and massive-particle snapshot",
      boundary: { parameterId: "boost", value: 0 },
    }));
  const E = unpack(snapshot.electricFieldStationary);
  const B = unpack(snapshot.magneticFieldStationary);
  const Ep = unpack(snapshot.electricFieldMoving);
  const Bp = unpack(snapshot.magneticFieldMoving);
  const u = unpack(snapshot.chargeVelocityStationary);
  const up = unpack(snapshot.chargeVelocityMoving);
  const F = unpack(snapshot.transverseForceLaboratory);
  const Fp = unpack(snapshot.transverseForceComoving);
  if (!E || !B || !Ep || !Bp || !u || !up || !F || !Fp)
    return outside(
      "No finite, admitted field/velocity/force snapshot is available for this comparison.",
      "numerical",
    );
  const oracle = transformThreeForce({ force: F, velocity: u, beta: input.boost / C_SI, c: C_SI });
  if (oracle.status !== "value")
    return outside(oracle.reason, oracle.domainKind === "physical" ? "physical" : "numerical");
  const invariants = fieldInvariants(Ep, Bp);
  const value = (id: ForceLedgerId, data: number | Float64Array): ScientificResult => ({
    ...identity(id),
    status: "value",
    value: data,
  });
  const outputs = [
    value("electricForceStationary", vector(lorentzForce(input.testCharge, E, zero, u))),
    value("electricForceMoving", vector(lorentzForce(input.testCharge, Ep, zero, up))),
    value("magneticForceStationary", vector(lorentzForce(input.testCharge, zero, B, u))),
    value("magneticForceMoving", vector(lorentzForce(input.testCharge, zero, Bp, up))),
    value("forceMovingFromFourForce", vector(oracle.force)),
    value(
      "forceTransformationResidual",
      vector({ x: Fp.x - oracle.force.x, y: Fp.y - oracle.force.y, z: Fp.z - oracle.force.z }),
    ),
    value("particleTimeJacobian", oracle.dtPrimeOverDt),
    value("fieldInvariantEDotBMoving", invariants.eDotB),
    value("fieldInvariantE2MinusC2B2Moving", invariants.e2MinusC2B2),
  ];
  for (const output of outputs) {
    if (output.status !== "value") continue;
    const finite =
      typeof output.value === "number"
        ? Number.isFinite(output.value)
        : output.value instanceof Float64Array && output.value.every(Number.isFinite);
    if (!finite)
      return outside(
        "The force breakdown or invariant comparison exceeds the finite numerical range.",
        "numerical",
      );
  }
  return outputs;
}
