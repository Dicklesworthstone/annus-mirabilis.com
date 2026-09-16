/**
 * Two-model fixture experiment (am-rt-command-classes-dzp requirement 10).
 *
 * "a fixture experiment declaring two admitted models of one effect, used to exercise
 * requirement 10 without waiting for BM-06... selecting the second declared model dispatches
 * class: 'setup-change', increments inputRevision, creates a new runId whose parentRunId is
 * the previous run, restarts stepIndex at 0, and leaves the previous run retrievable by id
 * from the instance history and present on the tape; the command writes no fallbackReason and
 * an engine fallback writes no modelChoice... changing the drawn particle count on the same
 * fixture keeps runId and modelId and touches no digest; and a scan asserts the controller
 * exports no comparator or ranking over models[]."
 */
import {
  createInstanceStore,
  type ParameterClass,
  type Parameters,
} from "../../experiments/store/instanceStore.ts";

export const TWO_MODEL_DECLARED_MODELS = Object.freeze(["exact-propagator", "ftcs-grid"] as const);

export type TwoModelId = (typeof TWO_MODEL_DECLARED_MODELS)[number];

export const TWO_MODEL_INITIAL_PARAMETERS: Parameters = Object.freeze({
  diffusionCoefficient: 4.29e-13,
  modelId: "exact-propagator",
  particleCount: 200,
});

export const TWO_MODEL_PARAMETER_CLASSES: Readonly<Record<string, ParameterClass>> = Object.freeze({
  diffusionCoefficient: "input",
  modelId: "input", // Selecting an admitted model is a setup-change!
  particleCount: "presentation", // Particle count rendering detail is presentation
});

export function createTwoModelFixtureStore(instanceId = "inst-two-model-fixture") {
  return createInstanceStore({
    experimentId: "fixture-two-model",
    instanceId,
    initialParameters: TWO_MODEL_INITIAL_PARAMETERS,
    parameterClasses: TWO_MODEL_PARAMETER_CLASSES,
    outputs: {
      concentration: {
        statuses: ["value"],
        unit: "mol/m^3",
        semanticKind: "distribution",
        ownerId: "fixture-two-model",
      },
    },
  });
}
