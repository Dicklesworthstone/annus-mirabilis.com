import { decodeResult } from "../../experiments/results/codec.ts";
import {
  type ExecutionOutcomeId,
  executionOutcomeRegistry,
} from "../../experiments/results/outcomes.ts";
import { makeRefusal } from "../../experiments/results/refusals.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import { SR03_OUTPUTS } from "../../experiments/sr03/definition.ts";
import { validateSr03Parameters } from "../../experiments/sr03/parameters.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import {
  causalOrder,
  classifySimultaneity,
  measureRodLength,
  selectSimultaneousEndpoints,
} from "../../physics/reference/events.ts";
import type { Event } from "../../physics/reference/kinematics/types.ts";
import {
  alignedBoost,
  ellipsoidAxes,
  gamma,
  transformEvent,
} from "../../physics/reference/kinematics.ts";
import { withinTolerance } from "../../units/tolerance.ts";

export type Sr03Evaluation = Readonly<{
  outputs: readonly ScientificResult[];
  stepIndex: number;
  simulationTime: number;
}>;

export type EvaluationControl = Readonly<{
  cancelled?: () => boolean;
  yieldControl?: () => Promise<void>;
  chunkSteps?: number;
}>;

function outcome(id: Exclude<ExecutionOutcomeId, "budget-exhausted">): Computation<never> {
  return { kind: "outcome", outcome: { outcome: id, ...executionOutcomeRegistry[id] } };
}

function value(quantityId: string, val: number): ScientificResult {
  const c = SR03_OUTPUTS[quantityId];
  if (!c) throw new TypeError(`Undeclared output ${quantityId}`);
  return decodeResult({
    quantityId,
    unit: c.unit,
    semanticKind: c.semanticKind,
    ownerId: c.ownerId,
    status: "value",
    value: val,
  });
}

function notApplicable(quantityId: string, reason: string): ScientificResult {
  const c = SR03_OUTPUTS[quantityId];
  if (!c) throw new TypeError(`Undeclared output ${quantityId}`);
  return decodeResult({
    quantityId,
    unit: c.unit,
    semanticKind: c.semanticKind,
    ownerId: c.ownerId,
    status: "not-applicable",
    reason,
  });
}

export async function evaluateSr03(
  input: unknown,
  control: EvaluationControl = {},
): Promise<Computation<Sr03Evaluation>> {
  const validated = validateSr03Parameters(input);
  if (validated.kind !== "accepted") return validated;

  const cancelled = control.cancelled ?? (() => false);
  if (cancelled()) return outcome("cancelled");

  const p = validated.data;
  const c = 1.0; // light-seconds per second

  const gRes = gamma(p.v);
  if (gRes.status !== "value") {
    return {
      kind: "refused",
      refusal: makeRefusal("superluminal-observer", { parameterIds: ["v"] }),
    };
  }
  const g = gRes.value;

  const boostRes = alignedBoost(p.v, c);
  if (boostRes.status !== "value") {
    return {
      kind: "refused",
      refusal: makeRefusal("superluminal-observer", { parameterIds: ["v"] }),
    };
  }
  const boost = boostRes.value;

  // Determine endpoint events E1 and E2 in K
  let e1K: Event;
  let e2K: Event;

  switch (p.endpointPairId) {
    case "platform-simultaneous": {
      // 10 ls platform-simultaneous pair in K at t = 0
      e1K = { t: 0, x: 0, y: 0, z: 0 };
      e2K = { t: 0, x: p.L0, y: 0, z: 0 };
      break;
    }
    case "frame-simultaneous": {
      if (p.measuringFrame === "K") {
        // Simultaneous in K at t = 0 with separation L0/gamma
        const contractedL = p.rodRestFrame === "K" ? p.L0 : p.L0 / g;
        e1K = { t: 0, x: 0, y: 0, z: 0 };
        e2K = { t: 0, x: contractedL, y: 0, z: 0 };
      } else {
        // Measuring frame is k: endpoints simultaneous in k at t' = 0 with separation L0/gamma (or L0)
        const contractedL = p.rodRestFrame === "k" ? p.L0 : p.L0 / g;
        e1K = { t: 0, x: 0, y: 0, z: 0 };
        e2K = { t: g * p.v * contractedL, x: g * contractedL, y: 0, z: 0 };
      }
      break;
    }
    case "causal-timelike": {
      // Signature timelike pair: dt = 10 s, dx = 5 ls in K
      e1K = { t: 0, x: 0, y: 0, z: 0 };
      e2K = { t: 10, x: 5, y: 0, z: 0 };
      break;
    }
    case "causal-lightlike": {
      // Signature lightlike pair: dt = 10 s, dx = 10 ls in K
      e1K = { t: 0, x: 0, y: 0, z: 0 };
      e2K = { t: 10, x: 10, y: 0, z: 0 };
      break;
    }
    case "causal-threshold": {
      // Reversal threshold pair: dt = 2 s, dx = 10 ls in K
      e1K = { t: 0, x: 0, y: 0, z: 0 };
      e2K = { t: 2, x: 10, y: 0, z: 0 };
      break;
    }
    case "custom": {
      e1K = {
        t: p.customT1 ?? 0,
        x: p.customX1 ?? 0,
        y: 0,
        z: 0,
      };
      e2K = {
        t: p.customT2 ?? 0,
        x: p.customX2 ?? 10,
        y: 0,
        z: 0,
      };
      break;
    }
  }

  // Transform E1 and E2 to k
  const e1kRes = transformEvent(e1K, boost);
  const e2kRes = transformEvent(e2K, boost);

  if (e1kRes.status !== "value" || e2kRes.status !== "value") {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["v"] }),
    };
  }

  const e1k = e1kRes.value;
  const e2k = e2kRes.value;

  const dtK = e2K.t - e1K.t;
  const dxK = e2K.x - e1K.x;
  const dtk = e2k.t - e1k.t;
  const dxk = e2k.x - e1k.x;

  const simK = classifySimultaneity(dtK);
  const simk = classifySimultaneity(dtk);

  // Invariant causal order
  const causalRes = causalOrder(e1K, e2K, c);
  const s2 = causalRes.status === "value" ? causalRes.value.s2 : dxK * dxK - dtK * dtK;
  const causalKind =
    causalRes.status === "value" ? causalRes.value.classification : "indeterminate";

  // Length measurement in measuringFrame
  const measuringE1 = p.measuringFrame === "K" ? e1K : e1k;
  const measuringE2 = p.measuringFrame === "K" ? e2K : e2k;
  const meas = measureRodLength(
    measuringE1,
    measuringE2,
    p.measuringFrame,
    p.rodRestFrame,
    p.v,
    p.L0,
    c,
  );

  // The rod's own length in each frame: its two ends read at one time of that frame, from the
  // reference owner (selectSimultaneousEndpoints). The lab's strips and verdict read these, so the
  // distance it calls the rod's is never a component's L0/γ (am-sr03-default-readings-not-rod-ends-bf7w).
  const rodEndsK = selectSimultaneousEndpoints(p.rodRestFrame, "K", p.v, p.L0, 0, c);
  const rodEndsk = selectSimultaneousEndpoints(p.rodRestFrame, "k", p.v, p.L0, 0, c);
  if (rodEndsK.status !== "value" || rodEndsk.status !== "value") {
    return {
      kind: "refused",
      refusal: makeRefusal("invalid-parameter", { parameterIds: ["L0", "v"] }),
    };
  }
  const rodLengthK = Math.abs(rodEndsK.value.e2.x - rodEndsK.value.e1.x);
  const rodLengthk = Math.abs(rodEndsk.value.e2.x - rodEndsk.value.e1.x);

  // Whether the two readings lie on the rod's two ends. In its rest frame the rod's ends stay at
  // x = 0 and x = L0 (the frame-simultaneous pair is built from them), so the readings are its ends
  // when one sits at each there. The default platform pair is two marks L0 apart in K: its ends only
  // when the rod rests in K.
  const restE1 = p.rodRestFrame === "K" ? e1K : e1k;
  const restE2 = p.rodRestFrame === "K" ? e2K : e2k;
  const at = (x: number, end: number) =>
    withinTolerance(x, end, { absolute: 1e-9 * p.L0, relative: 1e-9 }).ok;
  const onRodEnds =
    (at(restE1.x, 0) && at(restE2.x, p.L0)) || (at(restE1.x, p.L0) && at(restE2.x, 0));

  // Sphere ellipsoid axes
  const axesRes = ellipsoidAxes(p.R, p.v);
  const longitudinal = axesRes.status === "value" ? axesRes.value.longitudinal : p.R / g;
  const transverseY = axesRes.status === "value" ? axesRes.value.transverseY : p.R;
  const transverseZ = axesRes.status === "value" ? axesRes.value.transverseZ : p.R;

  const simKVal = simK === "simultaneous" ? 0 : simK === "ordered-positive" ? 1 : -1;
  const simkVal = simk === "simultaneous" ? 0 : simk === "ordered-positive" ? 1 : -1;
  const causalVal = causalKind === "spacelike" ? 1 : causalKind === "lightlike" ? 0 : -1;

  const outputs: ScientificResult[] = [
    value("spatialSeparationK", dxK),
    value("temporalSeparationK", dtK),
    value("spatialSeparationKPrime", dxk),
    value("temporalSeparationKPrime", dtk),
    value("simultaneityK", simKVal),
    value("simultaneityKPrime", simkVal),
    meas.status === "value" && meas.measuredLength !== undefined
      ? value("measuredLength", meas.measuredLength)
      : notApplicable(
          "measuredLength",
          meas.reason ?? "these endpoint events are not simultaneous in the measuring frame",
        ),
    value("rodLengthK", rodLengthK),
    value("rodLengthKPrime", rodLengthk),
    value("readingsOnRodEnds", onRodEnds ? 1 : 0),
    value("spacetimeIntervalSquared", s2),
    value("causalOrder", causalVal),
    value("gammaFactor", g),
    value("ellipsoidAxisLongitudinal", longitudinal),
    value("ellipsoidAxisTransverseY", transverseY),
    value("ellipsoidAxisTransverseZ", transverseZ),
  ];

  return {
    kind: "accepted",
    data: {
      outputs: Object.freeze(outputs),
      stepIndex: 1,
      simulationTime: 0,
    },
  };
}
