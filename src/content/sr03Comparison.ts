/** Build-time preparation only. The client receives results from SR-03's existing scientific owner. */

import { ExperimentRuntimeError } from "../experiments/refusal.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import { fixedSr03ComparisonParameters } from "../experiments/sr03/comparison.ts";
import type { PreparedSr03Comparison } from "../experiments/sr03/comparisonSession.ts";
import {
  type EndpointPairChoice,
  SR03_DEFAULTS,
  type Sr03Parameters,
} from "../experiments/sr03/definition.ts";
import type { PreparedSr03Example } from "../experiments/sr03/session.ts";
import { evaluateSr03 } from "../workers/operations/sr03.ts";

const cases: readonly Readonly<{
  id: string;
  title: string;
  description: string;
  pair: EndpointPairChoice;
}>[] = [
  {
    id: "rod-readings",
    title: "The same two rod readings",
    pair: "platform-simultaneous",
    description:
      "A rod rests in K. Its two ends are read at one time of K. Keep those readings and ask how k describes them.",
  },
  {
    id: "timelike",
    title: "Events that a slower-than-light signal can connect",
    pair: "causal-timelike",
    description:
      "Keep a timelike pair fixed. Compare how much time passes in each frame and whether either observer reverses the event order.",
  },
  {
    id: "lightlike",
    title: "Events connected by light",
    pair: "causal-lightlike",
    description:
      "Keep a lightlike pair fixed. The coordinate differences change together; the squared interval remains zero.",
  },
  {
    id: "spacelike",
    title: "Events whose time order reverses",
    pair: "causal-threshold",
    description:
      "Keep a spacelike pair fixed. The two observers disagree on its time order, and no light signal can connect the events.",
  },
];

export async function prepareSr03Comparisons(
  sourceDigest: string,
): Promise<readonly PreparedSr03Comparison[]> {
  return Promise.all(
    cases.map(async (item) => {
      const prepare = (measuringFrame: "K" | "k") =>
        prepareSr03ComparisonExample(sourceDigest, {
          ...SR03_DEFAULTS,
          rodRestFrame: "K",
          endpointPairId: item.pair,
          measuringFrame,
        });
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        baseline: await prepare("K"),
        variant: await prepare("k"),
      };
    }),
  );
}

/** Prepare one side through the real owner, admitting only a complete fixed-pair result. */
export async function prepareSr03ComparisonExample(
  sourceDigest: string,
  input: Sr03Parameters,
): Promise<PreparedSr03Example> {
  const result = await evaluateSr03(input);
  if (result.kind !== "accepted")
    throw new ExperimentRuntimeError(
      "observer-comparison-preparation",
      "The worked observer comparison could not be calculated.",
      "sr-03",
    );
  return {
    sourceDigest,
    parameters: fixedSr03ComparisonParameters(input),
    results: result.data.outputs.map(encodeResult),
    stepIndex: result.data.stepIndex,
    simulationTime: result.data.simulationTime,
  };
}
