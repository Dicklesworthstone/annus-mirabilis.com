import { decodeTapePermalinkInBrowser } from "./browserCodec.ts";
import { checkTapeCompatibility } from "./compatibility.ts";
import {
  type DraftTapeBinding,
  type DraftTapeLoad,
  environmentForSettings,
  loadDraftTape,
} from "./draftTape.ts";
import { validateTapeV2 } from "./schema.ts";
import { requirementsOf, settingsFromTape, tapeStateOf } from "./sessionTape.ts";
import type { ExperimentEnvironment, TapeV2 } from "./types.ts";

export type WorkerLinkCheckpoint = Readonly<{
  kind: "checkpoint";
  /** The original record, retained unchanged for sharing after verified acceptance. */
  tape: TapeV2;
  /** A referenced walkthrough is expanded without changing the link's recorded identity. */
  replay: TapeV2;
  /** Validated controls at the checkpoint, for an explicitly separate current-model run. */
  settings: Readonly<Record<string, number | string>>;
  compatibilityNotice: string | null;
}>;
export type WorkerLinkLoad = DraftTapeLoad | WorkerLinkCheckpoint;
type TeachingResolver = (id: string) => TapeV2 | null | Promise<TapeV2 | null>;

const refused = (notice: string) => ({ kind: "not-restored" as const, notice });

function isRecordedCalculation(tape: TapeV2): boolean {
  return (
    tape.events.length > 0 ||
    tape.teachingTapeRef !== undefined ||
    tape.acceptedCheckpoint.acceptedActionIndex !== 0 ||
    tape.acceptedCheckpoint.scientificState !== undefined ||
    tape.acceptedCheckpoint.digest.startsWith("host:sha256:")
  );
}

/** Only inspect controls here. A valid sequence is not evidence that its result was reproduced. */
function checkpointSettings(binding: DraftTapeBinding, tape: TapeV2) {
  let settings: Readonly<Record<string, unknown>> = binding.defaults;
  const apply = (changes: Readonly<Record<string, number | string>>): string | null => {
    if (Object.keys(changes).some((key) => !Object.hasOwn(binding.defaults, key)))
      return "The recorded calculation names a setting this laboratory does not support.";
    const candidate = { ...settings, ...settingsFromTape(changes, binding.defaults) };
    const checked = binding.validate(candidate);
    if (checked.kind !== "accepted")
      return requirementsOf(checked) || "The laboratory refuses a recorded setting.";
    settings =
      checked.data && typeof checked.data === "object"
        ? (checked.data as Readonly<Record<string, unknown>>)
        : candidate;
    return null;
  };
  const initialError = apply(tape.initialConditions);
  if (initialError) return refused(initialError);
  let actionIndex = 0;
  for (const event of tape.events) {
    if (
      event.actionIndex <= 0 ||
      event.actionIndex < actionIndex ||
      event.actionIndex > tape.acceptedCheckpoint.acceptedActionIndex
    )
      return refused(
        "The shared checkpoint does not contain a complete, ordered sequence of changes.",
      );
    if (
      event.previousValue !== undefined &&
      !Object.is(
        settingsFromTape({ [event.paramId]: event.previousValue }, binding.defaults)[event.paramId],
        settings[event.paramId],
      )
    )
      return refused("A recorded change does not begin at its stated previous value.");
    const error = apply({ [event.paramId]: event.value });
    if (error) return refused(error);
    actionIndex = event.actionIndex;
  }
  if (actionIndex !== tape.acceptedCheckpoint.acceptedActionIndex)
    return refused("The recorded changes do not reach the shared checkpoint.");
  if (binding.seedForSettings && binding.seedForSettings(settings) !== tape.seed)
    return refused("The shared checkpoint's seed differs from its recorded settings.");
  const controls = tapeStateOf(settings);
  if (!controls) return refused("These recorded settings cannot be used in a laboratory link.");
  return { kind: "settings" as const, settings, controls: Object.freeze(controls) };
}

/** A reference must identify the same record; a changed catalogue never repairs an old identity. */
async function expandTeachingReference(tape: TapeV2, resolve?: TeachingResolver) {
  const ref = tape.teachingTapeRef;
  if (!ref) {
    if (
      tape.events.some(
        (event, index) => event.actionIndex < (tape.events[index - 1]?.actionIndex ?? 0),
      )
    )
      return refused("The recorded calculation's changes are out of order.");
    return {
      kind: "resolved" as const,
      tape: {
        ...tape,
        events: tape.events.filter(
          (event) => event.actionIndex <= tape.acceptedCheckpoint.acceptedActionIndex,
        ),
      },
    };
  }
  const resolver = resolve ?? (await import("./teachingTapeCatalogue.ts")).resolveTeachingTape;
  const original = await resolver(ref.tapeId);
  if (!original)
    return refused(
      `The published walkthrough ${ref.tapeId} is unavailable. The current result is unchanged.`,
    );
  const authored = validateTapeV2(original);
  const recordedEnvironment: ExperimentEnvironment = {
    experimentId: tape.experimentId,
    mode: tape.mode,
    ...tape.modelIdentity,
    constantSetId: tape.constantSetId,
    streamVersion: tape.streamVersion,
    allocationId: tape.allocationId,
    ...(tape.replayGrid ? { replayGrid: tape.replayGrid } : {}),
  };
  if (
    authored.experimentId !== tape.experimentId ||
    authored.mode !== tape.mode ||
    authored.seed !== tape.seed ||
    !checkTapeCompatibility(authored, recordedEnvironment).compatible
  )
    return refused(
      "The published walkthrough no longer matches this link's recorded identity. Open the walkthrough to choose its current version.",
    );
  if (ref.stepIndex >= Math.max(1, authored.events.length))
    return refused("This link does not identify an available stop in the published walkthrough.");
  // Catalogue records carry a self-reference as metadata; their actual controls are authoritative.
  const { teachingTapeRef: _reference, ...record } = tape;
  return {
    kind: "resolved" as const,
    tape: validateTapeV2({
      ...record,
      initialConditions: authored.initialConditions,
      events: authored.events.slice(0, ref.stepIndex + 1),
    }),
  };
}

/**
 * Loading a worker link never creates a session or executes an owner. Ordinary settings links
 * still fill the form; recorded calculations wait for the reader's explicit Restore action.
 */
export async function prepareWorkerLink(
  binding: DraftTapeBinding,
  input: TapeV2,
  resolve?: TeachingResolver,
): Promise<WorkerLinkLoad> {
  try {
    const tape = validateTapeV2(input);
    if (!isRecordedCalculation(tape)) return loadDraftTape(binding, tape);
    if (
      tape.experimentId !== binding.environment.experimentId ||
      tape.mode !== binding.environment.mode
    )
      return refused(
        "This recorded calculation belongs to another laboratory or model mode. Open it in its original laboratory.",
      );
    const expanded = await expandTeachingReference(tape, resolve);
    if (expanded.kind !== "resolved") return expanded;
    const checked = checkpointSettings(binding, expanded.tape);
    if (checked.kind !== "settings") return checked;
    const compatibility = checkTapeCompatibility(
      expanded.tape,
      environmentForSettings(binding, checked.settings),
    );
    return {
      kind: "checkpoint",
      tape,
      replay: expanded.tape,
      settings: checked.controls,
      compatibilityNotice: compatibility.compatible
        ? null
        : `${compatibility.notice} ${compatibility.repair}`,
    };
  } catch {
    return refused(
      "This recorded calculation could not be read. The accepted result and your entries are unchanged.",
    );
  }
}

export async function loadWorkerTapeFromUrl(
  binding: DraftTapeBinding,
  href: string,
): Promise<WorkerLinkLoad> {
  let address: URL;
  try {
    address = new URL(href);
  } catch {
    return { kind: "absent" };
  }
  const decoded = await decodeTapePermalinkInBrowser(address);
  if (decoded.kind === "absent") return decoded;
  if (decoded.kind === "invalid") return refused(decoded.notice);
  return prepareWorkerLink(binding, decoded.tape);
}
