import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { evaluatorSources } from "../../../scripts/generate-observation.mjs";
import { BM08_DEFAULTS } from "./definition.ts";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { loadWalkthroughCatalogue } from "../../content/walkthroughs.ts";
import { bm08Laboratory, bm08ReplayFixture } from "../../testing/bm08ReplayHarness.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../permalink/codec.ts";
import { restoreWorkerTape } from "../permalink/workerSessionTape.ts";
import { validateControlTape } from "../tapes/schema.ts";

// Exact host arithmetic belongs to the declared Node/V8 lane; Bun records runtime-local trials.
const sourceHash = createHash("sha256");
for (const [path, source] of await evaluatorSources())
  sourceHash.update(path + "\0" + Buffer.byteLength(source) + "\0").update(source);
const sourceDigest = "source:sha256:" + sourceHash.digest("hex");
const authoredCameraRecord = validateControlTape(
  parseYaml(
    readFileSync(
      new URL("../../../content/experiments/tapes/camera-bias.yaml", import.meta.url),
      "utf8",
    ),
  ),
);

// Diagnose a stale source-bound record without replacing it or relaxing the original replay.
if (authoredCameraRecord.modelIdentity.artifactDigest !== sourceDigest.replace(/^source:/, "host:")) {
  const { recordCameraBias } = await import("../../../scripts/record-camera-bias.mjs");
  console.log(JSON.stringify(await recordCameraBias(authoredCameraRecord)));
}

test("the authored camera exercise identifies its complete current evaluator source", () => {
  assert.equal(
    authoredCameraRecord.modelIdentity.artifactDigest,
    sourceDigest.replace(/^source:/, "host:"),
  );
  assert.equal(authoredCameraRecord.mode, "bm-08:default");
  assert.equal(authoredCameraRecord.constantSetId, "modern-si-2019");
  assert.equal(authoredCameraRecord.allocationId, "bm-08.latent.v1");
  assert.match(authoredCameraRecord.description ?? "", /synthetic/);
  assert.deepEqual(
    Object.keys(authoredCameraRecord.initialConditions).sort(),
    Object.keys(BM08_DEFAULTS).sort(),
  );
});

test("all three authored camera checkpoints restore their exact observations under the recorded V8 owner", async () => {
  const fixture = await bm08ReplayFixture();
  const lab = bm08Laboratory(fixture);
  const record = validateControlTape(
    parseYaml(
      readFileSync(
        new URL("../../../content/experiments/tapes/camera-bias.yaml", import.meta.url),
        "utf8",
      ),
    ),
  );
  const walkthrough = loadWalkthroughCatalogue().walkthroughs.find(
    (entry) => entry.tapeId === "camera-bias",
  );
  assert.ok(walkthrough);
  assert.equal(walkthrough.checkpoints.length, 3);
  try {
    for (const checkpoint of walkthrough.checkpoints) {
      assert.ok(checkpoint.tape);
      const encoded = encodeTapePermalink(checkpoint.tape);
      assert.ok(`/lab/bm-08/?tape=${encoded}`.length <= 2048);
      const decoded = decodeTapePermalink(encoded);
      assert.equal(decoded.kind, "success");
      const outcome = await restoreWorkerTape(lab.binding, lab.session, decoded.tape);
      assert.equal(outcome.kind, "restored", JSON.stringify(outcome));
      const accepted = lab.session.getSnapshot().accepted;
      assert.ok(accepted);
      const expected = record.checkpoints
        .find((entry) => entry.actionIndex === checkpoint.actionIndex)
        ?.expectedDisplayValues?.find((entry) => entry.outputId === "naiveExpectation");
      const actual = accepted.outputs.find((entry) => entry.quantityId === "naiveExpectation");
      assert.ok(expected && actual?.status === "value");
      assert.equal(actual.value, expected.value);
    }
  } finally {
    lab.session.disconnect();
  }
});
