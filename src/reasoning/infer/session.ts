import type { ScientificResult } from "../../experiments/results/types.ts";
import {
  createInstanceStore,
  type OutputContract,
  type Parameters,
} from "../../experiments/store/instanceStore.ts";
import type { Assessment } from "../../physics/reference/inference.ts";
import { type InferenceEvidence, parseInferenceEvidence } from "./evidence.ts";
import {
  CAMERA_DEFAULTS,
  CAMERA_OUTPUTS,
  evaluateCamera,
  evaluateRadius,
  FAMILY_OUTPUTS,
  inferenceRefusal,
  RADIUS_DEFAULTS,
} from "./model.ts";

/** One immutable observation set per placement. Only the admitted information changes.
 * The bounded reductions run synchronously; there is no worker, RNG, or storage side effect.
 */
function createSession(
  instanceId: string,
  input: InferenceEvidence,
  initialParameters: Parameters,
  outputs: Readonly<Record<string, OutputContract>>,
  evaluate: (
    evidence: InferenceEvidence,
    parameters: unknown,
  ) => Assessment<readonly ScientificResult[]>,
) {
  const evidence = parseInferenceEvidence(input);
  const initial = evaluate(evidence, initialParameters);
  if (initial.kind !== "accepted")
    throw new TypeError("The built-in inference example could not be evaluated.");
  const store = createInstanceStore({
    experimentId: `infer-${evidence.kind}`,
    instanceId,
    initialParameters,
    allowPartial: true,
    parameterClasses: Object.fromEntries(
      Object.keys(initialParameters).map((key) => [key, "estimator" as const]),
    ),
    outputs,
  });
  const first = store.issue("setup-change");
  const publication = (data: readonly ScientificResult[]) => ({
    outputs: data,
    stepIndex: evidence.increments.length / evidence.d,
    simulationTime: (evidence.dt * evidence.increments.length) / evidence.d,
    final: true,
  });
  if (!store.publish({ ...first, ...publication(initial.data) }).accepted)
    throw new TypeError("The built-in inference result failed publication.");
  const serverSnapshot = store.getSnapshot();
  return Object.freeze({
    evidence,
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    apply(parameters: unknown) {
      const result = evaluate(evidence, parameters);
      if (result.kind !== "accepted") return result;
      // Both evaluators validate complete known scalar parameters before returning accepted.
      const token = store.issue("estimator-change", parameters as Parameters);
      if (!store.publish({ ...token, ...publication(result.data) }).accepted) {
        const refusal = inferenceRefusal(
          "The inference result could not be committed; the previous accepted result remains.",
        );
        if (refusal.kind === "refused") store.refuse(token, refusal.refusal);
        return refusal;
      }
      return { kind: "accepted" as const, data: store.getSnapshot() };
    },
  });
}
export function createRadiusSession(
  instanceId: string,
  evidence: InferenceEvidence,
  initial: Parameters = RADIUS_DEFAULTS,
) {
  return createSession(instanceId, evidence, initial, FAMILY_OUTPUTS, evaluateRadius);
}
export function createCameraInferenceSession(
  instanceId: string,
  evidence: InferenceEvidence,
  initial: Parameters = CAMERA_DEFAULTS,
) {
  return createSession(instanceId, evidence, initial, CAMERA_OUTPUTS, evaluateCamera);
}
