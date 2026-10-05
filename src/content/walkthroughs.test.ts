import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ME01_TAPE } from "../experiments/me01/tape.ts";
import { restoreTape } from "../experiments/permalink/sessionTape.ts";
import { validateTapeV2 } from "../experiments/permalink/schema.ts";
import { validateControlTape } from "../experiments/tapes/schema.ts";
import { parseYaml } from "./provenance/yaml.ts";
import { loadWalkthroughCatalogue } from "./walkthroughs.ts";

// Real corpus integration, not a fixture with the answer supplied by a test converter.
const catalogue = loadWalkthroughCatalogue();

test("the checkpoint catalogue retains every authored stop, including unconvertible stops", () => {
  assert.deepEqual(catalogue.problems, []);
  const dir = join(process.cwd(), "content", "experiments", "tapes");
  const files = readdirSync(dir).filter((file) => file.endsWith(".yaml"));
  assert.ok(files.length > 0);
  let convertible = 0;
  for (const file of files) {
    const record = validateControlTape(parseYaml(readFileSync(join(dir, file), "utf8")), file);
    const walkthrough = catalogue.walkthroughs.find((entry) => entry.tapeId === record.tapeId);
    assert.ok(walkthrough, file);
    assert.equal(walkthrough.checkpoints.length, record.checkpoints.length, file);
    for (const [index, checkpoint] of walkthrough.checkpoints.entries()) {
      const original = record.checkpoints[index];
      assert.ok(original);
      assert.equal(checkpoint.actionIndex, original.actionIndex);
      if (!checkpoint.tape) {
        assert.ok(checkpoint.unavailable, `${file}: a refusal must have a reason`);
        continue;
      }
      convertible++;
      validateTapeV2(checkpoint.tape);
      assert.equal(checkpoint.tape.teachingTapeRef, undefined);
      assert.equal(checkpoint.tape.acceptedCheckpoint.digest, original.digest);
      assert.ok(checkpoint.tape.events.every((event) => event.actionIndex <= original.actionIndex));
    }
  }
  assert.ok(convertible > 0, "The wire validation above must examine real checkpoint requests.");
});

test("ME-01 seeks to every authored stop in both directions through its real session", () => {
  const walkthrough = catalogue.walkthroughs.find((entry) => entry.tapeId === "the-two-pulses");
  assert.ok(walkthrough);
  assert.ok(walkthrough.checkpoints.length > 1);
  const session = ME01_TAPE.createSession("checkpoint-walkthrough-roundtrip");
  const stops = [...walkthrough.checkpoints, ...walkthrough.checkpoints.toReversed()];
  for (const stop of stops) {
    assert.ok(stop.tape);
    assert.equal(restoreTape(ME01_TAPE, session, stop.tape).kind, "restored", stop.label);
    const actual = session.acceptedParameters() as Record<string, unknown>;
    for (const [key, value] of Object.entries(stop.settings)) assert.equal(actual[key], value, key);
  }
});

test("an altered checkpoint is refused without replacing the reader's accepted snapshot", () => {
  const walkthrough = catalogue.walkthroughs.find((entry) => entry.tapeId === "the-two-pulses");
  const tape = walkthrough?.checkpoints.at(-1)?.tape;
  assert.ok(tape);
  const session = ME01_TAPE.createSession("checkpoint-walkthrough-refusal");
  const before = session.getSnapshot().accepted;
  const result = restoreTape(ME01_TAPE, session, {
    ...tape,
    acceptedCheckpoint: { ...tape.acceptedCheckpoint, digest: "host:0000000000000000" },
  });
  assert.equal(result.kind, "not-restored");
  assert.equal(session.getSnapshot().accepted, before);
});
