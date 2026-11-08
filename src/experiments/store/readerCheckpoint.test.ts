import { afterAll, describe, expect, test } from "bun:test";
import example from "../../generated/lq08-example.json";
import type { LabReference } from "../../reader/stack/stackStore.ts";
import { TestLogger } from "../../testing/log/logger.ts";
import { createLq08Session } from "../lq08/session.ts";
import { LQ08_TAPE } from "../lq08/tape.ts";
import { checkpointJson } from "./instanceCheckpoint.ts";
import {
  captureReaderCheckpoint,
  createDeferredReaderCheckpointBinding,
  createReaderCheckpointBinding,
  inspectReaderCheckpoint,
  MAX_READER_CHECKPOINT_BYTES,
  type ReaderCheckpointArchive,
  readerCheckpointDigest,
  restoreReaderCheckpoint,
} from "./readerCheckpoint.ts";

const identity = {
  experimentId: "lq-08",
  instanceId: "instrument-view:lq-08",
  sourceDigest: example.sourceDigest,
};
const placement = '["/papers/light-quanta/","instrument-view","lq-08","passage-a","try-a"]';
const binding = createReaderCheckpointBinding(LQ08_TAPE);
const create = (id: string) => createLq08Session(id, example);
const logger = new TestLogger("reader-archived-checkpoint");
afterAll(() => logger.flush());

function recorded() {
  const session = create(`${identity.instanceId}/retained-1-9`);
  session.apply({ frequency: 9e14, collectorPotential: -0.5 });
  const archive = captureReaderCheckpoint(binding, session, identity, placement);
  const accepted = session.getSnapshot().accepted;
  if (!archive || !accepted)
    throw new Error("A real completed laboratory did not produce a checkpoint.");
  const reference: LabReference = {
    instanceId: accepted.instanceId,
    experimentId: identity.experimentId,
    modelIdentity: identity.sourceDigest,
    runId: accepted.runId,
    ...archive,
  };
  return { session, reference, accepted };
}

describe("real owner verification before archived reader restoration", () => {
  test("the same real run, parameters, outputs and counters resume after the original owner is gone", () => {
    const { session, reference, accepted } = recorded();
    session.disconnect();
    const restored = restoreReaderCheckpoint(binding, reference, identity, placement, create);
    expect(restored.kind).toBe("restored");
    if (restored.kind !== "restored") throw new Error(restored.notice);
    expect(restored.session).not.toBe(session);
    expect(restored.session.getSnapshot().accepted).toEqual(accepted);
    expect(restored.session.acceptedParameters()).toEqual(accepted.parameters);
    restored.session.apply({ collectorPotential: -0.7 });
    const next = restored.session.getSnapshot().accepted;
    expect(next?.runId).toBe(accepted.runId);
    expect(next?.actionIndex).toBe(accepted.actionIndex + 1);
    expect(next?.snapshotVersion).toBe(accepted.snapshotVersion + 1);
    expect(next?.revisions.measurement).toBe(accepted.revisions.measurement + 1);
    logger.log({
      testId: "real-photoelectric-archive",
      beadId: "am-read-return-stack-oxa",
      instrumentId: "lq-08",
      instanceId: accepted.instanceId,
      runId: accepted.runId,
      snapshotVersion: accepted.snapshotVersion,
      outcome: "passed",
      message:
        "The fresh owner reproduces the recorded scientific result before importing and continuing the original accepted run.",
    });
  });

  test("model, source, schema, parameter, seed, stream, placement and digest mismatches are rejected before a visible owner exists", () => {
    const { reference } = recorded();
    let visibleOwners = 0;
    const trackedCreate = (id: string) => {
      visibleOwners++;
      return create(id);
    };
    const damaged: LabReference[] = [
      { ...reference, compactTape: "not-json" },
      { ...reference, compactTape: "x".repeat(MAX_READER_CHECKPOINT_BYTES + 1) },
      { ...reference, checkpointDigest: "host:0000000000000000" },
      { ...reference, modelIdentity: `source:sha256:${"0".repeat(64)}` },
      { ...reference, runId: "another-run" },
    ];
    for (const mutate of [
      (archive: ReaderCheckpointArchive) => ({ ...archive, readerCheckpointVersion: 9 }),
      (archive: ReaderCheckpointArchive) => ({ ...archive, tape: { ...archive.tape, seed: "1" } }),
      (archive: ReaderCheckpointArchive) => ({
        ...archive,
        tape: { ...archive.tape, streamVersion: "changed" },
      }),
      (archive: ReaderCheckpointArchive) => ({
        ...archive,
        tape: { ...archive.tape, constantSetId: "changed" },
      }),
      (archive: ReaderCheckpointArchive) => ({
        ...archive,
        tape: {
          ...archive.tape,
          modelIdentity: { ...archive.tape.modelIdentity, modelVersion: 2 },
        },
      }),
      (archive: ReaderCheckpointArchive) => ({
        ...archive,
        checkpoint: {
          ...archive.checkpoint,
          accepted: {
            ...archive.checkpoint.accepted,
            parameters: { ...archive.checkpoint.accepted.parameters, frequency: -3 },
          },
        },
      }),
    ]) {
      const altered = mutate(JSON.parse(reference.compactTape)) as ReaderCheckpointArchive;
      damaged.push({
        ...reference,
        compactTape: checkpointJson(altered, MAX_READER_CHECKPOINT_BYTES),
        checkpointDigest: readerCheckpointDigest(altered),
      });
    }
    for (const candidate of damaged)
      expect(
        restoreReaderCheckpoint(binding, candidate, identity, placement, trackedCreate).kind,
      ).toBe("not-restored");
    expect(
      restoreReaderCheckpoint(binding, reference, identity, `${placement}-other`, trackedCreate)
        .kind,
    ).toBe("not-restored");
    expect(visibleOwners).toBe(0);
  });

  test("a recomputed checksum cannot make fabricated numbers pass the actual scientific owner", () => {
    const { reference } = recorded();
    const archive: ReaderCheckpointArchive = JSON.parse(reference.compactTape);
    const first = archive.checkpoint.accepted.outputs[0];
    if (!first) throw new Error("The archive has no outputs.");
    const output = JSON.parse(first);
    output.value += 1;
    const changed: ReaderCheckpointArchive = {
      ...archive,
      checkpoint: {
        ...archive.checkpoint,
        accepted: {
          ...archive.checkpoint.accepted,
          outputs: [checkpointJson(output), ...archive.checkpoint.accepted.outputs.slice(1)],
        },
      },
    };
    const forged = {
      ...reference,
      compactTape: checkpointJson(changed, MAX_READER_CHECKPOINT_BYTES),
      checkpointDigest: readerCheckpointDigest(changed),
    };
    const result = restoreReaderCheckpoint(binding, forged, identity, placement, create);
    expect(result.kind).toBe("not-restored");
    if (result.kind === "not-restored") expect(result.notice).toContain("does not reproduce");
  });

  test("private notes and extra tape fields are not admitted by the bounded archive", () => {
    const { reference } = recorded();
    const archive: ReaderCheckpointArchive = JSON.parse(reference.compactTape);
    const polluted = {
      ...archive,
      tape: { ...archive.tape, privateNotes: "A reader's unrelated note" },
    };
    expect(
      restoreReaderCheckpoint(
        binding,
        {
          ...reference,
          compactTape: checkpointJson(polluted, MAX_READER_CHECKPOINT_BYTES),
          checkpointDigest: readerCheckpointDigest(polluted),
        },
        identity,
        placement,
        create,
      ).kind,
    ).toBe("not-restored");
    expect(reference.compactTape).not.toContain("predictions");
    expect(reference.compactTape).not.toContain("privateNotes");
  });

  test("worker eligibility never starts either a verification or visible worker during navigation", () => {
    const { reference } = recorded();
    let started = 0;
    const deferred = createDeferredReaderCheckpointBinding({
      ...LQ08_TAPE,
      createSession: (id) => {
        started++;
        return create(id);
      },
    });
    expect(
      inspectReaderCheckpoint(deferred, reference, identity, placement).checkpoint.accepted.runId,
    ).toBe(reference.runId);
    const result = restoreReaderCheckpoint(deferred, reference, identity, placement, (id) => {
      started++;
      return create(id);
    });
    expect(result.kind).toBe("not-restored");
    if (result.kind === "not-restored") expect(result.notice).toContain("explicit calculation");
    expect(started).toBe(0);
  });

  test("a mutable constant-set selector is validated from the accepted parameters, never from the recorded label alone", () => {
    const { session } = recorded();
    const selectedBinding = createReaderCheckpointBinding({
      ...LQ08_TAPE,
      constantSetIdForSettings: (parameters) =>
        parameters.frequency === 9e14 ? "selected-constants" : "modern-si-2019",
    });
    const archive = captureReaderCheckpoint(selectedBinding, session, identity, placement);
    const accepted = session.getSnapshot().accepted;
    if (!archive || !accepted)
      throw new Error("A complete selected-constant checkpoint is missing.");
    const reference: LabReference = {
      instanceId: accepted.instanceId,
      experimentId: identity.experimentId,
      modelIdentity: identity.sourceDigest,
      runId: accepted.runId,
      ...archive,
    };
    expect(
      inspectReaderCheckpoint(selectedBinding, reference, identity, placement).tape.constantSetId,
    ).toBe("selected-constants");
    expect(
      restoreReaderCheckpoint(selectedBinding, reference, identity, placement, create).kind,
    ).toBe("restored");
    expect(restoreReaderCheckpoint(binding, reference, identity, placement, create).kind).toBe(
      "not-restored",
    );
  });
});
