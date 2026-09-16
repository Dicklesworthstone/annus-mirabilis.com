/**
 * Adversarial observer fixture (am-rt-command-classes-dzp).
 *
 * "The §13.5 adversarial row 'changing observer means starting a new experiment' fails for
 * its intended reason: a deliberately wrong test-only implementation of the frame slider as
 * setup-change fails the invariant check on runId and eventSetDigest... not importable from
 * production code."
 */
import type { TypedCommand } from "../../experiments/commands/types.ts";
import { createEventLedgerDescription, type EventLedgerDescription } from "./eventLedgerFixture.ts";

export type AdversarialWrongObserverResult = Readonly<{
  command: TypedCommand;
  newRunId: string;
  previousRunId: string;
  corruptedEventSetDigest: string;
  originalEventSetDigest: string;
}>;

/**
 * Deliberately wrong implementation: treats frame slider speed changes as a setup-change,
 * restarting clocks and corrupting the eventSetDigest.
 */
export async function runWrongObserverImplementation(
  currentRunId: string,
  targetVc: number,
): Promise<{
  command: TypedCommand;
  preDescription: EventLedgerDescription;
  postDescription: EventLedgerDescription;
  fakePostRunId: string;
  fakeCorruptedDigest: string;
}> {
  const preDescription = await createEventLedgerDescription(0.0);
  const postDescription = await createEventLedgerDescription(targetVc);

  // WRONG: creates a new runId (as if a new experiment was started)
  const fakePostRunId = `${currentRunId}-forked-wrongly`;

  // WRONG: dispatches as setup-change instead of observer-change
  const command: TypedCommand = {
    commandId: "cmd-frame-slider-wrong",
    instanceId: "inst-sr-fixture",
    actionIndex: 2,
    class: "setup-change",
    payload: {
      velocityRatio: targetVc,
    },
  };

  // WRONG: artificially changes the event digest
  const fakeCorruptedDigest = "host:sha256:corrupted_by_wrong_reinitialization";

  return {
    command,
    preDescription,
    postDescription,
    fakePostRunId,
    fakeCorruptedDigest,
  };
}
