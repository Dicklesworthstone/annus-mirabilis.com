import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import {
  collectorSweep,
  type PhotoelectricResult,
  photocurrent,
  stoppingPotentialFromEv,
} from "../../physics/reference/photoelectric.ts";
import type { AcceptedSnapshot } from "../store/instanceStore.ts";
import { LQ08_MODEL, type Lq08Distribution, type Lq08Parameters } from "./definition.ts";

export type Lq08CurrentSample = Readonly<{
  collectorPotential: number;
  result: PhotoelectricResult<number>;
}>;

/** Potentials are volts and currents are amperes. Open endpoints are one-sided limits. */
export type Lq08CollectorSweep = Readonly<{
  instanceId: string;
  runId: string;
  snapshotVersion: number;
  actionIndex: number;
  ownerId: "photoelectric.collectorSweep";
  constantSetId: string;
  distributionModel: Lq08Distribution;
  domain: Readonly<{ min: number; max: number }>;
  saturationCurrent: number;
  operatingPoint: Lq08CurrentSample;
  samples: readonly Lq08CurrentSample[];
  segments: readonly Readonly<{
    points: readonly Readonly<{ collectorPotential: number; current: number }>[];
    startIncluded: boolean;
    endIncluded: boolean;
  }>[];
  underdetermined: readonly Readonly<{
    minPotential: number;
    maxPotential: number;
    lowerCurrent: number;
    upperCurrent: number;
    includeMin: boolean;
    includeMax: boolean;
  }>[];
}>;

function frozenResult(result: PhotoelectricResult<number>): PhotoelectricResult<number> {
  if (result.status !== "underdetermined") return result;
  return Object.freeze({
    ...result,
    ...(result.bounds
      ? { bounds: Object.freeze([...result.bounds]) as readonly [number, number] }
      : {}),
  });
}

/**
 * An accepted owner's curve, including the model's discontinuities and missing information.
 * Every ordinate and enclosure comes from the photoelectric reference evaluator. The segment
 * topology names its declared regimes; it never interpolates a guessed retarding current.
 */
export function acceptedLq08CollectorSweep(
  accepted: AcceptedSnapshot,
  parameters: Lq08Parameters,
): Lq08CollectorSweep | null {
  const constants = getConstantSet(LQ08_MODEL.constantSetId);
  const workFunctionJoules =
    parameters.workFunction * constantValue(constants, "elementaryCharge").value;
  const at = (collectorPotential: number): Lq08CurrentSample =>
    Object.freeze({
      collectorPotential,
      result: frozenResult(
        photocurrent(
          parameters.incidentPower,
          parameters.frequency,
          workFunctionJoules,
          parameters.quantumEfficiency,
          collectorPotential,
          constants,
          parameters.distributionModel,
        ),
      ),
    });
  const stopping = stoppingPotentialFromEv(
    parameters.frequency,
    parameters.workFunction,
    constants,
  );
  const saturation = at(0);
  if (saturation.result.status !== "value") return null;
  const saturationCurrent = saturation.result.value;
  const cutoff = stopping.status === "value" ? -stopping.value : 0;
  const domain = Object.freeze({
    min: Math.min(-3, parameters.collectorPotential, cutoff),
    max: Math.max(3, parameters.collectorPotential),
  });
  const zeroSide = at(domain.min);
  if (zeroSide.result.status !== "value") return null;
  const zeroCurrent = zeroSide.result.value;
  const sampled = collectorSweep(
    parameters.incidentPower,
    parameters.frequency,
    workFunctionJoules,
    parameters.quantumEfficiency,
    { ...domain, steps: 61 },
    constants,
    parameters.distributionModel,
  );
  // Exact regime boundaries and the actual operating point accompany the bounded regular grid.
  const sampleMap = new Map<number, Lq08CurrentSample>(
    sampled.map((sample) => [
      sample.collectorPotential,
      Object.freeze({ ...sample, result: frozenResult(sample.result) }),
    ]),
  );
  for (const potential of [cutoff, 0, parameters.collectorPotential]) {
    sampleMap.set(potential, at(potential));
  }
  const samples = Object.freeze(
    [...sampleMap.values()].sort((a, b) => a.collectorPotential - b.collectorPotential),
  );
  const point = (collectorPotential: number, current: number) =>
    Object.freeze({ collectorPotential, current });
  const segment = (
    points: readonly Readonly<{ collectorPotential: number; current: number }>[],
    startIncluded = true,
    endIncluded = true,
  ) => Object.freeze({ points: Object.freeze([...points]), startIncluded, endIncluded });
  const segments: Lq08CollectorSweep["segments"][number][] = [];
  const underdetermined: Lq08CollectorSweep["underdetermined"][number][] = [];

  if (saturationCurrent === 0) {
    // No incident quanta or no emission: this is the owner's exact zero, not a missing value.
    segments.push(segment([point(domain.min, zeroCurrent), point(domain.max, saturationCurrent)]));
  } else if (cutoff === 0) {
    // At the threshold the ideal collection rule has a jump at zero bias.
    segments.push(segment([point(domain.min, zeroCurrent), point(0, zeroCurrent)], true, false));
    segments.push(segment([point(0, saturationCurrent), point(domain.max, saturationCurrent)]));
  } else if (parameters.distributionModel === "all-at-kmax") {
    segments.push(segment([point(domain.min, zeroCurrent), point(cutoff, zeroCurrent)]));
    segments.push(
      segment([point(cutoff, saturationCurrent), point(domain.max, saturationCurrent)], false),
    );
  } else if (parameters.distributionModel === "uniform") {
    const points = samples.flatMap((sample) =>
      sample.result.status === "value"
        ? [point(sample.collectorPotential, sample.result.value)]
        : [],
    );
    // A uniform declared distribution determines every sample, including the exact corners.
    if (points.length !== samples.length) return null;
    segments.push(segment(points));
  } else {
    const interior = at(cutoff / 2).result;
    if (interior.status !== "underdetermined" || !interior.bounds) return null;
    segments.push(segment([point(domain.min, zeroCurrent), point(cutoff, zeroCurrent)]));
    segments.push(segment([point(0, saturationCurrent), point(domain.max, saturationCurrent)]));
    underdetermined.push(
      Object.freeze({
        minPotential: cutoff,
        maxPotential: 0,
        lowerCurrent: interior.bounds[0],
        upperCurrent: interior.bounds[1],
        includeMin: false,
        includeMax: false,
      }),
    );
  }

  return Object.freeze({
    instanceId: accepted.instanceId,
    runId: accepted.runId,
    snapshotVersion: accepted.snapshotVersion,
    actionIndex: accepted.actionIndex,
    ownerId: "photoelectric.collectorSweep",
    constantSetId: LQ08_MODEL.constantSetId,
    distributionModel: parameters.distributionModel,
    domain,
    saturationCurrent,
    operatingPoint: at(parameters.collectorPotential),
    samples,
    segments: Object.freeze(segments),
    underdetermined: Object.freeze(underdetermined),
  });
}
