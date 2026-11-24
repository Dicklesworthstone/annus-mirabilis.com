import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import {
  kMax,
  type PhotoelectricResult,
  stoppingPotentialFromEv,
  thresholdFrequencyFromEv,
} from "../../physics/reference/photoelectric.ts";
import type { AcceptedSnapshot } from "../store/instanceStore.ts";
import { LQ08_MODEL, type Lq08Parameters, type Lq08TransferModel } from "./definition.ts";

export type Lq08StoppingSample = Readonly<{
  frequency: number;
  result: PhotoelectricResult<number>;
}>;

/** Raw accepted reference results: energy in joules, stopping magnitudes in volts. */
export type Lq08EnergyBudget = Readonly<{
  instanceId: string;
  runId: string;
  snapshotVersion: number;
  actionIndex: number;
  constantSetId: string;
  transferModel: Lq08TransferModel;
  owners: Readonly<{
    maxKineticEnergy: "photoelectric.kMax";
    stoppingPotentialMagnitude: "photoelectric.stoppingPotentialMagnitude";
  }>;
  maxKineticEnergy: PhotoelectricResult<number>;
  stoppingPotentialMagnitude: PhotoelectricResult<number>;
  stoppingSweep: Readonly<{
    domain: Readonly<{ min: number; max: number }>;
    samples: readonly Lq08StoppingSample[];
  }>;
}>;

/** The reference's enclosure is data, not mutable drawing state. */
export function frozenPhotoelectricResult(
  result: PhotoelectricResult<number>,
): PhotoelectricResult<number> {
  if (result.status !== "underdetermined") return result;
  return Object.freeze({
    ...result,
    ...(result.bounds
      ? { bounds: Object.freeze([...result.bounds]) as readonly [number, number] }
      : {}),
  });
}

/**
 * An unspecified transfer fraction supplies upper bounds, not an attained electron energy.
 * The frequency sweep retains those same statuses at every point. Phi/h is only a necessary
 * energy-budget threshold in partial mode, never a claimed measured emission onset.
 */
export function acceptedLq08EnergyBudget(
  accepted: AcceptedSnapshot,
  parameters: Lq08Parameters,
): Lq08EnergyBudget {
  const constants = getConstantSet(LQ08_MODEL.constantSetId);
  const workFunctionJoules =
    parameters.workFunction * constantValue(constants, "elementaryCharge").value;
  const maxKineticEnergy = frozenPhotoelectricResult(
    kMax(parameters.frequency, workFunctionJoules, constants, parameters.transferModel),
  );
  const stoppingAt = (frequency: number) =>
    frozenPhotoelectricResult(
      stoppingPotentialFromEv(
        frequency,
        parameters.workFunction,
        constants,
        parameters.transferModel,
      ),
    );
  const threshold = thresholdFrequencyFromEv(parameters.workFunction, constants);
  const necessaryFrequency = threshold.status === "value" ? threshold.value : null;
  const positiveThreshold =
    necessaryFrequency !== null && necessaryFrequency > 0 ? necessaryFrequency : null;
  const domain = Object.freeze({
    min: Math.min(4e14, parameters.frequency, positiveThreshold ?? 4e14),
    max: Math.max(1.2e15, parameters.frequency, positiveThreshold ?? 1.2e15),
  });
  const frequencies = new Set(
    Array.from({ length: 61 }, (_, index) => domain.min + ((domain.max - domain.min) * index) / 60),
  );
  frequencies.add(parameters.frequency);
  if (positiveThreshold !== null) frequencies.add(positiveThreshold);
  const samples = Object.freeze(
    [...frequencies]
      .sort((a, b) => a - b)
      .map((frequency) => Object.freeze({ frequency, result: stoppingAt(frequency) })),
  );
  return Object.freeze({
    instanceId: accepted.instanceId,
    runId: accepted.runId,
    snapshotVersion: accepted.snapshotVersion,
    actionIndex: accepted.actionIndex,
    constantSetId: LQ08_MODEL.constantSetId,
    transferModel: parameters.transferModel,
    owners: Object.freeze({
      maxKineticEnergy: "photoelectric.kMax",
      stoppingPotentialMagnitude: "photoelectric.stoppingPotentialMagnitude",
    }),
    maxKineticEnergy,
    stoppingPotentialMagnitude: stoppingAt(parameters.frequency),
    stoppingSweep: Object.freeze({ domain, samples }),
  });
}
