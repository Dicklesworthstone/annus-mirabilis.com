/**
 * A worker laboratory's ?tape= link (am-inst-permalink-tape-s677): the settings a shared link carries,
 * put into the laboratory's form rather than run.
 *
 * The worker laboratories' own settings links load settings and start no calculation. BM-05 says
 * "Shared links load settings only; they never start a calculation"; BM-07 says "Opening a shared
 * link starts no worker". A tape keeps that promise. Its identity, its own digest and the
 * laboratory's validator are checked, and then the settings are handed to the form; the reader's
 * Apply runs them. The synchronous laboratories replay a tape instead (sessionTape.ts), since
 * applying a setting there costs nothing.
 */
import type { U64String } from "../identity/u64.ts";
import { decodeTapePermalinkInBrowser } from "./browserCodec.ts";
import { checkTapeCompatibility } from "./compatibility.ts";
import {
  digestFormOf,
  requirementsOf,
  settingsFromTape,
  tapeStateDigestIn,
  tapeStateDigestV2,
  tapeStateOf,
} from "./sessionTape.ts";
import type { ExperimentEnvironment, TapeV2 } from "./types.ts";

type Checked = Readonly<{ kind: string; data?: unknown }>;

/** What a worker laboratory must offer for its settings to travel in a tape. */
export type DraftTapeBinding = Readonly<{
  environment: ExperimentEnvironment;
  /** The laboratory's defaults: the shape a tape's settings are read against. */
  defaults: Readonly<Record<string, unknown>>;
  /** The laboratory's own parameter validator. */
  validate(input: unknown): Checked;
}>;

/**
 * The tape for a set of accepted settings. Its checkpoint is the digest of those settings, at action
 * 0 and input revision 0, since nothing is replayed to reach it. Null when a setting cannot travel in
 * a tape, or the laboratory refuses it.
 */
export function draftTapeForSettings(binding: DraftTapeBinding, params: object): TapeV2 | null {
  const state = tapeStateOf(params);
  if (!state) return null;
  const checked = binding.validate({
    ...binding.defaults,
    ...settingsFromTape(state, binding.defaults),
  });
  if (checked.kind !== "accepted") return null;
  const env = binding.environment;
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
    acceptedCheckpoint: {
      acceptedActionIndex: 0,
      acceptedInputRevision: 0,
      digest: tapeStateDigestV2(state, 0),
    },
  };
  return Object.freeze(tape);
}

export type DraftTapeLoad =
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "loaded"; settings: Readonly<Record<string, unknown>> }>
  | Readonly<{ kind: "not-restored"; notice: string }>;

/**
 * A decoded tape's settings, for the form, when the tape describes this laboratory and model, holds
 * settings only, matches its own digest, and passes the laboratory's validator. Anything else is
 * refused in a sentence, and the form keeps what it had.
 */
export function loadDraftTape(binding: DraftTapeBinding, tape: TapeV2): DraftTapeLoad {
  const env = binding.environment;
  if (tape.experimentId !== env.experimentId) {
    return {
      kind: "not-restored",
      notice: `This shared state could not be restored: it was recorded in another laboratory, ${tape.experimentId}.`,
    };
  }
  const compatible = checkTapeCompatibility(tape, env);
  if (!compatible.compatible) {
    return { kind: "not-restored", notice: `${compatible.notice} ${compatible.repair}` };
  }
  if (tape.events.length > 0) {
    return {
      kind: "not-restored",
      notice:
        "This shared state could not be restored: it records its changes one at a time, and this laboratory reads only a link's settings.",
    };
  }
  const digest = tape.acceptedCheckpoint.digest;
  if (tapeStateDigestIn(digestFormOf(digest), tape.initialConditions, 0) !== digest) {
    return {
      kind: "not-restored",
      notice:
        "This shared state could not be restored: its settings do not match the check it carries, so the link has been altered or damaged.",
    };
  }
  const settings = {
    ...binding.defaults,
    ...settingsFromTape(tape.initialConditions, binding.defaults),
  };
  const checked = binding.validate(settings);
  if (checked.kind !== "accepted") {
    return {
      kind: "not-restored",
      notice: `This shared state could not be restored. ${requirementsOf(checked) || "Its settings are not ones this laboratory accepts."}`,
    };
  }
  const data = checked.data;
  return {
    kind: "loaded",
    settings: data && typeof data === "object" ? (data as Record<string, unknown>) : settings,
  };
}

/** Reads ?tape= from the page's address and loads it; "absent" when there is none. */
export async function loadDraftTapeFromUrl(
  binding: DraftTapeBinding,
  href: string,
): Promise<DraftTapeLoad> {
  // A URL, not the string: a bare string with no "?" is read as a tape itself (extractTapeParam).
  let address: URL;
  try {
    address = new URL(href);
  } catch {
    return { kind: "absent" };
  }
  const decoded = await decodeTapePermalinkInBrowser(address);
  if (decoded.kind === "absent") return { kind: "absent" };
  if (decoded.kind === "invalid") return { kind: "not-restored", notice: decoded.notice };
  return loadDraftTape(binding, decoded.tape);
}
