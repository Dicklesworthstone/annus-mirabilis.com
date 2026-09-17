import { createControlledComparison } from "../compare/controlledComparison.ts";
import {
  BM01_COMPARISON,
  bm01ComparisonIdentity,
  type PreparedBm01Comparison,
  verifyBm01Comparison,
} from "./comparison.ts";
import { createBm01Session } from "./session.ts";

/** Composes the existing session; no comparison-specific worker or numerical owner. */
export function createBm01ComparisonSession(
  instanceId: string,
  example: PreparedBm01Comparison,
  workerFactory: Parameters<typeof createBm01Session>[2],
) {
  const session = createBm01Session(instanceId, example.baseline, workerFactory);
  const staticVariant = createBm01Session(
    `${instanceId}-worked-variant`,
    example.doubledRadius,
    () => {
      throw new Error("A static worked result must never start a worker.");
    },
  );
  const baseline = session.getServerSnapshot().accepted;
  const variant = staticVariant.getServerSnapshot().accepted;
  if (!baseline || !variant) throw new Error("Completed worked comparisons are required.");
  return createControlledComparison(session, {
    contract: BM01_COMPARISON,
    identity: bm01ComparisonIdentity(example),
    baseline,
    variant,
    verifyAccepted: verifyBm01Comparison,
  });
}
