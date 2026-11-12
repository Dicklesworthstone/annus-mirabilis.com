import { describe, expect, test } from "bun:test";
import labDigests from "../../generated/lab-source-digests.json";
import type { LabReference } from "../../reader/stack/stackStore.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../permalink/codec.ts";
import { restoreTape, tapeForSettings } from "../permalink/sessionTape.ts";
import { checkpointJson } from "../store/instanceCheckpoint.ts";
import {
  readerCheckpointDigest,
  type ReaderCheckpointArchive,
} from "../store/readerCheckpoint.ts";
import { SHELF_DEFINITIONS, SHELF_IDS, type ShelfId, type ShelfParameters } from "./definition.ts";
import { evaluateShelfOptics } from "./evaluation.ts";
import { createShelfOpticsSession } from "./session.ts";
import { SHELF_READER_CHECKPOINTS, SHELF_TAPES } from "./tape.ts";

function changed(id: ShelfId): ShelfParameters {
  const defaults = SHELF_DEFINITIONS[id].defaults;
  return defaults.instrumentId === "shelf-fizeau"
    ? { ...defaults, waterSpeed: -11, reversal: true, showLater: true }
    : { ...defaults, beta: -0.23 };
}

describe("portable optical shelf experiments", () => {
  for (const id of SHELF_IDS) {
    test(`${id} restores all accepted metrics and identity into a fresh reader owner`, () => {
      const example = evaluateShelfOptics(SHELF_DEFINITIONS[id].defaults);
      const owner = createShelfOpticsSession(`${id}/retained`, example);
      expect(owner.apply(changed(id)).kind).toBe("accepted");
      const accepted = owner.getSnapshot();
      const checkpoint = owner.exportCheckpoint();
      expect(checkpoint).not.toBeNull();
      const identity = {
        experimentId: id,
        instanceId: `${id}:reader`,
        sourceDigest: labDigests[id],
      };
      const binding = SHELF_READER_CHECKPOINTS[id];
      const archive = binding.capture(owner, identity, "relativity:comparison");
      if (!archive || !checkpoint || !accepted.accepted) throw new Error("Missing checkpoint.");
      const reference: LabReference = {
        experimentId: id,
        instanceId: accepted.accepted.instanceId,
        modelIdentity: labDigests[id],
        runId: accepted.accepted.runId,
        ...archive,
      };
      const restored = binding.restore(reference, identity, "relativity:comparison", (instanceId) =>
        createShelfOpticsSession(instanceId, example),
      );
      expect(restored.kind).toBe("restored");
      if (restored.kind !== "restored") throw new Error(restored.notice);
      expect(restored.session.getSnapshot().comparison).toEqual(accepted.comparison);
      expect(checkpointJson(restored.session.exportCheckpoint())).toBe(checkpointJson(checkpoint));
      expect(restored.session.acceptedParameters()).toEqual(changed(id));
      const next = SHELF_DEFINITIONS[id].defaults;
      expect(restored.session.apply(next).kind).toBe("accepted");
      expect(restored.session.getSnapshot().accepted?.parentRunId).toBe(accepted.accepted.runId);
      expect(restored.session.getSnapshot().comparison.revision).toBe(
        accepted.comparison.revision + 1,
      );

      const wrongSource = { ...identity, sourceDigest: `source:sha256:${"0".repeat(64)}` };
      expect(
        binding.restore(reference, wrongSource, "relativity:comparison", (instanceId) =>
          createShelfOpticsSession(instanceId, example),
        ).kind,
      ).toBe("not-restored");
      expect(
        binding.restore(reference, identity, "a-different-passage", (instanceId) =>
          createShelfOpticsSession(instanceId, example),
        ).kind,
      ).toBe("not-restored");

      const forged: ReaderCheckpointArchive = JSON.parse(reference.compactTape);
      const output = JSON.parse(forged.checkpoint.accepted.outputs[0] as string);
      output.value.values[0] += 1;
      const altered = {
        ...forged,
        checkpoint: {
          ...forged.checkpoint,
          accepted: { ...forged.checkpoint.accepted, outputs: [JSON.stringify(output)] },
        },
      };
      const forgedReference = {
        ...reference,
        compactTape: checkpointJson(altered),
        checkpointDigest: readerCheckpointDigest(altered),
      };
      expect(
        binding.restore(forgedReference, identity, "relativity:comparison", (instanceId) =>
          createShelfOpticsSession(instanceId, example),
        ).kind,
      ).toBe("not-restored");
    });

    test(`${id} shares exact settings, including booleans, through the existing bounded codec`, () => {
      const binding = SHELF_TAPES[id];
      const parameters = changed(id);
      const tape = tapeForSettings(binding, parameters);
      if (!tape) throw new Error("Missing shelf tape.");
      const encoded = encodeTapePermalink(tape);
      const decoded = decodeTapePermalink(encoded);
      if (decoded.kind !== "success") throw new Error("Shelf tape did not decode.");
      const owner = createShelfOpticsSession(
        `${id}/shared`,
        evaluateShelfOptics(binding.defaults as ShelfParameters),
      );
      expect(restoreTape(binding, owner, decoded.tape).kind).toBe("restored");
      expect(owner.acceptedParameters()).toEqual(parameters);
      expect(owner.getSnapshot().comparison.report).toEqual(evaluateShelfOptics(parameters));
      const current = owner.getSnapshot();
      const incompatible = {
        ...tape,
        modelIdentity: {
          ...tape.modelIdentity,
          artifactDigest: `host:sha256:${"0".repeat(64)}`,
        },
      };
      expect(restoreTape(binding, owner, incompatible).kind).toBe("not-restored");
      expect(owner.getSnapshot()).toBe(current);
      expect(owner.startNewRun(parameters).kind).toBe("accepted");
      expect(owner.getSnapshot().accepted?.runId).not.toBe(current.accepted?.runId);
      expect(owner.getSnapshot().comparison.report).toEqual(current.comparison.report);
    });
  }

  test("checkpoint import publishes the report atomically and refuses nested or active-owner replacement", () => {
    const id = "shelf-fizeau";
    const example = evaluateShelfOptics(SHELF_DEFINITIONS[id].defaults);
    const old = createShelfOpticsSession("fizeau-restoration", example);
    expect(old.apply(changed(id)).kind).toBe("accepted");
    const checkpoint = old.exportCheckpoint();
    const fresh = createShelfOpticsSession("fizeau-restoration", example);
    const nested: string[] = [];
    const unsubscribe = fresh.subscribe(() => {
      expect(fresh.getSnapshot().accepted?.parameters).toEqual(
        fresh.getSnapshot().comparison.report.parameters,
      );
      nested.push(fresh.apply(SHELF_DEFINITIONS[id].defaults).kind);
      nested.push(fresh.restoreCheckpoint(checkpoint).kind);
    });
    expect(fresh.restoreCheckpoint(checkpoint).kind).toBe("restored");
    expect(nested).toEqual(["refused", "not-restored"]);
    unsubscribe();
    const accepted = fresh.getSnapshot();
    expect(fresh.restoreCheckpoint(checkpoint).kind).toBe("not-restored");
    expect(fresh.getSnapshot()).toBe(accepted);
    expect(fresh.apply({ ...changed(id), waterSpeed: "1e500" }).kind).toBe("refused");
    expect(fresh.getSnapshot()).toBe(accepted);
  });
});
