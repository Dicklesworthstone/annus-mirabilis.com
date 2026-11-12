import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { LQ08_MODEL, LQ08_OUTPUTS, LQ08_PRESETS } from "../../experiments/lq08/definition.ts";
import { createLq08Session } from "../../experiments/lq08/session.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { createWeaveEvaluator } from "../../experiments/weave/evaluate.ts";
import { checkPointerVoice } from "../../experiments/weave/pointerVoice.ts";
import {
  createSessionWeave,
  type SessionWeave,
  weaveOutputs,
} from "../../experiments/weave/sessionSource.ts";
import { validateWeavePredicate } from "../../experiments/weave/validate.ts";
import { LQ08_READER_WEAVE } from "./photoelectricPassages.ts";

const LINE = "lq08-s8-linear-frequency";
const INDEPENDENCE = "lq08-s8-intensity-rate-independence";
const HISTORICAL = "lq08-s8-printed-stopping-check";

function ready(state: SessionWeave) {
  assert.equal(state.kind, "ready");
  if (state.kind !== "ready") throw new Error("Expected an accepted photoelectric calculation");
  return state;
}

function flags(snapshot: AcceptedSnapshot, constantSetId: string = LQ08_MODEL.constantSetId) {
  return createWeaveEvaluator(LQ08_READER_WEAVE.predicates).evaluate({
    runId: snapshot.runId,
    snapshotVersion: snapshot.snapshotVersion,
    constantSetId,
    outputs: weaveOutputs(snapshot),
    refused: false,
  }).flags;
}

test("all declared photoelectric pointers resolve to source sentences and owner outputs", () => {
  const manifest = load(
    readFileSync(new URL("../../../content/experiments/lq-08.yaml", import.meta.url), "utf8"),
  ) as { weavePredicates: string[] };
  expect(LQ08_READER_WEAVE.predicates.map((predicate) => predicate.id)).toEqual(
    manifest.weavePredicates,
  );
  const targets = new Set<string>();
  for (const passage of Object.values(LQ08_READER_WEAVE.passages)) {
    const block = passage.sentenceId.replace(/-s\d+$/, "");
    const source = load(
      readFileSync(
        new URL(`../../../content/source-blocks/light-quanta/${block}.yaml`, import.meta.url),
        "utf8",
      ),
    ) as { paper: string; sentenceSpans: { id: string }[] };
    expect(source.paper).toBe("light-quanta");
    expect(source.sentenceSpans.some((span) => span.id === passage.sentenceId)).toBe(true);
    for (const span of source.sentenceSpans) targets.add(span.id);
  }
  for (const predicate of LQ08_READER_WEAVE.predicates) {
    expect(
      validateWeavePredicate(predicate, {
        instrumentOutputIds: new Set(Object.keys(LQ08_OUTPUTS)),
        resolvableTargetIds: targets,
      }),
    ).toEqual(predicate);
    expect(checkPointerVoice(predicate)).toEqual([]);
    expect(LQ08_READER_WEAVE.passages[predicate.id]?.sentenceId).toBe(predicate.targets[0]);
  }
  // The historical pointer names the neglected escape work, not the empirical agreement sentence.
  expect(LQ08_READER_WEAVE.passages[HISTORICAL]?.sentenceId).toBe("s8-p5-s1");
});

test("photoelectric presets read accepted snapshots without promoting assumptions to evidence", () => {
  const session = createLq08Session("photoelectric-weave");
  const source = createSessionWeave(session, LQ08_READER_WEAVE);
  const initial = ready(source.getSnapshot());
  expect(initial.accepted).toBe(session.getSnapshot().accepted);
  expect(initial.derived.flags[LINE]?.meaning).toBe("quantity-compared");
  expect(initial.derived.flags[INDEPENDENCE]?.meaning).toBe("assumption-active");
  expect(initial.derived.flags[HISTORICAL]?.meaning).toBe("assumption-active");
  for (const [preset, line, historical] of [
    [LQ08_PRESETS.intensityProbe, true, false],
    [LQ08_PRESETS.subThreshold, false, false],
    [LQ08_PRESETS.historicalCheck, true, true],
    [LQ08_PRESETS.twoMetals, true, false],
  ] as const) {
    expect(session.apply(preset.parameters).kind).toBe("accepted");
    const current = ready(source.getSnapshot());
    expect(current.accepted).toBe(session.getSnapshot().accepted);
    expect(current.derived.flags[LINE]?.lit).toBe(line);
    expect(current.derived.flags[INDEPENDENCE]?.lit).toBe(true);
    expect(current.derived.flags[HISTORICAL]?.lit).toBe(historical);
    expect(current.prepared).toBe(false);
    expect(source.getSnapshot()).toBe(current);
    expect(session.getSnapshot().accepted).toBe(current.accepted);
  }
  expect(source.getServerSnapshot()).toBe(initial);
});

test("the historical assumption needs its exact frequency, escape work and constants", () => {
  const session = createLq08Session("historical-weave");
  const source = createSessionWeave(session, LQ08_READER_WEAVE);
  for (const [parameters, expected] of [
    [LQ08_PRESETS.historicalCheck.parameters, true],
    [{ ...LQ08_PRESETS.historicalCheck.parameters, frequency: 1.03001e15 }, false],
    [{ ...LQ08_PRESETS.historicalCheck.parameters, workFunction: 0.001 }, false],
    [{ ...LQ08_PRESETS.historicalCheck.parameters, incidentPower: 0 }, true],
  ] as const) {
    expect(session.apply(parameters).kind).toBe("accepted");
    const current = ready(source.getSnapshot());
    expect(current.derived.flags[HISTORICAL]?.lit).toBe(expected);
  }
  const snapshot = ready(source.getSnapshot()).accepted;
  expect(flags(snapshot, "other-constants")[HISTORICAL]?.lit).toBe(false);
});

test("retarding current stays undetermined without a velocity distribution", () => {
  const session = createLq08Session("retarding-weave");
  expect(
    session.apply({ ...LQ08_PRESETS.intensityProbe.parameters, collectorPotential: -0.1 }).kind,
  ).toBe("accepted");
  const current = ready(createSessionWeave(session, LQ08_READER_WEAVE).getSnapshot());
  expect(weaveOutputs(current.accepted).photocurrent?.status).toBe("underdetermined");
  expect(current.derived.flags[LINE]?.lit).toBe(true);
  expect(current.derived.flags[INDEPENDENCE]?.lit).toBe(true);
  expect(current.derived.flags[INDEPENDENCE]?.pointerText).toContain(
    "only the maximum electron energy",
  );
  expect(current.derived.flags[INDEPENDENCE]?.meaning).toBe("assumption-active");
});

test("missing, duplicate or nonfinite evidence cannot borrow plausible accepted parameters", () => {
  const session = createLq08Session("photoelectric-missing");
  expect(session.apply(LQ08_PRESETS.historicalCheck.parameters).kind).toBe("accepted");
  const snapshot = session.getSnapshot().accepted;
  assert.ok(snapshot);
  for (const [quantityId, predicateId] of [
    ["stoppingPotentialMagnitude", LINE],
    ["quantumRate", INDEPENDENCE],
    ["emissionRate", INDEPENDENCE],
    ["frequency", HISTORICAL],
    ["workFunction", HISTORICAL],
  ] as const) {
    const output = snapshot.outputs.find((candidate) => candidate.quantityId === quantityId);
    assert.ok(output);
    for (const outputs of [
      snapshot.outputs.filter((candidate) => candidate !== output),
      [...snapshot.outputs, output],
      snapshot.outputs.map((candidate) =>
        candidate === output ? { ...candidate, value: Number.NaN } : candidate,
      ),
    ]) {
      expect(flags({ ...snapshot, outputs })[predicateId]?.state).toBe("not-evaluable");
    }
  }
  // A genuine zero stopping potential is a number, unlike the below-threshold non-value.
  for (const [value, expected] of [
    [0, true],
    [-Number.EPSILON, false],
  ] as const) {
    const outputs = snapshot.outputs.map((output) =>
      output.quantityId === "stoppingPotentialMagnitude" ? { ...output, value } : output,
    );
    expect(flags({ ...snapshot, outputs })[LINE]?.lit).toBe(expected);
  }
});
