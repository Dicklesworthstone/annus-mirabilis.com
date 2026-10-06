import type { TapeV2 } from "./types.ts";
import { type CheckpointWalkthrough, checkpointAt } from "./walkthroughCheckpoints.ts";

/** Adapters use the existing laboratory session or form validator; no physics is computed here. */
export type WalkthroughTarget =
  | Readonly<{
      kind: "session";
      experimentId: string;
      /** Explicit new calculation; never used as an automatic fallback for a refused replay. */
      calculate?:
        | ((
            settings: Readonly<Record<string, number | string>>,
          ) =>
            | Readonly<{ kind: "calculated" }>
            | Readonly<{ kind: "not-restored"; notice: string }>)
        | undefined;
      restore(
        tape: TapeV2,
      ): Readonly<{ kind: "restored" }> | Readonly<{ kind: "not-restored"; notice: string }>;
    }>
  | Readonly<{
      kind: "form";
      experimentId: string;
      load(
        settings: Readonly<Record<string, number | string>>,
      ): Readonly<{ kind: "loaded" }> | Readonly<{ kind: "not-restored"; notice: string }>;
    }>;

export type WalkthroughAction = Readonly<{
  kind: "replayed" | "loaded" | "new-run" | "refused";
  notice: string;
}>;

/** Execute a selected stop. Merely choosing a walkthrough or a stop never calls this function. */
export function applyWalkthroughCheckpoint(
  target: WalkthroughTarget,
  walkthrough: CheckpointWalkthrough,
  index: number,
): WalkthroughAction {
  if (target.experimentId !== walkthrough.experimentId) {
    return {
      kind: "refused",
      notice: `This walkthrough belongs to ${walkthrough.experimentId}, not ${target.experimentId}.`,
    };
  }
  const checkpoint = checkpointAt(walkthrough, index);
  if (!checkpoint) return { kind: "refused", notice: "Choose one of the recorded checkpoints." };
  try {
    if (target.kind === "form") {
      const loaded = target.load(checkpoint.settings);
      if (loaded.kind !== "loaded") return { kind: "refused", notice: loaded.notice };
      return {
        kind: "loaded",
        notice: `${checkpoint.label}: settings loaded into the form only. Apply them to start a new calculation with this laboratory's model. The recorded result has not been verified.`,
      };
    }
    if (!checkpoint.tape) {
      return {
        kind: "refused",
        notice: checkpoint.unavailable || "This stop has no replayable recorded checkpoint.",
      };
    }
    const restored = target.restore(checkpoint.tape);
    if (restored.kind !== "restored") return { kind: "refused", notice: restored.notice };
    return {
      kind: "replayed",
      notice: `${checkpoint.label}: restored and matched the recorded settings checkpoint. The results below are computed by this laboratory.`,
    };
  } catch (error) {
    // An unexpected application/callback error is not a successful replay and does not justify a
    // claim that the session was rolled back. The laboratory continues showing its accepted state.
    return {
      kind: "refused",
      notice: `The checkpoint action could not complete: ${String(error)}`,
    };
  }
}

/** Exact accepted settings, not rounded display values, determine whether a checkpoint can share. */
export function sameWalkthroughSettings(left: object, right: object): boolean {
  const entries = Object.entries(left);
  const other = right as Record<string, unknown>;
  return (
    entries.length === Object.keys(right).length &&
    entries.every(([key, value]) => Object.hasOwn(other, key) && Object.is(value, other[key]))
  );
}

/** Use recorded settings with today's lab only after the reader explicitly asks for a new run. */
export function calculateWalkthroughCheckpoint(
  target: WalkthroughTarget,
  walkthrough: CheckpointWalkthrough,
  index: number,
): WalkthroughAction {
  if (target.experimentId !== walkthrough.experimentId)
    return {
      kind: "refused",
      notice: `This walkthrough belongs to ${walkthrough.experimentId}, not ${target.experimentId}.`,
    };
  const checkpoint = checkpointAt(walkthrough, index);
  if (!checkpoint) return { kind: "refused", notice: "Choose one of the recorded checkpoints." };
  if (target.kind !== "session" || !target.calculate)
    return {
      kind: "refused",
      notice: "Load the recorded settings into the form and use the laboratory's Apply control.",
    };
  try {
    const result = target.calculate(checkpoint.settings);
    if (result.kind !== "calculated") return { kind: "refused", notice: result.notice };
    return {
      kind: "new-run",
      notice: `${checkpoint.label}: a new calculation using this laboratory's current model and the recorded settings. The recorded model identity and checkpoint have not been reproduced.`,
    };
  } catch (error) {
    return { kind: "refused", notice: `The new calculation could not complete: ${String(error)}` };
  }
}

export type RetainedWalkthroughTape = Readonly<{
  binding: object;
  session: object;
  parameters: object;
  tape: TapeV2;
}>;

/** Never share an old checkpoint over an edited state or another instance of the same lab. */
export function retainedWalkthroughTape(
  retained: RetainedWalkthroughTape | null,
  binding: object,
  session: object,
  parameters: object,
): TapeV2 | null {
  return retained &&
    retained.binding === binding &&
    retained.session === session &&
    sameWalkthroughSettings(retained.parameters, parameters)
    ? retained.tape
    : null;
}
