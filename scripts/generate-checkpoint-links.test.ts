import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadWalkthroughCatalogue } from "../src/content/walkthroughs.ts";
import type { CheckpointLaunchStop } from "../src/experiments/permalink/checkpointLaunches.ts";
import {
  decodeTapePermalink,
  MAX_PERMALINK_URL_LENGTH,
} from "../src/experiments/permalink/codec.ts";
import { settingsFromTape } from "../src/experiments/permalink/sessionTape.ts";
import {
  readWalkthroughLocation,
  resolveWalkthroughLocation,
  WALKTHROUGH_URL_LIMIT,
} from "../src/experiments/permalink/walkthroughLocation.ts";
import { buildCheckpointLinks } from "./generate-checkpoint-links.ts";
import { DRAFT_BINDINGS, SESSION_BINDINGS } from "./generate-tape-links.ts";

test("every recorded stop is retained and every ready link carries that stop's actual owner-accepted settings", () => {
  const source = loadWalkthroughCatalogue();
  const generated = buildCheckpointLinks();
  assert.equal(WALKTHROUGH_URL_LIMIT, MAX_PERMALINK_URL_LENGTH);
  assert.ok(source.walkthroughs.length > 0, "the corpus must not be empty");
  assert.deepEqual(generated.problems, source.problems);
  assert.deepEqual(
    generated.walkthroughs.map((entry) => entry.tapeId),
    source.walkthroughs.map((entry) => entry.tapeId),
  );
  let stops = 0;
  let ready = 0;
  let multiStop = false;
  for (const walkthrough of source.walkthroughs) {
    const generatedWalkthrough = generated.walkthroughs.find(
      (entry) => entry.tapeId === walkthrough.tapeId,
    );
    assert.ok(generatedWalkthrough);
    assert.deepEqual(
      generatedWalkthrough.stops.map((stop) => stop.actionIndex),
      walkthrough.checkpoints.map((stop) => stop.actionIndex),
    );
    multiStop ||= walkthrough.checkpoints.length > 1;
    for (const [index, checkpoint] of walkthrough.checkpoints.entries()) {
      stops++;
      const stop: CheckpointLaunchStop | undefined = generatedWalkthrough.stops[index];
      assert.ok(stop);
      assert.equal(stop.label, checkpoint.label);
      const launch = stop.launch;
      if (launch.status === "unavailable") {
        assert.ok(launch.reason.trim(), "unsupported stops need a reason, not silent omission");
        continue;
      }
      ready++;
      assert.ok(launch.href.length <= MAX_PERMALINK_URL_LENGTH);
      const location = readWalkthroughLocation(
        new URL(launch.href, "https://annus-mirabilis.com").search,
      );
      assert.ok(location.kind === "selected");
      const selected = resolveWalkthroughLocation(
        location.selection,
        walkthrough.experimentId,
        source,
      );
      assert.ok(selected.kind === "selected");
      assert.equal(selected.index, index);
      const decoded = decodeTapePermalink(launch.href);
      assert.ok(decoded.kind === "success", JSON.stringify(decoded));
      const binding =
        SESSION_BINDINGS[walkthrough.experimentId] ?? DRAFT_BINDINGS[walkthrough.experimentId];
      assert.ok(binding, "a ready link requires an implemented player binding");
      assert.equal(decoded.tape.experimentId, binding.environment.experimentId);
      assert.equal(decoded.tape.modelIdentity.modelId, binding.environment.modelId);
      assert.equal(decoded.tape.modelIdentity.modelVersion, binding.environment.modelVersion);
      assert.deepEqual(
        decoded.tape.events,
        [],
        "these are fresh settings runs, not relabelled historical replays",
      );
      assert.equal(decoded.tape.teachingTapeRef, undefined);
      const expected = settingsFromTape(checkpoint.settings, binding.defaults);
      const observed = settingsFromTape(decoded.tape.initialConditions, binding.defaults);
      assert.equal(binding.validate({ ...binding.defaults, ...expected }).kind, "accepted");
      for (const [key, value] of Object.entries(expected)) {
        assert.deepEqual(
          observed[key],
          value,
          `${walkthrough.tapeId} action ${checkpoint.actionIndex}: ${key}`,
        );
      }
    }
  }
  assert.ok(multiStop, "exercise more than initial states");
  assert.ok(ready > 0, "a generator that refuses every stop does not provide this feature");
  console.log(
    `checkpoint links: ${ready} ready / ${stops} recorded stops in ${source.walkthroughs.length} walkthroughs`,
  );
});

test("the normal prepare lane creates the public data before the route imports it", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const steps = pkg.scripts["prepare:lab"].split("&&").map((step: string) => step.trim());
  const generator = steps.indexOf("bun scripts/generate-checkpoint-links.ts");
  assert.ok(generator > steps.indexOf("bun scripts/generate-tape-links.ts"));
  assert.ok(generator > steps.indexOf("bun scripts/generate-capstone-links.ts"));
  assert.ok(generator >= 0);
});
