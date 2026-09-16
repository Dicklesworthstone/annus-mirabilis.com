import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { getLogger, newRunIdentity } from "../../testing/log/logger.ts";
import {
  getShareFormSpec,
  SHARE_FORMS,
  ShareFormError,
  type ShareFormId,
  validateShareAnchor,
  validateShareParameters,
} from "./shareForms.ts";

const logRunId = newRunIdentity();
const logger = getLogger("permalink", logRunId);

test("shareForms: SHARE_FORMS file has zero imports", () => {
  const filePath = path.join(process.cwd(), "src/experiments/permalink/shareForms.ts");
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("import ") || trimmed.startsWith("import{")) {
      assert.fail(`shareForms.ts MUST HAVE ZERO IMPORTS. Found: "${trimmed}"`);
    }
  }
});

test("shareForms: SHARE_FORMS is deeply frozen and contains exactly three forms", () => {
  assert.ok(Object.isFrozen(SHARE_FORMS));
  const keys = Object.keys(SHARE_FORMS);
  assert.equal(keys.length, 3);
  assert.ok(keys.includes("passage-link"));
  assert.ok(keys.includes("experiment-preset"));
  assert.ok(keys.includes("notebook-export"));

  for (const key of keys) {
    const spec = SHARE_FORMS[key as ShareFormId];
    assert.ok(Object.isFrozen(spec));
    assert.ok(Object.isFrozen(spec.admittedParameters));
    assert.ok(Object.isFrozen(spec.admittedAnchorKinds));
    assert.ok(Object.isFrozen(spec.admittedPayloadFields));
  }
});

test("shareForms: admitted parameter sets match specification", () => {
  const passageSpec = getShareFormSpec("passage-link");
  assert.deepEqual(passageSpec.admittedParameters, ["view", "detail", "lens", "notation", "units"]);
  assert.equal(passageSpec.freeTextAllowed, false);
  assert.equal(passageSpec.localMediaAllowed, false);
  assert.equal(passageSpec.producesUrl, true);

  const expSpec = getShareFormSpec("experiment-preset");
  assert.deepEqual(expSpec.admittedParameters, ["tape"]);
  assert.equal(expSpec.freeTextAllowed, false);
  assert.equal(expSpec.localMediaAllowed, false);
  assert.equal(expSpec.producesUrl, true);

  const notebookSpec = getShareFormSpec("notebook-export");
  assert.deepEqual(notebookSpec.admittedParameters, []);
  assert.equal(notebookSpec.freeTextAllowed, true);
  assert.equal(notebookSpec.localMediaAllowed, false);
  assert.equal(notebookSpec.producesUrl, false);
});

test("shareForms: validating parameters rejects unadmitted parameters", () => {
  // Passage link with valid params
  const validPassage = validateShareParameters("passage-link", { view: "parallel", detail: "2" });
  assert.equal(validPassage.valid, true);

  // Passage link with forbidden tape parameter
  const leakedPassage = validateShareParameters("passage-link", { view: "parallel", tape: "abc" });
  assert.equal(leakedPassage.valid, false);
  assert.ok(leakedPassage.errors.some((e) => e.includes("tape")));

  // Experiment preset with forbidden presentation parameters
  const leakedPreset = validateShareParameters("experiment-preset", { tape: "abc", view: "split" });
  assert.equal(leakedPreset.valid, false);
  assert.ok(leakedPreset.errors.some((e) => e.includes("view")));
});

test("shareForms: validating anchors admits valid section/paragraph/equation/result/argument/lab/entry anchors", () => {
  const validAnchors = [
    "#s1",
    "#s3-p2",
    "#s3-p2-s1",
    "#eq-model-bm-diffusivity",
    "#result-bm-06-spread",
    "#arg-bm-diffusion-equation",
    "#lab-bm-01",
    "#entry-brownian-motion",
  ];

  for (const anchor of validAnchors) {
    const res = validateShareAnchor("passage-link", anchor);
    assert.equal(res.valid, true, `Anchor "${anchor}" should be valid for passage-link`);
  }

  // Invalid anchors
  assert.equal(validateShareAnchor("passage-link", "#malicious-script-tag").valid, false);
  assert.equal(validateShareAnchor("experiment-preset", "#s1").valid, false);
});

test("shareForms: querying an unregistered fourth form fails explicitly", () => {
  assert.throws(
    () => getShareFormSpec("custom-external-share"),
    (err: unknown) => {
      return err instanceof ShareFormError && err.code === "unknown-form";
    },
  );

  logger.log({
    testId: "share-forms-allow-list-integrity",
    beadId: "am-inst-permalink-tape-s677",
    outcome: "passed",
    message: "SHARE_FORMS zero-import frozen allow-list verified with parameter/anchor gates",
  });
});
