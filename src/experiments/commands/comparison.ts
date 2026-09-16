/**
 * Baseline and variant comparison support (am-rt-command-classes-dzp requirement 9).
 *
 * "The controller can pin a baseline snapshot and apply exactly one command of a declared
 * class to a variant. A variant from a description class (observer, measurement, estimator,
 * presentation) shares the baseline's runId and latent data. A variant from a physical
 * class is a new identified run with baselineRunId; when it reuses the baseline seed it is
 * labeled 'same random numbers, different setup' (common random numbers), never 'independent
 * trials'. The comparison reports what remained fixed, what changed physically, and what was
 * merely re-described."
 */
import type { ExecutionStateSnapshot } from "./invariants.ts";
import type { CommandClass, TypedCommand } from "./types.ts";

export type ComparisonTrialRelation =
  | "same-description"
  | "re-described-same-world"
  | "common-random-numbers"
  | "independent-trials";

export type ExperimentComparisonReport = Readonly<{
  baselineRunId: string;
  variantRunId: string;
  commandClass: CommandClass;
  trialRelation: ComparisonTrialRelation;
  randomnessLabel: string;
  whatRemainedFixed: readonly string[];
  whatChangedPhysically: readonly string[];
  whatWasRedescribed: readonly string[];
  isDescriptionClass: boolean;
  sharesLatentData: boolean;
}>;

export interface CompareOptions {
  readonly baselineSeed?: string | undefined;
  readonly variantSeed?: string | undefined;
}

const DESCRIPTION_CLASSES: ReadonlySet<CommandClass> = new Set([
  "observer-change",
  "measurement-change",
  "estimator-change",
  "presentation-change",
]);

/**
 * Generates an honest comparison report between a baseline and a variant.
 */
export function compareBaselineAndVariant(
  baseline: ExecutionStateSnapshot,
  variant: ExecutionStateSnapshot,
  command: TypedCommand,
  options?: CompareOptions,
): ExperimentComparisonReport {
  const isDescription = DESCRIPTION_CLASSES.has(command.class);

  const whatRemainedFixed: string[] = [];
  const whatChangedPhysically: string[] = [];
  const whatWasRedescribed: string[] = [];

  let trialRelation: ComparisonTrialRelation;
  let randomnessLabel: string;

  if (isDescription) {
    trialRelation = "re-described-same-world";
    randomnessLabel = "same world, re-described";

    whatRemainedFixed.push(
      "runId",
      "latentTrajectory",
      "eventsAndWorldlines",
      "inputRevision",
      "governingModel",
    );

    switch (command.class) {
      case "observer-change":
        whatWasRedescribed.push("coordinateFrame", "observerPerspective", "derivedCoordinates");
        break;
      case "measurement-change":
        whatWasRedescribed.push("observationCadence", "exposureOrNoiseModel", "samplingCadence");
        break;
      case "estimator-change":
        whatWasRedescribed.push("estimatorStatistic", "inferenceAssumptions");
        break;
      case "presentation-change":
        whatWasRedescribed.push("cameraView", "colorMap", "visualLabels", "renderDetail");
        break;
    }
  } else {
    // Physical class (setup-change or physical-intervention)
    const isSameSeed =
      options?.baselineSeed !== undefined &&
      options?.variantSeed !== undefined &&
      options.baselineSeed === options.variantSeed;

    if (isSameSeed) {
      trialRelation = "common-random-numbers";
      randomnessLabel = "same random numbers, different setup";
    } else {
      trialRelation = "independent-trials";
      randomnessLabel = "independent trials";
    }

    if (command.class === "setup-change") {
      whatChangedPhysically.push("initialConditions", "governingModel", "runId");
      if (baseline.modelId !== variant.modelId) {
        whatChangedPhysically.push(`modelSwitched:${baseline.modelId}->${variant.modelId}`);
      }
      whatRemainedFixed.push("experimentCatalogueIdentity");
    } else if (command.class === "physical-intervention") {
      whatChangedPhysically.push(
        "intervenedPhysicalParameters",
        `atSimulatedTime:${(command.payload as { atSimulatedTime: number }).atSimulatedTime}`,
      );
      whatRemainedFixed.push("priorAcceptedHistoryBeforeIntervention");
    }
  }

  return Object.freeze({
    baselineRunId: baseline.runId,
    variantRunId: variant.runId,
    commandClass: command.class,
    trialRelation,
    randomnessLabel,
    whatRemainedFixed: Object.freeze(whatRemainedFixed),
    whatChangedPhysically: Object.freeze(whatChangedPhysically),
    whatWasRedescribed: Object.freeze(whatWasRedescribed),
    isDescriptionClass: isDescription,
    sharesLatentData: isDescription,
  });
}
