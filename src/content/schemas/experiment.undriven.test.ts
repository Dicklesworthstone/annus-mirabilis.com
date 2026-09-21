/**
 * The four refusal sites in experiment.ts that survived deletion (am-kd9h).
 *
 * METHOD. Each of the file's 224 `throw new ExperimentValidationError(...)` statements was rewritten
 * to `void new ...` one at a time and the 56 test files that import this module were run against the
 * result. Two hundred and twenty turned red. These four did not.
 *
 * Note the direction: the survey that sent me here expected six. Planting found four. Citation can
 * under-credit as well as over-credit, because a test can drive a refusal without ever naming its
 * code, and two of the six had exactly that kind of cover.
 *
 * Every test below starts from the committed fixtures the rest of this suite uses -
 * __fixtures__/experiment/experiment-valid.yaml and tour-valid.yaml - and changes one field. A
 * hand-built object would pass or fail for reasons that have nothing to do with the site under test.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ExperimentValidationError,
  validateActionContract,
  validateExperiment,
  validateTour,
} from "./experiment.ts";
import { strictParse } from "./strictParse.ts";

const FIXTURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "__fixtures__/experiment",
);

/** Fixture records are deliberately loose: their shape is what the validator under test decides. */
// biome-ignore-start: intentionally none - noExplicitAny is not enabled here, so a suppression would be a comment claiming to silence a rule that never fires
function fixture(name: string): any {
  return strictParse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"), "yaml");
}

function refuses(
  run: () => unknown,
  expected: { code: string; path: string; message?: string },
): ExperimentValidationError {
  let caught: unknown;
  try {
    run();
  } catch (err) {
    caught = err;
  }
  if (!(caught instanceof ExperimentValidationError)) {
    assert.fail(`Expected ExperimentValidationError, got ${String(caught)}`);
  }
  assert.equal(caught.code, expected.code);
  assert.ok(
    String(caught.path).endsWith(expected.path),
    `path ${caught.path} should end with ${expected.path}`,
  );
  if (expected.message) {
    assert.ok(
      caught.message.includes(expected.message),
      `message ${JSON.stringify(caught.message)} should contain ${JSON.stringify(expected.message)}`,
    );
  }
  return caught;
}

test("THE CONTROL: both fixtures validate unchanged, so each refusal below is about its own delta", () => {
  assert.equal(validateExperiment(fixture("experiment-valid.yaml")).id, "bm-01");
  assert.equal(validateTour(fixture("tour-valid.yaml")).id, "tour-brownian-overview");
});

test("(experiment.ts:420) invalid-accepted-result: an action must declare what an accepted result is", () => {
  const raw = fixture("experiment-valid.yaml");
  const action = { ...raw.actions[0] };
  delete action.acceptedResult;
  refuses(() => validateActionContract(action), {
    code: "invalid-accepted-result",
    path: ".acceptedResult",
    message: "must be an object declaring outputs and allowedStatuses",
  });

  // A present-but-scalar acceptedResult reaches the same site: the refusal is about the shape that
  // carries outputs and statuses, not about the key being absent.
  refuses(() => validateActionContract({ ...raw.actions[0], acceptedResult: "value" }), {
    code: "invalid-accepted-result",
    path: ".acceptedResult",
  });

  // Unmodified, the same action is accepted, which is what makes the two refusals above statements
  // about acceptedResult rather than about the fixture.
  assert.equal(validateActionContract(raw.actions[0]).actionId, "sample-displacement");
});

/**
 * (experiment.ts:1211) all-views-require-capabilities is UNREACHABLE, and this test says so instead
 * of pretending to cover it.
 *
 * It survived deletion for a reason stronger than "no test drives it": no input can drive it. The
 * five view kinds each constrain `requires` in a way that decides the two booleans above the site:
 *
 *   svg, table, text  MUST NOT declare requires  -> each one sets hasNoRequiresView = true
 *   canvas            MUST declare ["canvas-2d"] -> sets hasCanvasOrThree = true
 *   three             MUST declare ["webgl"]     -> sets hasCanvasOrThree = true
 *
 * So hasNoRequiresView is false only when every view is canvas or three, and in exactly that case
 * hasTableOrText is false too, which throws canvas-or-three-missing-fallback-view six lines earlier.
 * The guard at :1211 can never be the one that fires.
 *
 * Writing a test that "covers" it would mean reaching it through some other kind, and there is no
 * other kind. Below is the whole space rather than an argument about it: all 31 non-empty subsets of
 * the five kinds, each given the only `requires` its kind permits. If a later change makes the site
 * reachable - a sixth view kind, a reordering of the two guards, a relaxed capability rule - this
 * test goes red and the site becomes ordinary untested code that someone should then drive.
 *
 * The repair is the owner's call, not mine: delete the site, or order it before the fallback check
 * so it can speak. Recorded on am-kd9h.
 */
test("(experiment.ts:1211) all-views-require-capabilities cannot fire for any of the 31 view-kind sets", () => {
  const KINDS = ["svg", "canvas", "three", "table", "text"] as const;
  const legalRequires = (kind: string): string[] =>
    kind === "canvas" ? ["canvas-2d"] : kind === "three" ? ["webgl"] : [];

  const outcomes = new Map<string, string>();
  for (let mask = 1; mask < 1 << KINDS.length; mask++) {
    const set = KINDS.filter((_, i) => mask & (1 << i));
    const raw = fixture("experiment-valid.yaml");
    raw.views = set.map((kind) => {
      const view: Record<string, unknown> = {
        id: `v-${kind}`,
        kind,
        consumes: ["tracerPositions"],
      };
      const requires = legalRequires(kind);
      if (requires.length > 0) view.requires = requires;
      if (kind === "three") view.spatialJustification = "The ellipsoid needs three dimensions.";
      return view;
    });
    let code = "ACCEPTED";
    try {
      validateExperiment(raw);
    } catch (err) {
      code = err instanceof ExperimentValidationError ? err.code : String(err);
    }
    outcomes.set(set.join("+"), code);
  }

  assert.equal(outcomes.size, 31, "every non-empty subset of the five kinds was enumerated");
  const reached = [...outcomes].filter(([, code]) => code === "all-views-require-capabilities");
  assert.deepEqual(reached, [], "no view-kind set reaches all-views-require-capabilities");

  // And the six sets that COULD make hasNoRequiresView false are accounted for by name, so this is
  // a statement about where they go rather than only about where they do not.
  for (const set of ["canvas", "three", "canvas+three"]) {
    assert.equal(outcomes.get(set), "canvas-or-three-missing-fallback-view", `${set} views`);
  }
  // The remaining 25 sets all contain an svg, table or text view and are accepted.
  assert.equal([...outcomes].filter(([, c]) => c === "ACCEPTED").length, 25);
});

test("(experiment.ts:1446) invalid-preset: a preset entry must be an object", () => {
  const raw = fixture("experiment-valid.yaml");
  raw.presets = ["bm-01-standard-water"];
  refuses(() => validateExperiment(raw), {
    code: "invalid-preset",
    path: ".presets[0]",
    message: "Preset must be an object.",
  });

  // The index is the entry's own. A good preset followed by a bad one points at position 1, which
  // a test using a single-element array could not distinguish from a hard-coded 0.
  const second = fixture("experiment-valid.yaml");
  second.presets = [second.presets[0], null];
  refuses(() => validateExperiment(second), {
    code: "invalid-preset",
    path: ".presets[1]",
    message: "Preset must be an object.",
  });

  // `presets` is optional: omitting it entirely is legal and must not reach this site.
  const none = fixture("experiment-valid.yaml");
  delete none.presets;
  assert.equal(validateExperiment(none).id, "bm-01");
});

test("(experiment.ts:3520) invalid-prompt-id: a tour step's promptId is checked against the grammar", () => {
  const raw = fixture("tour-valid.yaml");
  // Step 2 carries a promptId; step 1 carries a presetId. They are validated by two sites eight
  // lines apart that share neither path nor grammar, so the step chosen here decides which fires.
  raw.steps[1].instrumentPreset.promptId = "radius-effect";
  refuses(() => validateTour(raw), {
    code: "invalid-prompt-id",
    path: ".instrumentPreset.promptId",
  });

  // The sibling at :3512 is reachable from the other step, and must report its own code and path.
  const presetSide = fixture("tour-valid.yaml");
  presetSide.steps[0].instrumentPreset.presetId = "Standard Water";
  refuses(() => validateTour(presetSide), {
    code: "invalid-preset-id",
    path: ".instrumentPreset.presetId",
  });

  // promptId is optional on a step, so its absence is not this refusal.
  const withoutPrompt = fixture("tour-valid.yaml");
  delete withoutPrompt.steps[1].instrumentPreset.promptId;
  assert.equal(validateTour(withoutPrompt).id, "tour-brownian-overview");
});
