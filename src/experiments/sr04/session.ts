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
import type {
  AcceptedSnapshot,
  ExperimentView,
  PublishedResult,
  RequestToken,
} from "../store/instanceStore.ts";
import { SR04_DEFAULTS, type Sr04Parameters, splitConstraints } from "./definition.ts";
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

function toPublished(
  id: string,
  unit: string,
  semanticKind: string,
  ownerId: string,
  result: KinematicResult<number>,
): PublishedResult {
  if (result.status === "value") {
    return { quantityId: id, unit, semanticKind, ownerId, status: "value", value: result.value };
  }
  return {
    quantityId: id,
    unit,
    semanticKind,
    ownerId,
    status: "outside-domain",
    condition: result.condition,
    domainKind: result.domainKind,
    reason: result.reason,
    boundary: { alternativeModel: "Choose inputs within the stated domain." },
  };
}

export function buildSr04Snapshot(
  instanceId: string,
  runId: string,
  parameters: Sr04Parameters,
  inputRevision = 1,
  actionIndex = 0,
): AcceptedSnapshot {
  const evaluation = evaluateSr04(parameters);
  const outputs: PublishedResult[] = [
    toPublished(
      "slowCaseGalilean",
      "m/s",
      "galilean-composed-velocity",
      "kinematics.galileanVelocity",
      evaluation.slowCaseGalilean,
    ),
    toPublished(
      "rightRayFraction",
      "1",
      "galilean-transformed-light-speed-fraction",
      "kinematics.galileanVelocity",
      evaluation.rightRayFraction,
    ),
    toPublished(
      "leftRayFraction",
      "1",
      "galilean-transformed-light-speed-fraction",
      "kinematics.galileanVelocity",
      evaluation.leftRayFraction,
    ),
    toPublished(
      "lorentzFactor",
      "1",
      "lorentz-factor",
      "kinematics.gamma",
      evaluation.laterAids.gammaValue,
    ),
    toPublished(
      "rapidity",
      "1",
      "rapidity",
      "kinematics.rapidity",
      evaluation.laterAids.rapidityValue,
    ),
  ];
  return Object.freeze({
    experimentId: "sr-04",
    instanceId,
    runId,
    parentRunId: null,
    actionIndex,
    revisions: { input: inputRevision, observer: 0, measurement: 0, estimator: 0 },
    parameters: Object.freeze({ ...parameters }),
    stepIndex: 0,
    simulationTime: 0,
    final: true,
    snapshotVersion: inputRevision,
    outputs: Object.freeze(outputs),
  });
}

export function createSr04Session(
  instanceId = "sr04-default",
  initialParameters: Sr04Parameters = SR04_DEFAULTS,
) {
  let currentParams = { ...initialParameters };
  let currentRunId = `run-${Date.now()}`;
  let inputRevision = 1;
  let actionIndex = 0;
  let acceptedSnapshot = buildSr04Snapshot(
    instanceId,
    currentRunId,
    currentParams,
    inputRevision,
    actionIndex,
  );

  const listeners = new Set<() => void>();
  function notify() {
    for (const listener of listeners) listener();
  }

  let view: ExperimentView = {
    status: "accepted",
    pending: false,
    requested: {
      experimentId: "sr-04",
      instanceId,
      runId: currentRunId,
      parentRunId: null,
      actionIndex,
      revisions: { input: inputRevision, observer: 0, measurement: 0, estimator: 0 },
      parameters: currentParams,
    } as RequestToken,
    accepted: acceptedSnapshot,
    refusal: null,
    outcome: null,
  };

  return {
    subscribe(callback: () => void) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    getSnapshot(): ExperimentView {
      return view;
    },
    getServerSnapshot(): ExperimentView {
      return view;
    },
    acceptedParameters(): Sr04Parameters {
      return currentParams;
    },
    apply(parameters: unknown) {
      const validated = validateSr04Parameters(parameters);
      if (validated.kind !== "accepted") {
        if (validated.kind === "refused") {
          view = { ...view, status: "refused", refusal: validated.refusal };
          notify();
        }
        return validated;
      }
      actionIndex++;
      const isSetupChange =
        currentParams.vOverC !== validated.data.vOverC ||
        currentParams.candidateA !== validated.data.candidateA ||
        currentParams.candidateB !== validated.data.candidateB ||
        currentParams.candidateD !== validated.data.candidateD;
      if (isSetupChange) {
        inputRevision++;
        currentRunId = `run-${Date.now()}-${actionIndex}`;
      }
      currentParams = { ...validated.data };
      acceptedSnapshot = buildSr04Snapshot(
        instanceId,
        currentRunId,
        currentParams,
        inputRevision,
        actionIndex,
      );
      view = {
        status: "accepted",
        pending: false,
        requested: {
          experimentId: "sr-04",
          instanceId,
          runId: currentRunId,
          parentRunId: null,
          actionIndex,
          revisions: { input: inputRevision, observer: 0, measurement: 0, estimator: 0 },
          parameters: currentParams,
        } as RequestToken,
        accepted: acceptedSnapshot,
        refusal: null,
        outcome: null,
      };
      notify();
      return { kind: "accepted" as const, data: currentParams };
    },
    stop() {
      // Synchronous calculation, no-op.
    },
    disconnect() {
      listeners.clear();
    },
    defaults: SR04_DEFAULTS,
  };
}
