import { createControlledComparison } from "../compare/controlledComparison.ts";
import { BM08_COMPARISON, requireBm08ComparisonExample, verifyBm08Comparison } from "./comparison.ts";
import { BM08_DRAFT_TAPE } from "./draftTape.ts";
import { createBm08Session, type PreparedBm08Example } from "./session.ts";

/** One camera worker owns the recording. No second lab, generator or inferred reuse claim. */
export function createBm08ComparisonSession(
  instanceId: string,
  example: PreparedBm08Example,
  workerFactory: Parameters<typeof createBm08Session>[2],
) {
  const session = createBm08Session(instanceId, example, workerFactory);
  const baseline = requireBm08ComparisonExample(session.getServerSnapshot().accepted);
  const model = BM08_DRAFT_TAPE.environment;
  return createControlledComparison(session, {
    contract: BM08_COMPARISON,
    identity: Object.freeze({
      modelVersion: `${model.modelId}@${model.modelVersion}`,
      constantSetId: model.constantSetId,
      streamVersion: String(model.streamVersion),
      allocationId: model.allocationId,
      sourceDigest: example.sourceDigest,
      artifactDigest: null,
      executionLabel: "host-calculation",
    }),
    baseline,
    variant: baseline,
    verifyAccepted: verifyBm08Comparison,
  });
}
