import { describe, expect, test } from "bun:test";
import sourceDigests from "../../generated/lab-source-digests.json";
import lq06Example from "../../generated/lq06-example.json";
import lq08Example from "../../generated/lq08-example.json";
import lq09Example from "../../generated/lq09-example.json";
import me02Example from "../../generated/me02-example.json";
import sr02Example from "../../generated/sr02-example.json";
import sr05Example from "../../generated/sr05-example.json";
import sr08Example from "../../generated/sr08-example.json";
import sr09Example from "../../generated/sr09-example.json";
import sr10Example from "../../generated/sr10-example.json";
import sr11Example from "../../generated/sr11-example.json";
import sr12Example from "../../generated/sr12-example.json";
import sr13Example from "../../generated/sr13-example.json";
import type { LabReference } from "../../reader/stack/stackStore.ts";
import { BM02_TAPE } from "../bm02/tape.ts";
import { LQ02_TAPE } from "../lq02/tape.ts";
import { LQ06_TAPE } from "../lq06/tape.ts";
import { LQ08_TAPE } from "../lq08/tape.ts";
import { LQ09_TAPE } from "../lq09/tape.ts";
import { ME01_TAPE } from "../me01/tape.ts";
import { ME02_TAPE } from "../me02/tape.ts";
import { ME03_TAPE } from "../me03/tape.ts";
import type { LabTapeBinding, TapeSession } from "../permalink/sessionTape.ts";
import { SR01_TAPE } from "../sr01/tape.ts";
import { SR02_TAPE } from "../sr02/tape.ts";
import { SR05_TAPE } from "../sr05/tape.ts";
import { SR06_TAPE } from "../sr06/tape.ts";
import { SR07_TAPE } from "../sr07/tape.ts";
import { SR08_TAPE } from "../sr08/tape.ts";
import { SR09_TAPE } from "../sr09/tape.ts";
import { SR10_TAPE } from "../sr10/tape.ts";
import { SR11_TAPE } from "../sr11/tape.ts";
import { SR12_TAPE } from "../sr12/tape.ts";
import { SR13_TAPE } from "../sr13/tape.ts";
import { checkpointJson } from "./instanceCheckpoint.ts";
import type { AcceptedSnapshot } from "./instanceStore.ts";
import {
  type CheckpointSession,
  captureReaderCheckpoint,
  createReaderCheckpointBinding,
  inspectReaderCheckpoint,
  MAX_READER_CHECKPOINT_BYTES,
  type ReaderCheckpointArchive,
  readerCheckpointDigest,
  restoreReaderCheckpoint,
} from "./readerCheckpoint.ts";

type Entry = Readonly<{
  tape: LabTapeBinding;
  sourceDigest: string;
  description?: Readonly<{
    before: Readonly<Record<string, number | string>>;
    after: Readonly<Record<string, number | string>>;
    revision: "observer" | "measurement";
  }>;
}>;

/** The same bindings and generated evaluator identities registered by the actual reader labs. */
const labs: readonly Entry[] = [
  { tape: BM02_TAPE, sourceDigest: sourceDigests["bm-02"] },
  {
    tape: LQ02_TAPE,
    sourceDigest: sourceDigests["lq-02"],
    description: {
      before: { probeFrequency: 2e13 },
      after: { probeFrequency: 3e13 },
      revision: "measurement",
    },
  },
  {
    tape: LQ06_TAPE,
    sourceDigest: lq06Example.sourceDigest,
    description: {
      before: { volumeRatio: 0.25 },
      after: { volumeRatio: 0.75 },
      revision: "measurement",
    },
  },
  {
    tape: LQ08_TAPE,
    sourceDigest: lq08Example.sourceDigest,
    description: {
      before: { collectorPotential: -0.5 },
      after: { collectorPotential: -0.7 },
      revision: "measurement",
    },
  },
  { tape: LQ09_TAPE, sourceDigest: lq09Example.sourceDigest },
  {
    tape: ME01_TAPE,
    sourceDigest: sourceDigests["me-01"],
    description: { before: { frameSpeed: 0.2 }, after: { frameSpeed: 0.4 }, revision: "observer" },
  },
  { tape: ME02_TAPE, sourceDigest: me02Example.sourceDigest },
  {
    tape: ME03_TAPE,
    sourceDigest: sourceDigests["me-03"],
    description: {
      before: { boundary: "radiation" },
      after: { boundary: "combined-isolated-system" },
      revision: "measurement",
    },
  },
  {
    tape: SR01_TAPE,
    sourceDigest: sourceDigests["sr-01"],
    description: { before: { frameBeta: 0.2 }, after: { frameBeta: 0.4 }, revision: "observer" },
  },
  { tape: SR02_TAPE, sourceDigest: sr02Example.sourceDigest },
  {
    tape: SR05_TAPE,
    sourceDigest: sr05Example.sourceDigest,
    description: {
      before: { frameOfDescription: 0.2 },
      after: { frameOfDescription: 0.4 },
      revision: "observer",
    },
  },
  { tape: SR06_TAPE, sourceDigest: sourceDigests["sr-06"] },
  { tape: SR07_TAPE, sourceDigest: sourceDigests["sr-07"] },
  { tape: SR08_TAPE, sourceDigest: sr08Example.sourceDigest },
  { tape: SR09_TAPE, sourceDigest: sr09Example.sourceDigest },
  { tape: SR10_TAPE, sourceDigest: sr10Example.sourceDigest },
  { tape: SR11_TAPE, sourceDigest: sr11Example.sourceDigest },
  { tape: SR12_TAPE, sourceDigest: sr12Example.sourceDigest },
  { tape: SR13_TAPE, sourceDigest: sr13Example.sourceDigest },
];

type ActualOwner = CheckpointSession &
  TapeSession &
  Readonly<{
    startNewRun(input: unknown): Readonly<{ kind: string }>;
  }>;

/** A missing forwarding method is a failed integration, never a substitute test owner. */
function create(entry: Entry, instanceId: string): ActualOwner {
  const candidate = entry.tape.createSession(instanceId);
  if (
    typeof candidate.startNewRun !== "function" ||
    !("exportCheckpoint" in candidate) ||
    typeof candidate.exportCheckpoint !== "function" ||
    !("restoreCheckpoint" in candidate) ||
    typeof candidate.restoreCheckpoint !== "function"
  )
    throw new Error(`${entry.tape.environment.experimentId} has no complete checkpoint owner API.`);
  return candidate as ActualOwner;
}

function dispose(owner: ActualOwner) {
  if (owner.disconnect) owner.disconnect();
  else owner.stop?.();
}

/** Numeric-view methods are owner-local closures; compare their exact data and all other fields. */
function acceptedData(snapshot: AcceptedSnapshot) {
  return {
    ...snapshot,
    outputs: snapshot.outputs.map((output) =>
      output.status === "value" && typeof output.value !== "number"
        ? { ...output, value: Array.from(output.value.copy()) }
        : output,
    ),
  };
}

function recorded(entry: Entry, parameters?: object) {
  const experimentId = entry.tape.environment.experimentId;
  const identity = {
    experimentId,
    instanceId: `instrument-view:${experimentId}`,
    sourceDigest: entry.sourceDigest,
  };
  expect(identity.sourceDigest).toMatch(/^source:sha256:[a-f0-9]{64}$/);
  const placement = JSON.stringify(["/papers/", "instrument-view", experimentId, "archive-lab"]);
  const binding = createReaderCheckpointBinding(entry.tape);
  const owner = create(entry, `${identity.instanceId}/retained-archive`);
  try {
    const initial = owner.getSnapshot().accepted;
    expect(owner.startNewRun(parameters ?? owner.acceptedParameters()).kind).toBe("accepted");
    expect(owner.startNewRun(owner.acceptedParameters()).kind).toBe("accepted");
    if (entry.description) {
      expect(owner.apply({ ...owner.acceptedParameters(), ...entry.description.before }).kind).toBe(
        "accepted",
      );
    }
    const accepted = owner.getSnapshot().accepted;
    if (!accepted) throw new Error("The real owner did not publish a complete checkpoint.");
    expect(accepted.runId).not.toBe(initial?.runId);
    expect(accepted.actionIndex).toBeGreaterThan(initial?.actionIndex ?? 0);
    expect(accepted.snapshotVersion).toBeGreaterThan(initial?.snapshotVersion ?? 0);
    const checkpoint = owner.exportCheckpoint();
    expect(checkpoint).not.toBeNull();
    const archive = captureReaderCheckpoint(binding, owner, identity, placement);
    if (!archive || !checkpoint)
      throw new Error(`${experimentId} could not archive its own complete accepted state.`);
    const reference: LabReference = {
      ...archive,
      experimentId,
      instanceId: accepted.instanceId,
      runId: accepted.runId,
      modelIdentity: identity.sourceDigest,
    };
    return { owner, identity, placement, binding, accepted, checkpoint, reference };
  } finally {
    // The restoration below must survive the old owner's disposal, not reuse its retained store.
    dispose(owner);
  }
}

function changedArchive(reference: LabReference, archive: ReaderCheckpointArchive): LabReference {
  return {
    ...reference,
    compactTape: checkpointJson(archive, MAX_READER_CHECKPOINT_BYTES),
    checkpointDigest: readerCheckpointDigest(archive),
  };
}

describe("the actual reader laboratories restore complete accepted owners", () => {
  for (const entry of labs) {
    const experimentId = entry.tape.environment.experimentId;
    test(`${experimentId} restores exact scientific data and continues its archived identities`, () => {
      const { owner, identity, placement, binding, accepted, checkpoint, reference } =
        recorded(entry);
      let visibleOwners = 0;
      const result = restoreReaderCheckpoint(binding, reference, identity, placement, (id) => {
        visibleOwners++;
        return create(entry, id);
      });
      expect(result.kind).toBe("restored");
      if (result.kind !== "restored") throw new Error(result.notice);
      const restored = result.session;
      try {
        expect(visibleOwners).toBe(1);
        expect(restored).not.toBe(owner);
        expect(result.instanceId).toBe(accepted.instanceId);
        const resumed = restored.getSnapshot().accepted;
        if (!resumed) throw new Error("The restored owner has no accepted result.");
        expect(acceptedData(resumed)).toEqual(acceptedData(accepted));
        expect(restored.acceptedParameters()).toEqual(accepted.parameters);
        expect(checkpointJson(restored.exportCheckpoint())).toBe(checkpointJson(checkpoint));

        if (entry.description) {
          expect(
            restored.apply({ ...restored.acceptedParameters(), ...entry.description.after }).kind,
          ).toBe("accepted");
          const described = restored.getSnapshot().accepted;
          expect(described?.runId).toBe(accepted.runId);
          expect(described?.parentRunId).toBe(accepted.parentRunId);
          expect(described?.revisions.input).toBe(accepted.revisions.input);
          expect(described?.revisions[entry.description.revision]).toBe(
            accepted.revisions[entry.description.revision] + 1,
          );
          expect(described?.actionIndex).toBe(accepted.actionIndex + 1);
          expect(described?.snapshotVersion).toBe(accepted.snapshotVersion + 1);
        }
        const previous = restored.getSnapshot().accepted;
        expect(restored.startNewRun(restored.acceptedParameters()).kind).toBe("accepted");
        const next = restored.getSnapshot().accepted;
        expect(next?.runId).toBe(
          `${accepted.instanceId}/run/${Number(accepted.runId.split("/").at(-1)) + 1}`,
        );
        expect(next?.parentRunId).toBe(previous?.runId);
        expect(next?.revisions.input).toBe((previous?.revisions.input ?? 0) + 1);
        expect(next?.actionIndex).toBe((previous?.actionIndex ?? 0) + 1);
        expect(next?.snapshotVersion).toBe((previous?.snapshotVersion ?? 0) + 1);
      } finally {
        dispose(restored);
      }
    });

    test(`${experimentId} refuses source and model corruption before creating a visible owner`, () => {
      const { identity, placement, binding, reference } = recorded(entry);
      const archive: ReaderCheckpointArchive = JSON.parse(reference.compactTape);
      const invalidSource = `source:sha256:${"0".repeat(64)}`;
      const candidates = [
        {
          reference: changedArchive(reference, { ...archive, sourceDigest: invalidSource }),
          notice: /source has changed/,
        },
        {
          reference: changedArchive(reference, {
            ...archive,
            tape: {
              ...archive.tape,
              modelIdentity: {
                ...archive.tape.modelIdentity,
                modelId: "incompatible-current-model",
              },
            },
          }),
          notice: /model/,
        },
      ];
      let visibleOwners = 0;
      for (const candidate of candidates) {
        const result = restoreReaderCheckpoint(
          binding,
          candidate.reference,
          identity,
          placement,
          (id) => {
            visibleOwners++;
            return create(entry, id);
          },
        );
        expect(result.kind).toBe("not-restored");
        if (result.kind === "not-restored") expect(result.notice).toMatch(candidate.notice);
      }
      expect(visibleOwners).toBe(0);
    });
  }
});

for (const { experimentId, constantSetId } of [
  { experimentId: "bm-02", constantSetId: "einstein-1905-brownian-printed" },
  { experimentId: "lq-06", constantSetId: "einstein-1905-light-quanta-printed" },
]) {
  test(`${experimentId} preserves its actual historical constants and refuses a relabeled archive`, () => {
    const entry = labs.find((lab) => lab.tape.environment.experimentId === experimentId);
    if (!entry) throw new Error("The historical laboratory is not registered in this test.");
    const parameters = { ...entry.tape.defaults, constantSetId };
    const { identity, placement, binding, accepted, reference } = recorded(entry, parameters);
    const archive = inspectReaderCheckpoint(binding, reference, identity, placement);
    expect(archive.tape.constantSetId).toBe(constantSetId);
    expect(archive.checkpoint.accepted.parameters.constantSetId).toBe(constantSetId);
    const modern = create(entry, `${experimentId}-modern-comparison`);
    try {
      expect(modern.apply({ ...accepted.parameters, constantSetId: "modern-si-2019" }).kind).toBe(
        "accepted",
      );
      const defaultResult = modern.getSnapshot().accepted;
      if (!defaultResult) throw new Error("The default scientific owner has no output.");
      expect(acceptedData(accepted).outputs).not.toEqual(acceptedData(defaultResult).outputs);
    } finally {
      dispose(modern);
    }
    const result = restoreReaderCheckpoint(binding, reference, identity, placement, (id) =>
      create(entry, id),
    );
    expect(result.kind).toBe("restored");
    if (result.kind !== "restored") throw new Error(result.notice);
    try {
      const resumed = result.session.getSnapshot().accepted;
      if (!resumed) throw new Error("The historical result was not accepted.");
      expect(acceptedData(resumed)).toEqual(acceptedData(accepted));
      expect(result.session.acceptedParameters()).toEqual(accepted.parameters);
    } finally {
      dispose(result.session);
    }
    const mislabeled = changedArchive(reference, {
      ...archive,
      tape: { ...archive.tape, constantSetId: "modern-si-2019" },
    });
    let created = false;
    const refused = restoreReaderCheckpoint(binding, mislabeled, identity, placement, (id) => {
      created = true;
      return create(entry, id);
    });
    expect(refused.kind).toBe("not-restored");
    if (refused.kind === "not-restored") expect(refused.notice).toContain("constant set");
    expect(created).toBe(false);
  });
}
