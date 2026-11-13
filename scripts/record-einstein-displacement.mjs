/**
 * Refresh the source-bound receipts of Einstein's authored Brownian walkthrough.
 * Run after prepare:lab with the declared recorder: bun scripts/record-einstein-displacement.mjs
 *
 * No content is written. The real pinned FrankenSim worker must reproduce the authored values,
 * complete recording and stream positions, and both original event prefixes must replay before
 * replacement receipts are printed. Keep this outside the tracer evaluator's source closure.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "../src/content/provenance/yaml.ts";
import { BM01_DEFAULTS } from "../src/experiments/bm01/definition.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../src/experiments/permalink/codec.ts";
import { permalinkTapeFromControlTape } from "../src/experiments/permalink/fromControlTape.ts";
import { checkpointPrefixes } from "../src/experiments/permalink/walkthroughCheckpoints.ts";
import { restoreWorkerTape } from "../src/experiments/permalink/workerSessionTape.ts";
import { validateControlTape } from "../src/experiments/tapes/schema.ts";
import {
  bm01Laboratory,
  bm01ReplayFixture,
  recordBm01Checkpoints,
} from "../src/testing/bm01ReplayHarness.ts";

/** Refresh identities only after checking the actual accepted scientific evidence. */
export async function recordEinsteinDisplacement(record) {
  assert.equal(process.versions.bun, "1.4.0", "Use the declared Bun 1.4.0 recorder.");
  assert.equal(record.tapeId, "einstein-0-8-micron");
  assert.equal(record.experimentId, "bm-01");
  assert.equal(record.mode, "bm-01:default");
  assert.equal(record.constantSetId, "einstein-1905-brownian-printed");
  assert.deepEqual(Object.keys(record.initialConditions).sort(), Object.keys(BM01_DEFAULTS).sort());
  assert.equal(record.initialConditions.interval, 0);
  assert.deepEqual(
    record.events.map(({ kind, actionIndex, commandClass, parameterId, value, previousValue }) => ({
      kind,
      actionIndex,
      commandClass,
      parameterId,
      value,
      previousValue,
    })),
    [1, 60].map((value, index) => ({
      kind: "control",
      actionIndex: index + 1,
      commandClass: "measurement-change",
      parameterId: "interval",
      value,
      previousValue: index === 0 ? 0 : 1,
    })),
  );
  assert.deepEqual(
    record.checkpoints.map(({ actionIndex }) => actionIndex),
    [1, 2],
  );
  const fixture = await bm01ReplayFixture();
  const artifactDigest = fixture.sourceDigest.replace(/^source:/, "host:");
  const stops = await recordBm01Checkpoints(fixture, record.initialConditions, [1, 60]);
  const prefixes = checkpointPrefixes(record);
  assert.equal(stops.length, prefixes.length);
  const replay = bm01Laboratory(fixture);
  const receipts = [];
  try {
    for (const [index, stop] of stops.entries()) {
      const prefix = prefixes[index];
      const checkpoint = record.checkpoints[index];
      assert.ok(prefix && checkpoint);
      const converted = permalinkTapeFromControlTape(prefix.record);
      assert.equal(converted.kind, "converted");
      assert.deepEqual(stop.tape.initialConditions, converted.tape.initialConditions);
      assert.deepEqual(
        stop.tape.acceptedCheckpoint.scientificState,
        converted.tape.acceptedCheckpoint.scientificState,
        "The full recording grid, seed and every stream position must stay unchanged.",
      );
      assert.equal(stop.publication.parameters.interval, index === 0 ? 1 : 60);
      assert.ok(checkpoint.expectedDisplayValues?.length > 0, "Each stop needs authored values.");
      const values = checkpoint.expectedDisplayValues.map((expected) => {
        const output = stop.publication.outputs.find(
          (entry) => entry.quantityId === expected.outputId,
        );
        assert.ok(output, expected.outputId);
        assert.equal(output.status, "value", expected.outputId);
        assert.equal(output.value, expected.value, expected.label);
        assert.equal(output.unit, expected.unit, expected.label);
        assert.equal(stop.publication.parameters.constantSetId, expected.constantSetId);
        return { outputId: expected.outputId, value: output.value, unit: output.unit };
      });
      const { teachingTapeRef: _reference, ...original } = converted.tape;
      const tape = {
        ...original,
        modelIdentity: { ...original.modelIdentity, artifactDigest },
        acceptedCheckpoint: {
          ...original.acceptedCheckpoint,
          digest: stop.tape.acceptedCheckpoint.digest,
        },
      };
      const decoded = decodeTapePermalink(encodeTapePermalink(tape));
      assert.equal(decoded.kind, "success");
      const restored = await restoreWorkerTape(replay.binding, replay.session, decoded.tape);
      assert.equal(
        restored.kind,
        "restored",
        restored.kind === "not-restored" ? restored.notice : undefined,
      );
      receipts.push({
        actionIndex: checkpoint.actionIndex,
        digest: tape.acceptedCheckpoint.digest,
        values,
      });
    }
    return { artifactDigest, checkpoints: receipts };
  } finally {
    replay.session.disconnect();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = new URL("../content/experiments/tapes/einstein-0-8-micron.yaml", import.meta.url);
  const record = validateControlTape(parseYaml(await readFile(path, "utf8")));
  console.log(JSON.stringify(await recordEinsteinDisplacement(record), null, 2));
}
