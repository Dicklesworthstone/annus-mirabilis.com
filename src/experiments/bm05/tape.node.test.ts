/**
 * Authored checkpoints were recorded with the pinned Node 22 V8 evaluator. Host transcendental
 * functions can differ by a binary64 ULP in other engines; exact replay deliberately refuses
 * those results. The Bun suite separately proves that refusal and tests lifecycle behavior with
 * real local worker recordings. This lane proves every authored checkpoint actually reproduces.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { loadWalkthroughCatalogue } from "../../content/walkthroughs.ts";
import { bm05Laboratory, bm05ReplayFixture } from "../../testing/bm05ReplayHarness.ts";
import {
  decodeTapePermalink,
  encodeTapePermalink,
  MAX_PERMALINK_URL_LENGTH,
} from "../permalink/codec.ts";
import type { TapeV2 } from "../permalink/types.ts";
import { restoreWorkerTape, type WorkerTapeSession } from "../permalink/workerSessionTape.ts";
import { validateControlTape } from "../tapes/schema.ts";
import type { Bm05Parameters } from "./definition.ts";
import { createBm05WalkthroughTarget } from "./tape.ts";

function scalar(session: WorkerTapeSession, id: string): number {
  const value = session.getSnapshot().accepted?.outputs.find((output) => output.quantityId === id);
  assert.ok(value?.status === "value" && typeof value.value === "number", id);
  return value.value;
}

test("all six authored stops reproduce real walk results forward, backward and from a warm cache", {
  timeout: 120_000,
}, async () => {
  const fixture = await bm05ReplayFixture();
  const record = validateControlTape(
    parseYaml(
      readFileSync(
        new URL("../../../content/experiments/tapes/coin-to-bell.yaml", import.meta.url),
        "utf8",
      ),
    ),
  );
  const walkthrough = loadWalkthroughCatalogue().walkthroughs.find(
    (entry) => entry.tapeId === record.tapeId,
  );
  assert.ok(walkthrough);
  assert.equal(walkthrough.checkpoints.length, 6);
  const lab = bm05Laboratory(fixture);
  try {
    createBm05WalkthroughTarget(lab.binding, lab.session, () => {});
    assert.equal(lab.channels.length, 0);
    let coinRun: string | undefined;
    let firstCoordinates: Float64Array | undefined;
    for (const stop of [0, 1, 2, 3, 4, 5, 0, 1]) {
      const tape: TapeV2 | null | undefined = walkthrough.checkpoints[stop]?.tape;
      assert.ok(tape);
      assert.equal(
        tape.modelIdentity.artifactDigest,
        fixture.sourceDigest.replace(/^source:/, "host:"),
      );
      const href = `/lab/bm-05/?tape=${encodeTapePermalink(tape)}`;
      assert.ok(href.length <= MAX_PERMALINK_URL_LENGTH);
      const decoded = decodeTapePermalink(href);
      assert.ok(decoded.kind === "success");
      assert.deepEqual(decoded.tape, tape);
      assert.deepEqual(await restoreWorkerTape(lab.binding, lab.session, decoded.tape), {
        kind: "restored",
      });
      const accepted = lab.session.getSnapshot().accepted;
      assert.ok(accepted?.final);
      const p = lab.session.acceptedParameters() as Bm05Parameters;
      assert.equal(p.n, [4, 16, 64, 400, 400, 400][stop]);
      assert.equal(p.kernel, stop < 4 ? "coin" : stop === 4 ? "uniform" : "gaussian");
      assert.equal(scalar(lab.session, "modelRms"), Math.sqrt(p.n * p.stepRms * p.stepRms));
      assert.equal(scalar(lab.session, "recordingDraws"), stop === 5 ? 1_600_000 : 800_000);
      assert.equal(tape.acceptedCheckpoint.scientificState?.streamPositions.length, 2000);
      assert.equal(
        tape.acceptedCheckpoint.scientificState?.streamPositions[1999]?.index,
        stop === 5 ? "800" : "400",
      );
      for (const display of record.checkpoints[stop]?.expectedDisplayValues ?? []) {
        assert.ok(display.outputId);
        assert.equal(scalar(lab.session, display.outputId), display.value);
      }
      if (stop === 0) {
        coinRun = accepted.runId;
        const positions = accepted.outputs.find((output) => output.quantityId === "walkPositions");
        assert.ok(positions?.status === "value" && typeof positions.value !== "number");
        const coordinates = positions.value.copy();
        if (firstCoordinates) assert.deepEqual(coordinates, firstCoordinates);
        firstCoordinates = coordinates;
      } else if (stop < 4) {
        assert.equal(accepted.runId, coinRun);
        assert.equal(scalar(lab.session, "reusedRecording"), 1);
      }
    }
  } finally {
    lab.session.disconnect();
  }
});
