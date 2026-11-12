import { createControlledComparison } from "../compare/controlledComparison.ts";
import {
  BM08_COMPARISON,
  bm08ComparisonIdentity,
  requireBm08ComparisonExample,
  verifyBm08Comparison,
} from "./comparison.ts";
import { createBm08Session, type PreparedBm08Example } from "./session.ts";

/** One camera worker owns the recording. No second lab, generator or inferred reuse claim. */
export function createBm08ComparisonSession(
  instanceId: string,
  example: PreparedBm08Example,
  workerFactory: Parameters<typeof createBm08Session>[2],
) {
  const session = createBm08Session(instanceId, example, workerFactory, {
    // This instrument explicitly promises zero recomputation for a measurement comparison.
    // Keep its warm recording; ordinary laboratories may reconstruct and verify idle recordings.
    retention: null,
  });
  const baseline = requireBm08ComparisonExample(session.getServerSnapshot().accepted);
  const comparison = createControlledComparison(session, {
    contract: BM08_COMPARISON,
    identity: bm08ComparisonIdentity(example),
    baseline,
    variant: baseline,
    verifyAccepted: verifyBm08Comparison,
  });
  return Object.freeze({
    ...comparison,
    setSchedulingPaused: session.setSchedulingPaused,
  });
}
