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
import { parseU64, type U64String } from "../identity/u64.ts";
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
import type {
  ExperimentEnvironment,
  TapePredictionEvent,
  TapeReplayGrid,
  TapeV2,
} from "./types.ts";

type Checked = Readonly<{ kind: string; data?: unknown }>;

/** What a worker laboratory must offer for its settings to travel in a tape. */
export type DraftTapeBinding = Readonly<{
  environment: ExperimentEnvironment;
  /** The laboratory's defaults: the shape a tape's settings are read against. */
  defaults: Readonly<Record<string, unknown>>;
  /** The laboratory's own parameter validator. */
  validate(input: unknown): Checked;
  /**
   * A laboratory with selectable constants derives its identity from accepted settings. Called
   * only after validate accepts, with its returned data when present, never with an unchecked
   * tape header. Bindings without this resolver keep their fixed environment identity.
   */
  constantSetIdForSettings?(settings: Readonly<Record<string, unknown>>): string;
  seedForSettings?(settings: Readonly<Record<string, unknown>>): U64String;
  replayGridForSettings?(settings: Readonly<Record<string, unknown>>): TapeReplayGrid;
}>;

function acceptedSettings(
  checked: Checked,
  settings: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const data = checked.data;
  return data && typeof data === "object" ? (data as Record<string, unknown>) : settings;
}

export function environmentForSettings(
  binding: DraftTapeBinding,
  settings: Readonly<Record<string, unknown>>,
): ExperimentEnvironment {
  return {
    ...binding.environment,
    ...(binding.constantSetIdForSettings
      ? { constantSetId: binding.constantSetIdForSettings(settings) }
      : {}),
    ...(binding.replayGridForSettings
      ? { replayGrid: binding.replayGridForSettings(settings) }
      : {}),
  };
}

/**
 * The tape for a set of accepted settings. Its checkpoint is the digest of those settings, at action
 * 0 and input revision 0, since nothing is replayed to reach it. Null when a setting cannot travel in
 * a tape, or the laboratory refuses it.
 */
export function draftTapeForSettings(binding: DraftTapeBinding, params: object): TapeV2 | null {
  const state = tapeStateOf(params);
  if (!state) return null;
  const settings = {
    ...binding.defaults,
    ...settingsFromTape(state, binding.defaults),
  };
  const checked = binding.validate(settings);
  if (checked.kind !== "accepted") return null;
  const accepted = acceptedSettings(checked, settings);
  const env = environmentForSettings(binding, accepted);
  const tape: TapeV2 = {
    tapeVersion: 2,
    experimentId: env.experimentId,
    mode: env.mode,
    modelIdentity: {
      modelId: env.modelId,
      modelVersion: env.modelVersion,
      ...(env.artifactDigest === undefined ? {} : { artifactDigest: env.artifactDigest }),
      ...(env.evaluatorSourceHash === undefined
        ? {}
        : { evaluatorSourceHash: env.evaluatorSourceHash }),
    },
    constantSetId: env.constantSetId,
    seed: binding.seedForSettings
      ? parseU64(binding.seedForSettings(accepted))
      : ("0" as U64String),
    streamVersion: env.streamVersion,
    allocationId: env.allocationId,
    ...(env.replayGrid === undefined ? {} : { replayGrid: env.replayGrid }),
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
  | Readonly<{
      kind: "loaded";
      settings: Readonly<Record<string, unknown>>;
      predictions?: readonly TapePredictionEvent[];
    }>
  | Readonly<{
      kind: "not-restored";
      notice: string;
      /** Offer only an explicit copy into the form; keep the recorded source identity untouched. */
      newSettings?: TapeV2;
    }>;

/**
 * A decoded tape's settings, for the form, when the tape describes this laboratory and model, holds
 * settings only, matches its own digest, and passes the laboratory's validator. Anything else is
 * refused in a sentence, and the form keeps what it had.
 */
export function loadDraftTape(binding: DraftTapeBinding, tape: TapeV2): DraftTapeLoad {
  return readDraftTape(binding, tape, false);
}

/** Explicitly copy a legacy record's validated settings; Apply still owns the new calculation. */
export function loadDraftTapeAsCurrentSettings(
  binding: DraftTapeBinding,
  tape: TapeV2,
): DraftTapeLoad {
  return readDraftTape(binding, tape, true);
}

function readDraftTape(
  binding: DraftTapeBinding,
  tape: TapeV2,
  asCurrentSettings: boolean,
): DraftTapeLoad {
  const env = binding.environment;
  if (tape.experimentId !== env.experimentId) {
    return {
      kind: "not-restored",
      notice: `This shared state could not be restored: it was recorded in another laboratory, ${tape.experimentId}.`,
    };
  }
  if (!asCurrentSettings && !binding.constantSetIdForSettings && !binding.replayGridForSettings) {
    const compatible = checkTapeCompatibility(tape, env);
    if (!compatible.compatible) {
      return {
        kind: "not-restored",
        notice: `${compatible.notice} ${compatible.repair}`,
        newSettings: tape,
      };
    }
  }
  if (tape.events.length > 0 || tape.teachingTapeRef) {
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
  const accepted = acceptedSettings(checked, settings);
  if (!asCurrentSettings && (binding.constantSetIdForSettings || binding.replayGridForSettings)) {
    const compatible = checkTapeCompatibility(tape, environmentForSettings(binding, accepted));
    if (!compatible.compatible) {
      return {
        kind: "not-restored",
        notice: `${compatible.notice} ${compatible.repair}`,
        newSettings: tape,
      };
    }
  }
  if (binding.seedForSettings && tape.seed !== binding.seedForSettings(accepted))
    return {
      kind: "not-restored",
      notice:
        "This shared state's seed identity differs from its settings. Load a link with the original complete seed.",
    };
  return {
    kind: "loaded",
    settings: accepted,
    ...(tape.predictions ? { predictions: tape.predictions } : {}),
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
