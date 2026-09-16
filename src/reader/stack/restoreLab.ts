/**
 * am-read-return-stack-oxa. Laboratory restoration on return: reuse a still-mounted instance,
 * restore an unmounted one from a validated checkpoint, or fall back to a visibly new run.
 * "Returning must never restart an experiment" -- but never block reading on it either.
 *
 * SCOPE NOTE, stated plainly rather than silently assumed: `decideLabRestore` below implements
 * the eligibility decision this bead owns -- reuse vs. restore vs. new-run, validated against
 * am-rt-control-tapes-0gc's `validateTapeCompatibility` plus this frame's own checkpoint digest
 * and seed. It does NOT, and as of this commit cannot, seed a freshly re-mounted instance store's
 * live simulation state from that checkpoint: `createInstanceStore`
 * (src/experiments/store/instanceStore.ts, am-rt-snapshot-store-aft) exposes no option to
 * construct a store already at a prior run's accepted output -- every new store starts at
 * `status: "idle"`, `runNumber: 0`. A "restore" decision here is therefore the validated
 * authorization to attempt a restore and the checkpoint to restore from, not a guarantee that the
 * mounted view will show mid-run state; wiring an actual seeding hook into the snapshot store is
 * real follow-up work outside this bead's reserved files. Reuse (the instance is still mounted)
 * is fully real: it costs nothing beyond calling the instance registry's own `acquire` again,
 * which already reattaches to a live entry by placement key.
 */
import type { ControlTape, ControlTapeCheckpoint } from "../../experiments/tape/controlTape.ts";
import { validateTapeCompatibility } from "../../experiments/tape/controlTape.ts";
import type { LabReference } from "./stackStore.ts";

export type LabRestoreDecision =
  | Readonly<{ action: "reuse" }>
  | Readonly<{ action: "restore"; checkpoint: ControlTapeCheckpoint }>
  | Readonly<{ action: "new-run"; reason: string }>;

function findCheckpoint(tape: ControlTape, digest: string): ControlTapeCheckpoint | undefined {
  return tape.checkpoints.find((c) => c.digest === digest);
}

export type DecideLabRestoreInput = Readonly<{
  /** Whether the instance registry still has a live entry for this placement -- the caller reads
   * this from `InstanceRegistry.has(placementKey)`; this function stays pure and DOM-free. */
  mounted: boolean;
  lab: LabReference | null;
  /** The control tape parsed from `lab.compactTape`, or null if it could not be parsed. Parsing
   * the compact tape bytes is not this function's job -- it validates a tape it is given. */
  tape: ControlTape | null;
  currentExperimentId: string;
  currentModelIdentity: string;
  /** The seed the current instrument setup would use for a fresh run, compared against the
   * recorded tape's seed. A changed seed invalidates the checkpoint (this bead's own worked
   * example: "an invalid checkpoint (a changed seed or stream version) produces a visibly new
   * run"). */
  expectedSeed: number;
}>;

export function decideLabRestore(input: DecideLabRestoreInput): LabRestoreDecision {
  if (input.mounted) return { action: "reuse" };
  if (!input.lab) return { action: "new-run", reason: "no laboratory was recorded for this frame" };
  if (!input.tape)
    return { action: "new-run", reason: "the recorded checkpoint tape could not be read" };

  const compatibility = validateTapeCompatibility(
    input.tape,
    input.currentExperimentId,
    input.currentModelIdentity,
  );
  if (!compatibility.valid)
    return {
      action: "new-run",
      reason:
        compatibility.reason ?? "the recorded tape is incompatible with the current instrument",
    };

  if (input.tape.seed !== input.expectedSeed)
    return {
      action: "new-run",
      reason: `the recorded tape's seed (${input.tape.seed}) no longer matches the current setup's seed (${input.expectedSeed})`,
    };

  const checkpoint = findCheckpoint(input.tape, input.lab.checkpointDigest);
  if (!checkpoint)
    return {
      action: "new-run",
      reason: `no checkpoint with digest ${input.lab.checkpointDigest} was found on the recorded tape`,
    };

  return { action: "restore", checkpoint };
}
