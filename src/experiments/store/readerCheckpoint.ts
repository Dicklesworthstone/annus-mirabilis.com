import type { LabReference } from "../../reader/stack/stackStore.ts";
import { parseU64 } from "../identity/u64.ts";
import { checkTapeCompatibility } from "../permalink/compatibility.ts";
import { validateTapeV2 } from "../permalink/schema.ts";
import { type LabTapeBinding, tapeStateDigestV2, tapeStateOf } from "../permalink/sessionTape.ts";
import type { ExperimentEnvironment, TapeV2 } from "../permalink/types.ts";
import { MAX_READER_CHECKPOINT_BYTES } from "./checkpointLimits.ts";
import {
  checkpointJson,
  decodeInstanceCheckpoint,
  type InstanceCheckpoint,
  type InstanceCheckpointRestore,
  rejectCheckpoint,
} from "./instanceCheckpoint.ts";
import type { AcceptedSnapshot, Parameters } from "./instanceStore.ts";
import type { RetainedSession, SessionRetentionIdentity } from "./sessionRetention.ts";

export { MAX_READER_CHECKPOINT_BYTES, MAX_STACK_CHECKPOINT_BYTES } from "./checkpointLimits.ts";

export type ReaderCheckpointTapeBinding = LabTapeBinding &
  Readonly<{
    constantSetIdForSettings?: (parameters: Readonly<Record<string, unknown>>) => string;
  }>;

export type ReaderCheckpointBinding = Readonly<{
  kind: "synchronous" | "deferred";
  tape: ReaderCheckpointTapeBinding;
  capture(
    session: RetainedSession,
    identity: SessionRetentionIdentity,
    placementKey: string,
  ): ArchivedReaderReference | null;
  restore<T extends RetainedSession>(
    reference: LabReference,
    identity: SessionRetentionIdentity,
    placementKey: string,
    create: (instanceId: string) => T,
  ): ReaderCheckpointRestore<T>;
}>;

export type CheckpointSession = RetainedSession &
  Readonly<{
    exportCheckpoint(): InstanceCheckpoint | null;
    restoreCheckpoint(checkpoint: unknown): InstanceCheckpointRestore;
  }>;

export type ReaderCheckpointArchive = Readonly<{
  readerCheckpointVersion: 1;
  placementKey: string;
  sourceDigest: string;
  tape: TapeV2;
  checkpoint: InstanceCheckpoint;
}>;

export type ArchivedReaderReference = Readonly<{ compactTape: string; checkpointDigest: string }>;
export type ReaderCheckpointRestore<T extends RetainedSession> =
  | Readonly<{ kind: "restored"; session: T; instanceId: string }>
  | Readonly<{ kind: "not-restored"; notice: string }>;

const descriptors = new WeakMap<ReaderCheckpointTapeBinding, ReaderCheckpointBinding>();
const captures = new WeakMap<
  RetainedSession,
  Readonly<{
    accepted: AcceptedSnapshot;
    binding: ReaderCheckpointBinding;
    key: string;
    archive: ArchivedReaderReference | null;
  }>
>();

/** Only synchronous, bounded host owners may opt in to automatic restoration on navigation. */
export function createReaderCheckpointBinding(
  tape: ReaderCheckpointTapeBinding,
): ReaderCheckpointBinding {
  const existing = descriptors.get(tape);
  if (existing) return existing;
  const descriptor = descriptorFor("synchronous", tape);
  descriptors.set(tape, descriptor);
  return descriptor;
}

/** Worker owners can share eligibility checks without starting numerical work during mounting. */
export function createDeferredReaderCheckpointBinding(
  tape: ReaderCheckpointTapeBinding,
): ReaderCheckpointBinding {
  return descriptorFor("deferred", tape);
}

function descriptorFor(
  kind: ReaderCheckpointBinding["kind"],
  tape: ReaderCheckpointTapeBinding,
): ReaderCheckpointBinding {
  const descriptor: ReaderCheckpointBinding = {
    kind,
    tape,
    capture: (session, identity, placementKey) =>
      captureReaderCheckpoint(descriptor, session, identity, placementKey),
    restore: (reference, identity, placementKey, create) =>
      restoreReaderCheckpoint(descriptor, reference, identity, placementKey, create),
  };
  return Object.freeze(descriptor);
}

function checkpointSession(session: unknown): session is CheckpointSession {
  return (
    !!session &&
    typeof session === "object" &&
    "getSnapshot" in session &&
    typeof session.getSnapshot === "function" &&
    "exportCheckpoint" in session &&
    typeof session.exportCheckpoint === "function" &&
    "restoreCheckpoint" in session &&
    typeof session.restoreCheckpoint === "function"
  );
}

function validatedParameters(
  binding: ReaderCheckpointTapeBinding,
  parameters: Parameters,
): Parameters {
  const checked = binding.validate(parameters);
  if (checked.kind !== "accepted")
    rejectCheckpoint("The laboratory refuses the checkpoint's parameters.");
  const normalized =
    "data" in checked && checked.data && typeof checked.data === "object"
      ? checked.data
      : parameters;
  if (checkpointJson(normalized) !== checkpointJson(parameters))
    rejectCheckpoint("The checkpoint parameters do not match the current parameter schema.");
  return parameters;
}

function environmentFor(
  binding: ReaderCheckpointTapeBinding,
  parameters: Parameters,
): ExperimentEnvironment {
  const constantSetId =
    binding.constantSetIdForSettings?.(parameters) ?? binding.environment.constantSetId;
  if (typeof constantSetId !== "string" || !constantSetId.trim() || constantSetId.length > 128)
    rejectCheckpoint("The checkpoint's constant set is unavailable.");
  return { ...binding.environment, constantSetId };
}

function seedFor(parameters: Parameters) {
  const seed = parameters.seed;
  return parseU64(
    seed === undefined
      ? "0"
      : typeof seed === "number" && Number.isSafeInteger(seed)
        ? String(seed)
        : seed,
    "reader checkpoint seed",
  );
}

function tapeForCheckpoint(
  binding: ReaderCheckpointTapeBinding,
  checkpoint: InstanceCheckpoint,
): TapeV2 {
  const parameters = validatedParameters(binding, checkpoint.accepted.parameters);
  const environment = environmentFor(binding, parameters);
  if (environment.experimentId !== checkpoint.accepted.experimentId)
    rejectCheckpoint("The checkpoint binding belongs to another laboratory.");
  const state = tapeStateOf(parameters);
  if (!state) rejectCheckpoint("The checkpoint's parameters cannot be recorded.");
  return validateTapeV2({
    tapeVersion: 2,
    experimentId: environment.experimentId,
    mode: environment.mode,
    modelIdentity: {
      modelId: environment.modelId,
      modelVersion: environment.modelVersion,
      ...(environment.artifactDigest === undefined
        ? {}
        : { artifactDigest: environment.artifactDigest }),
      ...(environment.evaluatorSourceHash === undefined
        ? {}
        : { evaluatorSourceHash: environment.evaluatorSourceHash }),
    },
    constantSetId: environment.constantSetId,
    seed: seedFor(parameters),
    streamVersion: environment.streamVersion,
    allocationId: environment.allocationId,
    ...(environment.replayGrid === undefined ? {} : { replayGrid: environment.replayGrid }),
    initialConditions: state,
    events: [],
    acceptedCheckpoint: {
      acceptedActionIndex: 0,
      acceptedInputRevision: checkpoint.accepted.revisions.input,
      digest: tapeStateDigestV2(state, 0),
    },
  });
}

/** The checksum covers the entire point and its meaning-bearing identities, not rounded display values. */
export function readerCheckpointDigest(archive: ReaderCheckpointArchive): string {
  return tapeStateDigestV2(
    { readerCheckpoint: checkpointJson(archive, MAX_READER_CHECKPOINT_BYTES) },
    0,
  );
}

/** Complete accepted states only: no drafts, note text, predictions or unbounded trajectory buffers. */
export function captureReaderCheckpoint(
  binding: ReaderCheckpointBinding,
  session: RetainedSession,
  identity: SessionRetentionIdentity,
  placementKey: string,
): ArchivedReaderReference | null {
  if (
    !checkpointSession(session) ||
    !/^source:sha256:[a-f0-9]{64}$/.test(identity.sourceDigest ?? "")
  )
    return null;
  const accepted = session.getSnapshot().accepted;
  if (!accepted?.final) return null;
  const key = checkpointJson([placementKey, identity.experimentId, identity.sourceDigest]);
  const previous = captures.get(session);
  if (previous?.accepted === accepted && previous.key === key && previous.binding === binding)
    return previous.archive;
  let archive: ArchivedReaderReference | null = null;
  try {
    const checkpoint = session.exportCheckpoint();
    if (checkpoint && checkpoint.accepted.experimentId === identity.experimentId) {
      const record: ReaderCheckpointArchive = {
        readerCheckpointVersion: 1,
        placementKey,
        sourceDigest: identity.sourceDigest as string,
        tape: tapeForCheckpoint(binding.tape, checkpoint),
        checkpoint,
      };
      archive = Object.freeze({
        compactTape: checkpointJson(record, MAX_READER_CHECKPOINT_BYTES),
        checkpointDigest: readerCheckpointDigest(record),
      });
    }
  } catch {
    /* A bounded unavailable checkpoint never prevents ordinary reading or calculation. */
  }
  captures.set(session, { accepted, binding, key, archive });
  return archive;
}

/** Compatibility and wire validation are also available to explicit asynchronous worker players. */
export function inspectReaderCheckpoint(
  binding: ReaderCheckpointBinding,
  reference: LabReference,
  identity: SessionRetentionIdentity,
  placementKey: string,
): ReaderCheckpointArchive {
  const compact = reference.compactTape;
  if (
    !compact ||
    compact.length > MAX_READER_CHECKPOINT_BYTES ||
    new TextEncoder().encode(compact).length > MAX_READER_CHECKPOINT_BYTES
  )
    rejectCheckpoint("The recorded checkpoint is missing or exceeds its size budget.");
  const parsed: unknown = JSON.parse(compact);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    rejectCheckpoint("The recorded checkpoint is malformed.");
  const record = parsed as Record<string, unknown>;
  const keys = ["readerCheckpointVersion", "placementKey", "sourceDigest", "tape", "checkpoint"];
  if (
    record.readerCheckpointVersion !== 1 ||
    Object.keys(record).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(record, key))
  )
    rejectCheckpoint("The recorded checkpoint schema is unsupported.");
  if (record.placementKey !== placementKey)
    rejectCheckpoint("The recorded checkpoint belongs to a different passage or laboratory mode.");
  if (
    !/^source:sha256:[a-f0-9]{64}$/.test(identity.sourceDigest ?? "") ||
    record.sourceDigest !== identity.sourceDigest ||
    reference.modelIdentity !== identity.sourceDigest
  )
    rejectCheckpoint("The laboratory source has changed since this checkpoint was recorded.");
  const checkpoint = decodeInstanceCheckpoint(record.checkpoint).checkpoint;
  const accepted = checkpoint.accepted;
  if (
    accepted.experimentId !== identity.experimentId ||
    reference.experimentId !== identity.experimentId ||
    accepted.instanceId !== reference.instanceId ||
    accepted.runId !== reference.runId
  )
    rejectCheckpoint("The recorded checkpoint does not match this frame's experiment and run.");
  const parameters = validatedParameters(binding.tape, accepted.parameters);
  const tape = validateTapeV2(record.tape);
  if (
    checkpointJson(record.tape, MAX_READER_CHECKPOINT_BYTES) !==
    checkpointJson(tape, MAX_READER_CHECKPOINT_BYTES)
  )
    rejectCheckpoint("The compact tape has unsupported fields or representations.");
  const environment = environmentFor(binding.tape, parameters);
  const compatibility = checkTapeCompatibility(tape, environment);
  if (!compatibility.compatible) rejectCheckpoint(compatibility.notice);
  if (
    tape.experimentId !== identity.experimentId ||
    tape.mode !== environment.mode ||
    tape.seed !== seedFor(parameters) ||
    tape.modelIdentity.artifactDigest !== environment.artifactDigest ||
    tape.modelIdentity.evaluatorSourceHash !== environment.evaluatorSourceHash
  )
    rejectCheckpoint("The checkpoint's model, mode, source artifact or seed is incompatible.");
  const expectedTape = tapeForCheckpoint(binding.tape, checkpoint);
  if (checkpointJson(tape) !== checkpointJson(expectedTape))
    rejectCheckpoint("The compact tape does not describe this exact accepted checkpoint.");
  const archive: ReaderCheckpointArchive = {
    readerCheckpointVersion: 1,
    placementKey,
    sourceDigest: identity.sourceDigest as string,
    tape,
    checkpoint,
  };
  if (reference.checkpointDigest !== readerCheckpointDigest(archive))
    rejectCheckpoint("The checkpoint's stored digest does not match its recorded data.");
  return archive;
}

function scientificOutputs(checkpoint: InstanceCheckpoint): string {
  return checkpointJson(
    checkpoint.accepted.outputs
      .map((output) => JSON.parse(output))
      .sort((a, b) => String(a.quantityId).localeCompare(String(b.quantityId))),
  );
}

/** Recompute on an isolated host owner, then import the verified point into a fresh visible owner. */
export function restoreReaderCheckpoint<T extends RetainedSession>(
  binding: ReaderCheckpointBinding,
  reference: LabReference,
  identity: SessionRetentionIdentity,
  placementKey: string,
  create: (instanceId: string) => T,
): ReaderCheckpointRestore<T> {
  let trial: CheckpointSession | undefined;
  let restored: T | undefined;
  try {
    const archive = inspectReaderCheckpoint(binding, reference, identity, placementKey);
    if (binding.kind === "deferred")
      return {
        kind: "not-restored",
        notice:
          "This checkpoint requires an explicit calculation with its numerical worker; it was not started during navigation.",
      };
    if (
      archive.tape.streamVersion !== "deterministic" ||
      archive.tape.allocationId !== "deterministic"
    )
      return {
        kind: "not-restored",
        notice:
          "This checkpoint requires its random-stream replay owner; it was not resumed during navigation.",
      };
    const candidate = binding.tape.createSession(`${identity.instanceId}/checkpoint-verification`);
    if (!checkpointSession(candidate))
      rejectCheckpoint("This laboratory does not support accepted checkpoint import.");
    trial = candidate;
    const outcome = candidate.apply(archive.checkpoint.accepted.parameters);
    if (outcome.kind !== "accepted" || trial.getSnapshot().pending)
      rejectCheckpoint("The laboratory did not finish verifying the recorded calculation.");
    const checked = candidate.exportCheckpoint();
    if (!checked || scientificOutputs(checked) !== scientificOutputs(archive.checkpoint))
      rejectCheckpoint("The current scientific owner does not reproduce the recorded results.");
    restored = create(archive.checkpoint.accepted.instanceId);
    if (!checkpointSession(restored))
      rejectCheckpoint("This laboratory does not support accepted checkpoint import.");
    const imported = restored.restoreCheckpoint(archive.checkpoint);
    if (imported.kind !== "restored") rejectCheckpoint(imported.notice);
    return {
      kind: "restored",
      session: restored,
      instanceId: archive.checkpoint.accepted.instanceId,
    };
  } catch (error) {
    restored?.disconnect?.();
    return { kind: "not-restored", notice: error instanceof Error ? error.message : String(error) };
  } finally {
    trial?.disconnect?.();
  }
}
