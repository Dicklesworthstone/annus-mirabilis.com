import { pinBaseline } from "../compare/Baseline.ts";
import { compareBaselines } from "../compare/compatibility.ts";
import { createControlledComparison } from "../compare/controlledComparison.ts";
import {
  ME03_COMPARISON,
  me03ComparisonIdentity,
  me03ComparisonParameters,
  refuseMe03Comparison,
  verifyMe03Comparison,
} from "./comparison.ts";
import type { Me03Parameters } from "./definition.ts";
import { createMe03Session } from "./session.ts";

/** Pin a separate owner so further exploration of the main ledger cannot replace this emission. */
export function createMe03ComparisonSession(
  instanceId: string,
  parameters: Me03Parameters,
  source: Readonly<{ sourceDigest: string }>,
) {
  const identity = me03ComparisonIdentity(source);
  const validated = me03ComparisonParameters(parameters);
  const owner = createMe03Session(instanceId, validated);
  const snapshot = owner.getSnapshot().accepted;
  if (!snapshot?.final)
    refuseMe03Comparison("The ledger owner could not accept the pinned emission.");
  const baseline = pinBaseline(
    snapshot,
    identity,
    ME03_COMPARISON.outputs.map(({ id }) => id),
  );
  const verification = verifyMe03Comparison(
    snapshot,
    snapshot,
    compareBaselines(baseline, baseline, ME03_COMPARISON),
  );
  if (verification) refuseMe03Comparison(verification);
  return createControlledComparison(
    {
      ...owner,
      stop() {
        // An explicit apply finishes synchronously; no background work exists to stop.
      },
      disconnect() {
        // The host calculation owns no worker or animation loop.
      },
    },
    {
      contract: ME03_COMPARISON,
      identity,
      baseline: snapshot,
      variant: snapshot,
      initialMessage: "Pinned accepted emission; both columns still use the same boundary.",
      verifyAccepted: verifyMe03Comparison,
    },
  );
}
