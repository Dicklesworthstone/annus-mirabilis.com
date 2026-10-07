import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  type ExperimentLaunchIndex,
  experimentSelectionKey,
  isExperimentLaunchHref,
  LAUNCH_NOTICES,
  selectedExperimentLaunch,
} from "./experimentLaunch.ts";

const selection = { instrumentId: "bm-01", tapeId: "einstein-0-8-micron" };
const href = "/lab/bm-01/?tape=encoded-public-settings";
const index: ExperimentLaunchIndex = {
  [experimentSelectionKey(selection)]: { status: "ready", instrumentId: "bm-01", href, kind: "form" },
};

test("a selected tape retains its exact link and tells the reader to apply a worker form", () => {
  assert.deepEqual(selectedExperimentLaunch(selection, index), {
    href, notice: LAUNCH_NOTICES.form, ready: true,
  });
});

test("preset names, tape names and instrument owners cannot collide", () => {
  const keys = [selection, { ...selection, instrumentId: "bm-07" },
    { instrumentId: "bm-01", presetId: selection.tapeId }].map(experimentSelectionKey);
  assert.equal(new Set(keys).size, keys.length);
});

test("a session launch and a defaults-only SR-01 link describe loading, never full replay", () => {
  const chosen = { instrumentId: "sr-01", presetId: "sr-01-sync-0-10" };
  const result = selectedExperimentLaunch(chosen, {
    [experimentSelectionKey(chosen)]: {
      status: "ready", instrumentId: "sr-01", href: "/lab/sr-01/?ab=10", kind: "session",
    },
  });
  assert.equal(result.ready, true);
  assert.equal(result.notice, LAUNCH_NOTICES.session);
  assert.equal(isExperimentLaunchHref("/lab/sr-01/", "sr-01"), true);
});

test("missing, refused or mismatched generated settings never claim that the preset was loaded", () => {
  const key = experimentSelectionKey(selection);
  for (const entries of [
    {},
    { [key]: { status: "unavailable", instrumentId: "bm-01", reason: "Owner refused settings" } },
    { [key]: { status: "ready", instrumentId: "bm-07", href, kind: "form" } },
    { [key]: { status: "ready", instrumentId: "bm-01", href: "/lab/bm-07/?tape=x", kind: "form" } },
  ] as ExperimentLaunchIndex[]) {
    assert.deepEqual(selectedExperimentLaunch(selection, entries), {
      href: "/lab/bm-01/", notice: LAUNCH_NOTICES.unavailable, ready: false,
    });
  }
});

test("ambiguous and absent selection ids do not fall back to a different ready record", () => {
  for (const chosen of [{ ...selection, presetId: "another" }, { instrumentId: "bm-01" }]) {
    assert.equal(selectedExperimentLaunch(chosen, {
      [experimentSelectionKey(chosen)]: index[experimentSelectionKey(selection)]!,
    }).ready, false);
  }
});

test("untrusted destinations cannot redirect, change laboratories or exceed the portable link bound", () => {
  for (const candidate of [
    "https://other.example/lab/bm-01/", "//other.example/lab/bm-01/", "/lab/bm-01/../sr-01/",
    "/lab/bm-01/?tape=x#private", "/lab/bm-01/?tape=x\n", "/lab/bm-01/?tape=\\evil",
    `/lab/bm-01/?tape=${"x".repeat(4096)}`,
  ]) assert.equal(isExperimentLaunchHref(candidate, "bm-01"), false, candidate);
  assert.equal(selectedExperimentLaunch({ instrumentId: "../bad" }, {}).href, "/lab/");
});
