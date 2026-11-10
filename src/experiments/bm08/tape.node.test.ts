import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { loadWalkthroughCatalogue } from "../../content/walkthroughs.ts";
import { bm08Laboratory, bm08ReplayFixture } from "../../testing/bm08ReplayHarness.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../permalink/codec.ts";
import { restoreWorkerTape } from "../permalink/workerSessionTape.ts";
import { validateControlTape } from "../tapes/schema.ts";

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
