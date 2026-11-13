import { decodeLabResponse, SR03_PROTOCOL } from "../../workers/protocol/sr03.ts";
import { createControlledComparison } from "../compare/controlledComparison.ts";
import { singleVariationLock } from "../compare/singleVariationLock.ts";
import { ExperimentRuntimeError } from "../refusal.ts";
import { parseResult } from "../results/codec.ts";
import {
  createInstanceStore,
  type Parameters as ExperimentParameters,
} from "../store/instanceStore.ts";
import {
  fixedSr03ComparisonParameters,
  SR03_COMPARISON,
  sr03ComparisonIdentity,
  verifySr03Comparison,
} from "./comparison.ts";
import { SR03_OUTPUTS, SR03_PARAMETER_CLASSES } from "./definition.ts";
import { createSr03Session, type PreparedSr03Example } from "./session.ts";

export type PreparedSr03Comparison = Readonly<{
  id: string;
  title: string;
  description: string;
  baseline: PreparedSr03Example;
  variant: PreparedSr03Example;
}>;

/** Publish the two real worked evaluations through the normal identity and output contracts. */
function workedSnapshots(instanceId: string, example: PreparedSr03Comparison) {
  const baselineParameters = fixedSr03ComparisonParameters(example.baseline.parameters);
  const variantParameters = fixedSr03ComparisonParameters(example.variant.parameters);
  if (example.baseline.sourceDigest !== example.variant.sourceDigest)
    throw new ExperimentRuntimeError(
      "observer-comparison-source",
      "Both examples must use the same evaluator.",
      "sr-03",
    );
  const variation = singleVariationLock(
    baselineParameters as unknown as ExperimentParameters,
    variantParameters as unknown as ExperimentParameters,
    SR03_COMPARISON,
  );
  if (variation.kind !== "accepted")
    throw new ExperimentRuntimeError("observer-comparison-settings", variation.message, "sr-03");
  const store = createInstanceStore({
    experimentId: "sr-03",
    instanceId: `${instanceId}-worked`,
    initialParameters: baselineParameters as unknown as ExperimentParameters,
    parameterClasses: SR03_PARAMETER_CLASSES,
    outputs: SR03_OUTPUTS,
    allowPartial: true,
  });
  const publish = (prepared: PreparedSr03Example, token: ReturnType<typeof store.issue>) => {
    const response = decodeLabResponse(
      {
        messageKind: "result",
        protocolVersion: SR03_PROTOCOL,
        sourceDigest: prepared.sourceDigest,
        token,
        result: {
          kind: "accepted",
          data: {
            outputs: prepared.results.map(parseResult),
            stepIndex: prepared.stepIndex,
            simulationTime: prepared.simulationTime,
          },
        },
      },
      token,
      example.baseline.sourceDigest,
    );
    const publication =
      response.result.kind === "accepted"
        ? store.publish({ ...token, ...response.result.data, final: true })
        : null;
    const snapshot = store.getSnapshot().accepted;
    if (!publication?.accepted || !snapshot)
      throw new ExperimentRuntimeError(
        "observer-comparison-example",
        "The prepared observer comparison is invalid.",
        "sr-03",
      );
    return snapshot;
  };
  const baseline = publish(example.baseline, store.issue("setup-change"));
  // The complete records were compared above; the store receives only the observer patch.
  const variant = publish(
    example.variant,
    store.issue("observer-change", { measuringFrame: variantParameters.measuringFrame }),
  );
  return { baseline, variant };
}

/** A single SR-03 worker owns the live comparison; no worker is constructed by a worked example. */
export function createSr03ComparisonSession(
  instanceId: string,
  example: PreparedSr03Comparison,
  workerFactory: Parameters<typeof createSr03Session>[2],
) {
  const worked = workedSnapshots(instanceId, example);
  const session = createSr03Session(instanceId, example.baseline, workerFactory);
  const comparison = createControlledComparison(session, {
    contract: SR03_COMPARISON,
    identity: sr03ComparisonIdentity(example.baseline),
    ...worked,
    verifyAccepted: verifySr03Comparison,
  });
  const problem = verifySr03Comparison(
    worked.baseline,
    worked.variant,
    comparison.getSnapshot().result,
  );
  if (problem) throw new ExperimentRuntimeError("observer-comparison-example", problem, "sr-03");
  return Object.freeze({ ...comparison, setSchedulingPaused: session.setSchedulingPaused });
}
