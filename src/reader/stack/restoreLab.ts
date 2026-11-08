/**
 * am-read-return-stack-oxa. Laboratory restoration on return: reuse a still-mounted instance,
 * restore an unmounted one from a validated checkpoint, or fall back to a visibly new run.
 * "Returning must never restart an experiment" -- but never block reading on it either.
 *
 * This is the legacy numeric-seed ControlTape eligibility decision, retained for its callers.
 * The live reader uses experiments/store/readerCheckpoint.ts: a bounded v2 tape and accepted
 * point are verified against source/model/constant/stream identities, recomputed on an isolated
 * synchronous owner, then transactionally imported into a fresh instance through the same
 * dispatcher. This older decision alone is not evidence that an owner was restored. Worker
 * trajectories require their replay owner and are never started automatically by navigation.
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
