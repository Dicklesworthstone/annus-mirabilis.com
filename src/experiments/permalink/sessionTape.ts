/**
 * A laboratory's ?tape= binding: the tape it shares and the replay that restores it, for any
 * laboratory whose session applies settings on the host, synchronously (am-inst-permalink-tape-s677).
 *
 * LQ-08 was the first laboratory to read a tape (ee4de75c); this is its shape, made general. A
 * restore replays the tape through the laboratory's own session, so the validator, owner and store
 * that accept a setting by hand are the ones that restore it.
 */
import type { U64String } from "../identity/u64.ts";
import { ExperimentRuntimeError } from "../refusal.ts";
import { quantizeFloat } from "../tape/controlTape.ts";
import { decodeTapePermalinkInBrowser } from "./browserCodec.ts";
import { type ReplayRunner, replayTape } from "./replay.ts";
import type { ExperimentEnvironment, TapeAcceptedCheckpoint, TapeV2 } from "./types.ts";

type ApplyOutcome = Readonly<{ kind: string }>;

/** What a laboratory session must offer to be replayed. */
export type TapeSession = Readonly<{
  apply(input: unknown): ApplyOutcome;
  getSnapshot(): Readonly<{
    accepted: Readonly<{ revisions: Readonly<{ input: number }> }> | null;
  }>;
  acceptedParameters(): object;
}>;

export type LabTapeBinding = Readonly<{
  environment: ExperimentEnvironment;
  /** The laboratory's defaults: the shape a tape's settings are read against. */
  defaults: Readonly<Record<string, unknown>>;
  /** The laboratory's own parameter validator. */
  validate(input: unknown): ApplyOutcome;
  /** A fresh session with the defaults, used to compute the checkpoint a reader will reach. */
  createSession(instanceId: string): TapeSession;
}>;

type TapeState = Record<string, number | string>;

/** A refusal's sentence, if the outcome carries one. */
function requirementsOf(outcome: ApplyOutcome): string {
  const refusal = (outcome as { refusal?: { details?: { requirements?: unknown } } }).refusal;
  const requirements = refusal?.details?.requirements;
  return typeof requirements === "string" ? requirements : "";
}

/**
 * Settings as a tape carries them: numbers and strings as they are, booleans as "true" or "false".
 * Null when a setting is none of these, so a laboratory never shares a state it cannot restore.
 */
export function tapeStateOf(params: object): TapeState | null {
  const out: TapeState = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "number" || typeof value === "string") out[key] = value;
    else if (typeof value === "boolean") out[key] = value ? "true" : "false";
    else return null;
  }
  return out;
}

/** A tape's settings read back against the laboratory's defaults: "true"/"false" where it keeps a boolean. */
export function settingsFromTape(
  conditions: Readonly<Record<string, number | string>>,
  defaults: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(conditions)) {
    out[key] =
      typeof defaults[key] === "boolean" && (value === "true" || value === "false")
        ? value === "true"
        : value;
  }
  return out;
}

/**
 * FNV-1a over the sorted settings: numbers quantized to 10⁻⁶, strings by character. It confirms
 * that replay reached the recorded settings; the exact values travel in the initial conditions.
 */
export function tapeStateDigest(state: TapeState, actionIndex: number): string {
  let h = (2166136261 ^ actionIndex) >>> 0;
  const mix = (code: number) => {
    h ^= code;
    h = Math.imul(h, 16777619) >>> 0;
  };
  for (const key of Object.keys(state).sort()) {
    for (let i = 0; i < key.length; i++) mix(key.charCodeAt(i));
    const value = state[key];
    if (typeof value === "string") {
      mix(0x22);
      for (let i = 0; i < value.length; i++) mix(value.charCodeAt(i));
    } else if (typeof value === "number") {
      mix(Math.round(quantizeFloat(value) * 1_000_000));
    }
  }
  return `host:fnv1a:${h.toString(16).padStart(8, "0")}`;
}

/**
 * Replays a tape through the laboratory's own session. A setting it refuses stops the replay, and
 * refusalSentence() keeps the laboratory's sentence for it, since replayTape's notice carries the
 * raw error.
 */
export function createSessionReplayRunner(
  binding: LabTapeBinding,
  session: TapeSession,
): ReplayRunner & Readonly<{ refusalSentence(): string }> {
  let actionIndex = 0;
  let refusal = "";
  const current = () => tapeStateOf(session.acceptedParameters()) ?? {};
  const apply = (patch: Record<string, unknown>) => {
    const outcome = session.apply({ ...session.acceptedParameters(), ...patch });
    if (outcome.kind === "accepted") return;
    refusal = requirementsOf(outcome) || "The shared settings could not be applied.";
    throw new ExperimentRuntimeError(
      "parameters-rejected",
      refusal,
      binding.environment.experimentId,
    );
  };
  return {
    refusalSentence: () => refusal,
    environment: binding.environment,
    applyInitialConditions(conditions) {
      apply(settingsFromTape(conditions, binding.defaults));
      actionIndex = 0;
    },
    applyEvent(event) {
      apply(settingsFromTape({ [event.paramId]: event.value }, binding.defaults));
      actionIndex = event.actionIndex;
    },
    getAcceptedCheckpoint(): TapeAcceptedCheckpoint {
      return {
        acceptedActionIndex: actionIndex,
        acceptedInputRevision: session.getSnapshot().accepted?.revisions.input ?? 0,
        digest: tapeStateDigest(current(), actionIndex),
      };
    },
    getCurrentState() {
      return current();
    },
  };
}

/**
 * The tape for a set of accepted settings, with the checkpoint a fresh laboratory reaches by
 * replaying it. Null when a setting cannot travel in a tape, or the laboratory refuses it.
 */
export function tapeForSettings(binding: LabTapeBinding, params: object): TapeV2 | null {
  const state = tapeStateOf(params);
  if (!state) return null;
  const env = binding.environment;
  const runner = createSessionReplayRunner(
    binding,
    binding.createSession(`${env.experimentId}-tape-checkpoint`),
  );
  try {
    runner.applyInitialConditions(state);
  } catch {
    return null;
  }
  const tape: TapeV2 = {
    tapeVersion: 2,
    experimentId: env.experimentId,
    mode: env.mode,
    modelIdentity: { modelId: env.modelId, modelVersion: env.modelVersion },
    constantSetId: env.constantSetId,
    seed: "0" as U64String,
    streamVersion: env.streamVersion,
    allocationId: env.allocationId,
    initialConditions: state,
    events: [],
    acceptedCheckpoint: runner.getAcceptedCheckpoint(),
  };
  return Object.freeze(tape);
}

export type LabTapeRestore =
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "restored" }>
  | Readonly<{ kind: "not-restored"; notice: string }>;

/**
 * Restores a decoded tape into the laboratory. Anything short of a verified replay leaves the
 * settings the reader already had, and says why in a sentence.
 */
export function restoreTape(
  binding: LabTapeBinding,
  session: TapeSession,
  tape: TapeV2,
): LabTapeRestore {
  const env = binding.environment;
  if (tape.experimentId !== env.experimentId) {
    return {
      kind: "not-restored",
      notice: `This shared state could not be restored: it was recorded in another laboratory, ${tape.experimentId}.`,
    };
  }
  // The laboratory's own sentence for a setting it would refuse, before anything is replayed.
  const checked = binding.validate({
    ...binding.defaults,
    ...settingsFromTape(tape.initialConditions, binding.defaults),
  });
  if (checked.kind !== "accepted") {
    const requirements = requirementsOf(checked);
    return {
      kind: "not-restored",
      notice: `This shared state could not be restored. ${requirements || "Its settings are not ones this laboratory accepts."}`,
    };
  }
  const before = { ...session.acceptedParameters() };
  const runner = createSessionReplayRunner(binding, session);
  const replayed = replayTape(tape, runner);
  if (replayed.kind === "success") return { kind: "restored" };
  // A refusal stops before anything is applied; an invalid or unverified replay may not have.
  session.apply(before);
  const refused = runner.refusalSentence();
  return {
    kind: "not-restored",
    notice:
      replayed.kind === "refusal"
        ? `${replayed.notice} ${replayed.repair}`
        : replayed.kind === "invalid" && refused
          ? `This shared state could not be restored. ${refused}`
          : replayed.notice,
  };
}

/** Reads ?tape= from the page's address and restores it; "absent" when there is none. */
export async function restoreTapeFromUrl(
  binding: LabTapeBinding,
  session: TapeSession,
  href: string,
): Promise<LabTapeRestore> {
  // A URL, not the string: a bare string with no "?" is read as a tape itself (extractTapeParam),
  // so every ordinary page load would report a link it could not restore.
  let address: URL;
  try {
    address = new URL(href);
  } catch {
    return { kind: "absent" };
  }
  const decoded = await decodeTapePermalinkInBrowser(address);
  if (decoded.kind === "absent") return { kind: "absent" };
  if (decoded.kind === "invalid") return { kind: "not-restored", notice: decoded.notice };
  return restoreTape(binding, session, decoded.tape);
}
