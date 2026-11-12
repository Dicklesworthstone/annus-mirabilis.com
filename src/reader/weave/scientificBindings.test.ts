import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { LQ03_DEFAULTS, LQ03_OUTPUTS } from "../../experiments/lq03/definition.ts";
import { createLq03Session, evaluateLq03 } from "../../experiments/lq03/session.ts";
import { SR05_OUTPUTS } from "../../experiments/sr05/definition.ts";
import { createSr05Session } from "../../experiments/sr05/session.ts";
import type { AcceptedSnapshot, ExperimentView } from "../../experiments/store/instanceStore.ts";
import { createWeaveEvaluator } from "../../experiments/weave/evaluate.ts";
import { checkPointerVoice } from "../../experiments/weave/pointerVoice.ts";
import {
  createSessionWeave,
  type SessionWeave,
  weaveOutputs,
} from "../../experiments/weave/sessionSource.ts";
import { validateWeavePredicate } from "../../experiments/weave/validate.ts";
import { SR05_READER_WEAVE } from "./clockPassages.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";
import { LQ03_READER_WEAVE } from "./spectrumPassages.ts";

const CLOCK = "sr05-s4-moving-clock";
const WIEN = "lq03-s4-wien-confirmed-within-limits";
const CLASSICAL = "lq03-s2-classical-regime";
const OUTSIDE = "lq03-s4-outside-wien-regime";

function ready(state: SessionWeave) {
  assert.equal(state.kind, "ready");
  if (state.kind !== "ready") throw new Error("Expected an accepted comparison");
  return state;
}

function flags(snapshot: AcceptedSnapshot, binding: ReaderWeaveBinding) {
  return createWeaveEvaluator(binding.predicates).evaluate({
    runId: snapshot.runId,
    snapshotVersion: snapshot.snapshotVersion,
    constantSetId:
      typeof binding.constantSetId === "function"
        ? binding.constantSetId(snapshot)
        : binding.constantSetId,
    outputs: weaveOutputs(snapshot),
    refused: false,
  }).flags;
}

for (const [binding, outputs] of [
  [SR05_READER_WEAVE, SR05_OUTPUTS],
  [LQ03_READER_WEAVE, LQ03_OUTPUTS],
] as const) {
  test(`${binding.instrumentId} pointers resolve to actual source sentences and declared outputs`, () => {
    const ids = new Set<string>();
    for (const passage of Object.values(binding.passages)) {
      const block = passage.sentenceId.replace(/-s\d+$/, "");
      const source = load(
        readFileSync(
          new URL(`../../../content/source-blocks/${binding.paper}/${block}.yaml`, import.meta.url),
          "utf8",
        ),
      ) as { paper: string; sentenceSpans: { id: string }[] };
      expect(source.paper).toBe(binding.paper);
      expect(source.sentenceSpans.some((span) => span.id === passage.sentenceId)).toBe(true);
      for (const span of source.sentenceSpans) ids.add(span.id);
    }
    for (const predicate of binding.predicates) {
      expect(
        validateWeavePredicate(predicate, {
          instrumentOutputIds: new Set(Object.keys(outputs)),
          resolvableTargetIds: ids,
        }),
      ).toEqual(predicate);
      expect(checkPointerVoice(predicate)).toEqual([]);
      expect(binding.passages[predicate.id]?.sentenceId).toBe(predicate.targets[0]);
    }
  });
}

test("the clock pointer reads the exact accepted loss in either direction, including small and zero speeds", () => {
  const session = createSr05Session("clock-weave");
  const source = createSessionWeave(session, SR05_READER_WEAVE);
  const initial = ready(source.getSnapshot());
  expect(initial.accepted).toBe(session.getSnapshot().accepted);
  expect(initial.derived.flags[CLOCK]?.lit).toBe(true);
  for (const [speed, expected] of [
    [-0.6, true],
    [0.5, true],
    [0.1, false],
    [0, false],
  ] as const) {
    expect(session.apply({ speed }).kind).toBe("accepted");
    const current = ready(source.getSnapshot());
    expect(current.accepted).toBe(session.getSnapshot().accepted);
    expect(current.derived.flags[CLOCK]?.lit).toBe(expected);
    expect(current.prepared).toBe(false);
  }
  expect(source.getServerSnapshot()).toBe(initial);
});

test("the clock's readability boundary is inclusive and never inferred from parameter metadata", () => {
  const snapshot = createSr05Session("clock-boundary").getSnapshot().accepted;
  assert.ok(snapshot);
  for (const [loss, expected] of [
    [0.1, true],
    [0.1 - Number.EPSILON, false],
    [Number.NaN, false],
  ] as const) {
    const changed = {
      ...snapshot,
      parameters: { ...snapshot.parameters, speed: 0.9 },
      outputs: snapshot.outputs.map((output) =>
        output.quantityId === "dilationLossExact" ? { ...output, value: loss } : output,
      ),
    };
    expect(flags(changed, SR05_READER_WEAVE)[CLOCK]?.lit).toBe(expected);
  }
  expect(flags({ ...snapshot, outputs: [] }, SR05_READER_WEAVE)[CLOCK]?.state).toBe(
    "not-evaluable",
  );
});

test("Wien, classical and intermediate probes publish the radiation owner's finite regime flags", () => {
  for (const [probeNu, wien, classical] of [
    [6e14, true, false],
    [1e11, false, true],
    [1e14, false, false],
  ] as const) {
    const parameters = { ...LQ03_DEFAULTS, probeNu };
    const owner = evaluateLq03(parameters).regime;
    const session = createLq03Session(`spectrum-${probeNu}`, parameters);
    const state = ready(createSessionWeave(session, LQ03_READER_WEAVE).getSnapshot());
    const outputs = weaveOutputs(state.accepted);
    expect(outputs.wienRegimeAdmitted?.value).toBe(Number(owner.wienAdmitted));
    expect(outputs.classicalRegimeAdmitted?.value).toBe(Number(owner.rayleighJeansAdmitted));
    expect(state.derived.flags[WIEN]?.lit).toBe(wien);
    expect(state.derived.flags[CLASSICAL]?.lit).toBe(classical);
    expect(state.derived.flags[OUTSIDE]?.lit).toBe(!wien);
    for (const id of ["wienRegimeAdmitted", "classicalRegimeAdmitted"]) {
      const output = state.accepted.outputs.find((candidate) => candidate.quantityId === id);
      expect(output).toMatchObject({
        unit: LQ03_OUTPUTS[id]?.unit,
        semanticKind: LQ03_OUTPUTS[id]?.semanticKind,
        ownerId: LQ03_OUTPUTS[id]?.ownerId,
        status: "value",
      });
    }
  }
});

test("a tolerance change updates the pointer on the same run and revision with the new accepted identity", () => {
  const session = createLq03Session("spectrum-tolerance");
  const source = createSessionWeave(session, LQ03_READER_WEAVE);
  const before = ready(source.getSnapshot());
  expect(before.derived.flags[WIEN]?.lit).toBe(true);
  expect(session.apply({ ...LQ03_DEFAULTS, epsilon: 0.001 }).kind).toBe("accepted");
  const after = ready(source.getSnapshot());
  expect(after.accepted).toBe(session.getSnapshot().accepted);
  expect(after.accepted).not.toBe(before.accepted);
  expect(after.accepted.runId).toBe(before.accepted.runId);
  expect(after.accepted.snapshotVersion).toBe(before.accepted.snapshotVersion);
  expect(after.accepted.actionIndex).toBe(before.accepted.actionIndex + 1);
  expect(after.derived.flags[WIEN]?.lit).toBe(false);
  expect(after.derived.flags[OUTSIDE]?.lit).toBe(true);
  expect(source.getSnapshot()).toBe(after);
});

test("an unrepresentably small density does not corrupt a valid logarithmic regime classification", () => {
  const session = createLq03Session("spectrum-log", { ...LQ03_DEFAULTS, T: 500, probeNu: 1e16 });
  const state = ready(createSessionWeave(session, LQ03_READER_WEAVE).getSnapshot());
  expect(weaveOutputs(state.accepted).frequencyEnergyDensity?.status).toBe("outside-domain");
  expect(state.derived.flags[WIEN]?.lit).toBe(true);
  expect(state.derived.flags[CLASSICAL]?.lit).toBe(false);
  expect(state.derived.flags[OUTSIDE]?.lit).toBe(false);
});

test("a refused spectrum request hides the kept calculation's pointers until an accepted recovery", () => {
  const session = createLq03Session("spectrum-refusal");
  const source = createSessionWeave(session, LQ03_READER_WEAVE);
  const before = ready(source.getSnapshot());
  expect(session.apply({ ...LQ03_DEFAULTS, T: 0 }).kind).toBe("refused");
  expect(session.getSnapshot().accepted).toBe(before.accepted);
  expect(source.getSnapshot()).toEqual({ kind: "inactive", reason: "refused" });
  expect(session.apply({ ...LQ03_DEFAULTS, probeNu: 1e11 }).kind).toBe("accepted");
  const after = ready(source.getSnapshot());
  expect(after.derived.flags[WIEN]?.lit).toBe(false);
  expect(after.derived.flags[CLASSICAL]?.lit).toBe(true);
});

test("missing or ambiguous regime outputs cannot borrow correct-looking probe settings", () => {
  const snapshot = createLq03Session("spectrum-missing").getSnapshot().accepted;
  assert.ok(snapshot);
  const output = snapshot.outputs.find(
    (candidate) => candidate.quantityId === "wienRegimeAdmitted",
  );
  assert.ok(output);
  for (const outputs of [
    snapshot.outputs.filter((candidate) => candidate !== output),
    [...snapshot.outputs, output],
    snapshot.outputs.map((candidate) =>
      candidate === output ? { ...candidate, value: Number.NaN } : candidate,
    ),
  ]) {
    const current = flags({ ...snapshot, outputs }, LQ03_READER_WEAVE);
    expect(current[WIEN]?.state).toBe("not-evaluable");
    expect(current[OUTSIDE]?.state).toBe("not-evaluable");
  }
});

test("both live bindings reject pending, stale, refused and foreign publications and release their subscriptions", () => {
  for (const [binding, session] of [
    [SR05_READER_WEAVE, createSr05Session("clock-owner")],
    [LQ03_READER_WEAVE, createLq03Session("spectrum-owner")],
  ] as const) {
    const original = session.getSnapshot();
    assert.ok(original.accepted && original.requested);
    let view: ExperimentView = original;
    const listeners = new Set<() => void>();
    const source = createSessionWeave(
      {
        getSnapshot: () => view,
        getServerSnapshot: () => original,
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      },
      binding,
    );
    const unsubscribe = source.subscribe(() => {});
    expect(listeners.size).toBe(1);
    for (const [patch, reason] of [
      [{ pending: true, status: "pending" }, "pending"],
      [
        { requested: { ...original.requested, actionIndex: original.requested.actionIndex + 1 } },
        "pending",
      ],
      [{ status: "refused" }, "refused"],
      [{ accepted: { ...original.accepted, instanceId: "another-owner" } }, "wrong-instance"],
    ] as const) {
      view = { ...original, ...patch };
      for (const listener of listeners) listener();
      expect(source.getSnapshot()).toEqual({ kind: "inactive", reason });
    }
    view = original;
    for (const listener of listeners) listener();
    expect(ready(source.getSnapshot()).accepted).toBe(original.accepted);
    unsubscribe();
    expect(listeners.size).toBe(0);
  }
});
