/**
 * SR-04 session: evaluates the real kinematics owner (src/physics/reference/kinematics.ts,
 * am-ref-kinematics-tjq). Synchronous, closed-form host physics: no worker, matching
 * src/experiments/bm03/session.ts's pattern.
 *
 * NO CIRCULARITY (am-sr-04-lorentz-map-px1k): gamma, the matrix, eigenvalues, and rapidity are
 * computed here only for the later-aid panel, never fed into solveCandidateFamily/
 * checkCandidateMap as an input and never used to justify a construction step. The engine
 * (src/physics/reference/kinematics/constraints.ts) itself "does not import gamma or any
 * Lorentz-factor helper" (its own header comment) -- this module preserves that boundary by
 * calling it with only v and the reader's enabled constraints/candidate, and by computing the
 * later aids as a SEPARATE, clearly labeled branch that the construction result never reads.
 */
import {
  boostMatrixXT,
  type CandidateMap,
  type ConstraintSolve,
  galileanRelativisticVelocityDifference,
  galileanVelocity,
  gamma,
  type KinematicResult,
  rapidity,
  solveCandidateFamily,
  speedOfLightMetresPerSecond,
} from "../../physics/reference/kinematics.ts";
import type { ScientificResult } from "../results/types.ts";
import { createCalculationSession, rejectCalculation } from "../store/calculationSession.ts";
import {
  ALL_CONSTRAINTS,
  SR04_CLASSES,
  SR04_DEFAULTS,
  SR04_OUTPUTS,
  type Sr04Parameters,
  splitConstraints,
} from "./definition.ts";
import { validateSr04Parameters } from "./parameters.ts";

export type LaterAids = Readonly<{
  matrix: KinematicResult<number[][]>;
  /** gamma(1 -+ beta): the two eigenvalues on the light lines, a DERIVED later-aid fact, never
   * an input to the constraint engine. */
  eigenvalues: readonly [number, number] | null;
  rapidityValue: KinematicResult<number>;
  gammaValue: KinematicResult<number>;
}>;

export type Sr04Evaluation = Readonly<{
  v: number;
  family: ConstraintSolve;
  slowCaseGalilean: KinematicResult<number>;
  slowCaseDeviation: KinematicResult<Readonly<{ difference: number; relativeSize: number }>>;
  rightRayFraction: KinematicResult<number>;
  leftRayFraction: KinematicResult<number>;
  laterAids: LaterAids;
}>;

export function evaluateSr04(p: Sr04Parameters): Sr04Evaluation {
  const c = speedOfLightMetresPerSecond();
  const v = p.vOverC * c;
  const candidate: CandidateMap | undefined = p.testCandidate
    ? {
        a: p.candidateA,
        b: p.candidateB,
        d: p.candidateD,
        transverseScale: p.candidateTransverseScale,
      }
    : undefined;
  const family = solveCandidateFamily({
    v,
    enabledConstraints: splitConstraints(p.enabledConstraints),
    ...(candidate ? { candidate } : {}),
  });

  const slowCaseGalilean = galileanVelocity(p.objectSpeed, p.observerSpeed);
  const slowCaseDeviation = galileanRelativisticVelocityDifference(
    p.objectSpeed,
    p.observerSpeed,
    c,
  );
  const rightRay = galileanVelocity(c, v);
  const leftRay = galileanVelocity(-c, v);
  const rightRayFraction =
    rightRay.status === "value"
      ? { status: "value" as const, value: rightRay.value / c }
      : rightRay;
  const leftRayFraction =
    leftRay.status === "value" ? { status: "value" as const, value: leftRay.value / c } : leftRay;

  const gammaValue = gamma(p.vOverC);
  const rapidityValue = rapidity(p.vOverC);
  const matrix = boostMatrixXT(p.vOverC, c);
  const eigenvalues: readonly [number, number] | null =
    gammaValue.status === "value"
      ? [gammaValue.value * (1 - p.vOverC), gammaValue.value * (1 + p.vOverC)]
      : null;

  return Object.freeze({
    v,
    family,
    slowCaseGalilean,
    slowCaseDeviation,
    rightRayFraction,
    leftRayFraction,
    laterAids: Object.freeze({ matrix, eigenvalues, rapidityValue, gammaValue }),
  });
}

export type PreparedSr04Example = Readonly<{
  parameters: Sr04Parameters;
  evaluation: Sr04Evaluation;
  sourceDigest: string;
}>;

function outputIdentity(quantityId: string) {
  const contract = SR04_OUTPUTS[quantityId];
  if (!contract) rejectCalculation(`SR-04: unknown output ${quantityId}.`);
  return {
    quantityId,
    unit: contract.unit,
    semanticKind: contract.semanticKind,
    ownerId: contract.ownerId,
  };
}

function result(quantityId: string, value: KinematicResult<number>): ScientificResult {
  const identity = outputIdentity(quantityId);
  if (value.status === "value") {
    if (!Number.isFinite(value.value))
      rejectCalculation(`SR-04 ${quantityId}: the owner returned a non-finite value.`);
    return { ...identity, status: "value", value: value.value };
  }
  return {
    ...identity,
    status: "outside-domain",
    condition: value.condition,
    domainKind: value.domainKind,
    reason: value.reason,
    boundary: { alternativeModel: "Choose inputs within the stated domain." },
  };
}

/** The strict publication and the detailed readout project one accepted owner evaluation. */
function snapshotOutputs(evaluation: Sr04Evaluation): readonly ScientificResult[] {
  const family = evaluation.family;
  const c = speedOfLightMetresPerSecond();
  let constraintFamily: ScientificResult;
  if (family.status === "value") {
    // Coefficients of x'/c = a(x/c - beta*t), t' = b*t + (c*d)(x/c), all dimensionless.
    // The transverse scale is deliberately absent: a longitudinal solution does not fix it.
    constraintFamily = {
      ...outputIdentity("constraintFamily"),
      status: "value",
      value: Float64Array.of(family.value.a, family.value.b, c * family.value.d),
    };
  } else if (family.status === "underdetermined") {
    constraintFamily = {
      ...outputIdentity("constraintFamily"),
      status: "underdetermined",
      compatibleFamily: family.compatibleFamily,
      neededInformation: family.neededInformation,
    };
  } else if (family.status === "outside-domain") {
    constraintFamily = result("constraintFamily", family);
  } else {
    constraintFamily = {
      ...outputIdentity("constraintFamily"),
      status: "not-applicable",
      reason:
        "This reading tests a particular candidate. Enable construction requirements to infer an admissible family.",
    };
  }

  let candidateResiduals: ScientificResult;
  if (family.status === "residual-report") {
    // Keep the declared unit honest: light residuals arrive in m/s; every other residual is
    // dimensionless. The displayed table keeps the owner's original units and values.
    const residuals = ALL_CONSTRAINTS.map((constraint) => {
      const value = family.residuals[constraint];
      if (value === undefined || !Number.isFinite(value))
        rejectCalculation(`SR-04 ${constraint}: the candidate has no finite residual.`);
      return constraint === "right-moving-light" || constraint === "left-moving-light"
        ? value / c
        : value;
    });
    candidateResiduals = {
      ...outputIdentity("candidateResiduals"),
      status: "value",
      value: Float64Array.from(residuals),
    };
  } else {
    candidateResiduals = {
      ...outputIdentity("candidateResiduals"),
      status: "not-applicable",
      reason:
        "The construction describes a family. Test a particular candidate to read its residuals.",
    };
  }

  const deviation = evaluation.slowCaseDeviation;
  return [
    constraintFamily,
    candidateResiduals,
    result("slowCaseGalilean", evaluation.slowCaseGalilean),
    result(
      "slowCaseDeviation",
      deviation.status === "value"
        ? { status: "value", value: deviation.value.difference }
        : deviation,
    ),
    result("rightRayFraction", evaluation.rightRayFraction),
    result("leftRayFraction", evaluation.leftRayFraction),
    result("lorentzFactor", evaluation.laterAids.gammaValue),
    result("rapidity", evaluation.laterAids.rapidityValue),
  ];
}

export function createSr04Session(
  instanceId = "sr04-default",
  initialParameters: Sr04Parameters = SR04_DEFAULTS,
) {
  const session = createCalculationSession({
    experimentId: "sr-04",
    instanceId,
    initialParameters,
    parameterClasses: SR04_CLASSES,
    outputs: SR04_OUTPUTS,
    validate: validateSr04Parameters,
    evaluate: evaluateSr04,
    results: snapshotOutputs,
  });
  const initialView = session.getServerSnapshot();
  if (!initialView.accepted) rejectCalculation("SR-04: no accepted initial calculation.");
  const serverSnapshot = Object.freeze({ ...initialView, accepted: initialView.accepted });
  return Object.freeze({
    ...session,
    getServerSnapshot: () => serverSnapshot,
    defaults: SR04_DEFAULTS,
  });
}
