import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { LQ04_DEFAULTS, LQ04_OUTPUTS } from "../../experiments/lq04/definition.ts";
import { createLq04Session } from "../../experiments/lq04/session.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { createWeaveEvaluator } from "../../experiments/weave/evaluate.ts";
import { checkPointerVoice } from "../../experiments/weave/pointerVoice.ts";
import {
  createSessionWeave,
  type SessionWeave,
  weaveOutputs,
} from "../../experiments/weave/sessionSource.ts";
import { validateWeavePredicate } from "../../experiments/weave/validate.ts";
import { LQ04_READER_WEAVE } from "./entropyPassages.ts";

const VOLUME = "lq04-s4-volume-law";
const LIMIT = "lq04-s4-wien-validity-limit";

function ready(state: SessionWeave) {
  assert.equal(state.kind, "ready");
  if (state.kind !== "ready") throw new Error("Expected an accepted entropy calculation");
  return state;
}

function flags(snapshot: AcceptedSnapshot) {
  return createWeaveEvaluator(LQ04_READER_WEAVE.predicates).evaluate({
    runId: snapshot.runId,
    snapshotVersion: snapshot.snapshotVersion,
    outputs: weaveOutputs(snapshot),
    refused: false,
  }).flags;
}

test("entropy pointers resolve to the volume conclusion and its qualification, not observations", () => {
  const manifest = load(
    readFileSync(new URL("../../../content/experiments/lq-04.yaml", import.meta.url), "utf8"),
  ) as { weavePredicates: string[] };
  const targets = new Set<string>();
  for (const passage of Object.values(LQ04_READER_WEAVE.passages)) {
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
  for (const predicate of LQ04_READER_WEAVE.predicates) {
    expect(manifest.weavePredicates).toContain(predicate.id);
    expect(
      validateWeavePredicate(predicate, {
        instrumentOutputIds: new Set(Object.keys(LQ04_OUTPUTS)),
        resolvableTargetIds: targets,
      }),
    ).toEqual(predicate);
    expect(checkPointerVoice(predicate)).toEqual([]);
    expect(LQ04_READER_WEAVE.passages[predicate.id]?.sentenceId).toBe(predicate.targets[0]);
  }
  expect(LQ04_READER_WEAVE.passages[LIMIT]?.sentenceId).toBe("s4-p1-s3");
  // Temperature readouts alone do not supply the manifest's promised derivative comparison.
  expect(LQ04_READER_WEAVE.predicates.some((p) => p.id === "lq04-s3-derivative-check")).toBe(false);
});

test("halving, preserving and doubling volume keep the pointer on the accepted entropy result", () => {
  const session = createLq04Session("entropy-volume");
  const source = createSessionWeave(session, LQ04_READER_WEAVE);
  const prepared = source.getServerSnapshot();
  for (const volumeRatio of [0.5, 1, 2]) {
    expect(session.apply({ ...LQ04_DEFAULTS, volumeRatio }).kind).toBe("accepted");
    const state = ready(source.getSnapshot());
    expect(state.accepted).toBe(session.getSnapshot().accepted);
    expect(state.accepted.parameters.volumeRatio).toBe(volumeRatio);
    expect(state.derived.flags[VOLUME]?.lit).toBe(true);
    expect(state.derived.flags[VOLUME]?.meaning).toBe("quantity-compared");
    expect(state.derived.flags[LIMIT]?.lit).toBe(false);
    expect(state.prepared).toBe(false);
    expect(source.getSnapshot()).toBe(state);
    expect(source.getServerSnapshot()).toBe(prepared);
  }
});

test("a dense endpoint or wide band switches to the typed domain pointer and can recover", () => {
  const session = createLq04Session("entropy-domain");
  const source = createSessionWeave(session, LQ04_READER_WEAVE);
  for (const parameters of [
    { ...LQ04_DEFAULTS, volumeRatio: 1e-4 },
    { ...LQ04_DEFAULTS, bandwidth: 1e14 },
  ]) {
    expect(session.apply(parameters).kind).toBe("accepted");
    const state = ready(source.getSnapshot());
    expect(state.accepted.outputs.find((o) => o.quantityId === "radiationEntropy")?.status).toBe(
      "outside-domain",
    );
    expect(state.derived.flags[VOLUME]?.lit).toBe(false);
    expect(state.derived.flags[LIMIT]?.lit).toBe(true);
    expect(state.derived.flags[LIMIT]?.meaning).toBe("outside-selected-domain");
  }
  expect(session.apply(LQ04_DEFAULTS).kind).toBe("accepted");
  expect(ready(source.getSnapshot()).derived.flags[VOLUME]?.lit).toBe(true);
  expect(ready(source.getSnapshot()).derived.flags[LIMIT]?.lit).toBe(false);
});

test("a validation refusal keeps its old snapshot but removes every scientific pointer", () => {
  const session = createLq04Session("entropy-refusal");
  const source = createSessionWeave(session, LQ04_READER_WEAVE);
  const before = ready(source.getSnapshot()).accepted;
  expect(session.apply({ ...LQ04_DEFAULTS, volumeRatio: 0 }).kind).toBe("refused");
  expect(session.getSnapshot().accepted).toBe(before);
  expect(source.getSnapshot()).toEqual({ kind: "inactive", reason: "refused" });
  expect(session.apply({ ...LQ04_DEFAULTS, volumeRatio: 2 }).kind).toBe("accepted");
  expect(ready(source.getSnapshot()).derived.flags[VOLUME]?.lit).toBe(true);
});

test("missing, duplicate, nonnumeric or nonfinite entropy evidence never lights the volume claim", () => {
  const snapshot = createLq04Session("entropy-incomplete").getSnapshot().accepted;
  assert.ok(snapshot);
  for (const quantityId of ["radiationEntropy", "entropyVolumeCoefficient"]) {
    const output = snapshot.outputs.find((candidate) => candidate.quantityId === quantityId);
    assert.ok(output);
    for (const outputs of [
      snapshot.outputs.filter((candidate) => candidate !== output),
      [...snapshot.outputs, output],
      snapshot.outputs.map((candidate) =>
        candidate === output ? { ...output, value: Number.NaN } : candidate,
      ),
      snapshot.outputs.map((candidate) =>
        candidate === output ? { ...output, value: Number.POSITIVE_INFINITY } : candidate,
      ),
      snapshot.outputs.map((candidate) =>
        candidate === output
          ? { ...output, status: "not-applicable" as const, reason: "No scalar in this state." }
          : candidate,
      ),
    ]) {
      expect(flags({ ...snapshot, outputs })[VOLUME]?.state).toBe("not-evaluable");
    }
  }
});
