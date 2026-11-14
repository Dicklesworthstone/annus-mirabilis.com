import { pinBaseline } from "../compare/Baseline.ts";
import { compareBaselines } from "../compare/compatibility.ts";
import { createControlledComparison } from "../compare/controlledComparison.ts";
import {
  LQ08_COMPARISON,
  lq08ComparisonIdentity,
  lq08ComparisonParameters,
  refuseLq08Comparison,
  verifyLq08Comparison,
} from "./comparison.ts";
import type { Lq08Parameters } from "./definition.ts";
import { createLq08Session } from "./session.ts";

/**
 * Explicitly opened from accepted bench settings. This independent synchronous owner keeps a
 * pinned comparison stable while the reader continues exploring the main apparatus.
 */
export function createLq08ComparisonSession(
  instanceId: string,
  parameters: Lq08Parameters,
  source: Readonly<{ sourceDigest: string }>,
) {
  const identity = lq08ComparisonIdentity(source);
  const validated = lq08ComparisonParameters(parameters);
  const owner = createLq08Session(instanceId);
  const applied = owner.apply(validated);
  const snapshot = owner.getSnapshot().accepted;
  if (applied.kind !== "accepted" || !snapshot?.final) {
    refuseLq08Comparison("The photoelectric owner could not accept the pinned settings.");
  }
  const baseline = pinBaseline(
    snapshot,
    identity,
    LQ08_COMPARISON.outputs.map(({ id }) => id),
  );
  const verification = verifyLq08Comparison(
    snapshot,
    snapshot,
    compareBaselines(baseline, baseline, LQ08_COMPARISON),
  );
  if (verification) {
    refuseLq08Comparison(verification);
  }
  return createControlledComparison(owner, {
    contract: LQ08_COMPARISON,
    identity,
    baseline: snapshot,
    variant: snapshot,
    initialMessage: "Pinned accepted photoelectric settings; no input changed yet.",
    verifyAccepted: verifyLq08Comparison,
  });
}
