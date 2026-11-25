import { afterAll, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { SR01_DEFAULTS, SR01_OUTPUTS } from "../../experiments/sr01/definition.ts";
import { createSr01Session } from "../../experiments/sr01/session.ts";
import { ALL_CONSTRAINTS, SR04_DEFAULTS, SR04_OUTPUTS } from "../../experiments/sr04/definition.ts";
import { createSr04Session } from "../../experiments/sr04/session.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { createWeaveEvaluator } from "../../experiments/weave/evaluate.ts";
import { checkPointerVoice } from "../../experiments/weave/pointerVoice.ts";
import {
  createSessionWeave,
  type SessionWeave,
  weaveOutputs,
} from "../../experiments/weave/sessionSource.ts";
import { validateWeavePredicate } from "../../experiments/weave/validate.ts";
import { TestLogger } from "../../testing/log/logger.ts";
import { SR04_READER_WEAVE } from "./constructionPassages.ts";
import { weaveContext } from "./context.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";
import { SR01_READER_WEAVE } from "./synchronizationPassages.ts";

const log = new TestLogger("synchronization-construction-weave-bindings");
afterAll(() => log.flush());
const MIDPOINT = "sr01-s1-midpoint-definition";
const CRITERION = "sr01-s1-clock-criterion";
const ROUND_TRIP = "sr01-s1-round-trip-postulate";
const MOVING_PAIR = "sr01-s2-moving-pair";
const UNFIXED = "sr04-s3-unfixed-scale";
const CONSTRUCTED = "sr04-s3-longitudinal-map";
const CANDIDATE = "sr04-s3-candidate-comparison";

function ready(state: SessionWeave) {
  assert.ok(state.kind === "ready", "The real session must supply an accepted calculation");
  return state;
}

function flags(snapshot: AcceptedSnapshot, binding: ReaderWeaveBinding) {
  return createWeaveEvaluator(binding.predicates).evaluate({
    runId: snapshot.runId,
    snapshotVersion: snapshot.snapshotVersion,
    outputs: weaveOutputs(snapshot),
    refused: false,
  }).flags;
}

for (const [binding, outputs] of [
  [SR01_READER_WEAVE, SR01_OUTPUTS],
  [SR04_READER_WEAVE, SR04_OUTPUTS],
] as const) {
  test(`${binding.instrumentId} joins declared predicates to real aligned source sentences and owned outputs`, () => {
    const manifest = load(
      readFileSync(
        new URL(`../../../content/experiments/${binding.instrumentId}.yaml`, import.meta.url),
        "utf8",
      ),
    ) as { weavePredicates: string[] };
    const alignment = load(
      readFileSync(
        new URL("../../../content/alignments/special-relativity.yaml", import.meta.url),
        "utf8",
      ),
    ) as { edges: { source: { sentenceId: string } }[] };
    const ids = new Set<string>();
    expect(binding.predicates.length).toBeGreaterThan(0);
    for (const passage of Object.values(binding.passages)) {
      const block = passage.sentenceId.replace(/-s\d+$/, "");
      const source = load(
        readFileSync(
          new URL(`../../../content/source-blocks/${binding.paper}/${block}.yaml`, import.meta.url),
          "utf8",
        ),
      ) as { sentenceSpans: { id: string }[] };
      expect(source.sentenceSpans.some((span) => span.id === passage.sentenceId)).toBe(true);
      expect(alignment.edges.some((edge) => edge.source.sentenceId === passage.sentenceId)).toBe(
        true,
      );
      for (const span of source.sentenceSpans) ids.add(span.id);
    }
    for (const predicate of binding.predicates) {
      expect(manifest.weavePredicates).toContain(predicate.id);
      expect(
        validateWeavePredicate(predicate, {
          instrumentOutputIds: new Set(Object.keys(outputs)),
          resolvableTargetIds: ids,
        }),
      ).toEqual(predicate);
      expect(checkPointerVoice(predicate)).toEqual([]);
      expect(binding.passages[predicate.id]?.sentenceId).toBe(predicate.targets[0]);
    }
    log.log({
      testId: binding.instrumentId,
      beadId: "am-read-result-weave-jex",
      paper: binding.paper,
      instrumentId: binding.instrumentId,
      outcome: "passed",
      extra: { predicates: binding.predicates.map((predicate) => predicate.id) },
      message:
        "Checked manifest declarations, sentence identities, English alignment and output contracts.",
    });
  });
}

test("clock assignments remain definitions while offsets and zero-speed cases remain comparisons", () => {
  const session = createSr01Session("clock-weave-owner");
  const source = createSessionWeave(session, SR01_READER_WEAVE);
  const initial = ready(source.getSnapshot());
  expect(initial.prepared).toBe(true);
  expect(initial.derived.flags[MIDPOINT]?.meaning).toBe("assumption-active");
  expect(initial.derived.flags[ROUND_TRIP]?.meaning).toBe("assumption-active");
  for (const pairBeta of [-0.6, 0, 0.6]) {
    expect(
      session.apply({ ...SR01_DEFAULTS, emissionTimeA: -20, clockOffsetB: -2, pairBeta }).kind,
    ).toBe("accepted");
    const current = ready(source.getSnapshot());
    expect(current.accepted).toBe(session.getSnapshot().accepted);
    expect(current.prepared).toBe(false);
    expect(weaveOutputs(current.accepted).assignedRemoteTime?.value).toBe(-10);
    expect(weaveOutputs(current.accepted).criterionOffset?.value).toBe(-4);
    expect(weaveOutputs(current.accepted).desynchronization?.value).toBe(Math.abs(pairBeta) * 10);
    expect(weaveOutputs(current.accepted).oneWayLightSpeed?.status).toBe("not-applicable");
    expect(current.derived.flags[CRITERION]?.lit).toBe(true);
    expect(current.derived.flags[MOVING_PAIR]?.lit).toBe(true);
    expect(current.derived.flags[CRITERION]?.meaning).toBe("quantity-compared");
    expect(current.derived.flags[MOVING_PAIR]?.meaning).toBe("quantity-compared");
  }
  const before = ready(source.getSnapshot());
  expect(session.apply({ ...session.acceptedParameters(), frameBeta: -0.6 }).kind).toBe("accepted");
  const redescribed = ready(source.getSnapshot());
  expect(redescribed.accepted.runId).toBe(before.accepted.runId);
  expect(redescribed.accepted.outputs).toEqual(before.accepted.outputs);
  expect(weaveContext(redescribed.accepted, SR01_READER_WEAVE.contextFields)).toContainEqual({
    id: "frameBeta",
    label: "Displayed observer speed",
    value: "-0.6 c",
  });
  expect(source.getServerSnapshot()).toBe(initial);
});

test("a later-aid value or a candidate residual never masquerades as a solved Lorentz construction", () => {
  const session = createSr04Session("construction-weave-owner");
  const source = createSessionWeave(session, SR04_READER_WEAVE);
  const initial = ready(source.getSnapshot());
  expect(initial.derived.flags[CANDIDATE]?.lit).toBe(true);
  expect(initial.derived.flags[CONSTRUCTED]?.lit).toBe(false);
  expect(weaveOutputs(initial.accepted).lorentzFactor?.value).toBe(1.25);
  expect(session.apply({ ...SR04_DEFAULTS, showLaterAids: true }).kind).toBe("accepted");
  expect(ready(source.getSnapshot()).derived.flags[CONSTRUCTED]?.lit).toBe(false);

  expect(
    session.apply({ ...SR04_DEFAULTS, enabledConstraints: "right-moving-light,left-moving-light" })
      .kind,
  ).toBe("accepted");
  const partial = ready(source.getSnapshot());
  expect(partial.derived.flags[UNFIXED]?.lit).toBe(true);
  expect(partial.derived.flags[CONSTRUCTED]?.lit).toBe(false);
  expect(partial.derived.flags[CANDIDATE]?.lit).toBe(false);

  for (const vOverC of [-0.6, 0, 0.6]) {
    const enabledConstraints = ALL_CONSTRAINTS.filter((id) => id !== "transverse-light").join(",");
    expect(session.apply({ ...SR04_DEFAULTS, enabledConstraints, vOverC }).kind).toBe("accepted");
    const current = ready(source.getSnapshot());
    expect(current.derived.flags[CONSTRUCTED]?.lit).toBe(true);
    expect(current.derived.flags[UNFIXED]?.lit).toBe(false);
    expect(current.derived.flags[CANDIDATE]?.lit).toBe(false);
    expect(current.derived.flags[CONSTRUCTED]?.pointerText).toContain("transverse scale requires");
  }

  expect(
    session.apply({
      ...SR04_DEFAULTS,
      enabledConstraints: ALL_CONSTRAINTS.join(","),
      testCandidate: true,
    }).kind,
  ).toBe("accepted");
  const wrongCandidate = ready(source.getSnapshot());
  expect(session.getCalculation().family.status).toBe("residual-report");
  expect(wrongCandidate.derived.flags[CANDIDATE]?.lit).toBe(true);
  expect(wrongCandidate.derived.flags[CANDIDATE]?.meaning).toBe("quantity-compared");
  expect(wrongCandidate.derived.flags[CONSTRUCTED]?.lit).toBe(false);
});

test("missing, duplicate or unavailable outputs cannot borrow a pointer from the accepted settings", () => {
  const clock = createSr01Session().getSnapshot().accepted;
  const map = createSr04Session("constructed", {
    ...SR04_DEFAULTS,
    enabledConstraints: ALL_CONSTRAINTS.join(","),
  }).getSnapshot().accepted;
  for (const [binding, accepted, quantity, affected] of [
    [SR01_READER_WEAVE, clock, "assignedRemoteTime", MIDPOINT],
    [SR01_READER_WEAVE, clock, "criterionOffset", CRITERION],
    [SR01_READER_WEAVE, clock, "roundTripSpeed", ROUND_TRIP],
    [SR01_READER_WEAVE, clock, "desynchronization", MOVING_PAIR],
    [SR04_READER_WEAVE, map, "constraintFamily", CONSTRUCTED],
  ] as const) {
    assert.ok(accepted);
    const target = accepted.outputs.find((output) => output.quantityId === quantity);
    assert.ok(target);
    expect(flags(accepted, binding)[affected]?.lit).toBe(true);
    for (const outputs of [
      accepted.outputs.filter((output) => output !== target),
      [...accepted.outputs, target],
      accepted.outputs.map((output) =>
        output === target
          ? {
              ...output,
              status: "not-applicable" as const,
              reason: "This owner result is unavailable.",
            }
          : output,
      ),
    ]) {
      expect(flags({ ...accepted, outputs }, binding)[affected]?.lit).toBe(false);
    }
  }
  assert.ok(clock);
  const nonfinite = clock.outputs.map((output) =>
    output.quantityId === "assignedRemoteTime" ? { ...output, value: Number.NaN } : output,
  );
  expect(flags({ ...clock, outputs: nonfinite }, SR01_READER_WEAVE)[MIDPOINT]?.state).toBe(
    "not-evaluable",
  );
});
