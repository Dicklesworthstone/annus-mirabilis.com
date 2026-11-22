import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { SR07_CLASSES, SR07_DEFAULTS, SR07_OUTPUTS } from "../../experiments/sr07/definition.ts";
import { createSr07Session, evaluateSr07 } from "../../experiments/sr07/session.ts";
import { SR08_DEFAULTS } from "../../experiments/sr08/definition.ts";
import { createSr08Session, SR08_SESSION_OUTPUTS } from "../../experiments/sr08/session.ts";
import { SR12_DEFAULTS, SR12_OUTPUTS } from "../../experiments/sr12/definition.ts";
import { createSr12Session } from "../../experiments/sr12/session.ts";
import {
  type AcceptedSnapshot,
  createInstanceStore,
  type Parameters,
} from "../../experiments/store/instanceStore.ts";
import { createWeaveEvaluator } from "../../experiments/weave/evaluate.ts";
import { checkPointerVoice } from "../../experiments/weave/pointerVoice.ts";
import { createSessionWeave, weaveOutputs } from "../../experiments/weave/sessionSource.ts";
import { validateWeavePredicate } from "../../experiments/weave/validate.ts";
import { C_SI } from "../../physics/reference/fields.ts";
import { SR12_READER_WEAVE } from "./chargeCurrentPassages.ts";
import { weaveContext } from "./context.ts";
import { SR07_READER_WEAVE, SR08_READER_WEAVE } from "./fieldPassages.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

function flags(snapshot: AcceptedSnapshot, binding: ReaderWeaveBinding) {
  return createWeaveEvaluator(binding.predicates).evaluate({
    runId: snapshot.runId,
    snapshotVersion: snapshot.snapshotVersion,
    outputs: weaveOutputs(snapshot),
    refused: false,
  }).flags;
}

for (const [binding, outputs] of [
  [SR07_READER_WEAVE, SR07_OUTPUTS],
  [SR08_READER_WEAVE, SR08_SESSION_OUTPUTS],
  [SR12_READER_WEAVE, SR12_OUTPUTS],
] as const) {
  test(`${binding.instrumentId} binds declared predicates to source sentences and outputs`, () => {
    const manifest = load(
      readFileSync(
        new URL(`../../../content/experiments/${binding.instrumentId}.yaml`, import.meta.url),
        "utf8",
      ),
    ) as { weavePredicates: string[] };
    const ids = new Set<string>();
    for (const passage of Object.values(binding.passages)) {
      const block = passage.sentenceId.replace(/-s\d+$/, "");
      const source = load(
        readFileSync(
          new URL(`../../../content/source-blocks/${binding.paper}/${block}.yaml`, import.meta.url),
          "utf8",
        ),
      ) as { sentenceSpans: { id: string }[] };
      expect(source.sentenceSpans.some((span) => span.id === passage.sentenceId)).toBe(true);
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
  });
}

test("field-equation pointers follow the wave and withdraw a failed comparison", () => {
  const session = createSr07Session("field-equation-pointers");
  const source = createSessionWeave(session, SR07_READER_WEAVE);
  const initial = source.getSnapshot();
  assert.equal(initial.kind, "ready");
  if (initial.kind !== "ready") return;
  expect(initial.prepared).toBe(true);
  expect(source.getServerSnapshot()).toBe(initial);
  for (const wave of ["plus-x", "minus-x", "plus-y", "oblique"] as const) {
    expect(session.apply({ ...SR07_DEFAULTS, wave }).kind).toBe("accepted");
    const current = source.getSnapshot();
    assert.equal(current.kind, "ready");
    if (current.kind !== "ready") continue;
    expect(current.accepted).toBe(session.getSnapshot().accepted);
    expect(current.derived.flags["sr07-form-invariance"]?.lit).toBe(true);
    expect(current.derived.flags["sr07-printed-transforms"]?.lit).toBe(true);
  }
  const before = session.getSnapshot().accepted;
  expect(session.apply({ ...session.acceptedParameters(), boostBeta: -0.6 }).kind).toBe("accepted");
  expect(session.getSnapshot().accepted?.runId).toBe(before?.runId);

  // This is the real owner's deliberate sign mutation, not a hand-authored failure flag.
  const parameters = { ...SR07_DEFAULTS, polarization: "secondary" as const };
  const store = createInstanceStore({
    experimentId: "sr-07",
    instanceId: "wrong-field-sign",
    initialParameters: parameters as unknown as Parameters,
    parameterClasses: SR07_CLASSES,
    outputs: SR07_OUTPUTS,
    allowPartial: true,
  });
  const token = store.issue("setup-change");
  expect(
    store.publish({
      ...token,
      stepIndex: 0,
      simulationTime: 0,
      final: true,
      outputs: evaluateSr07(parameters, "flipped-z-prime"),
    }).accepted,
  ).toBe(true);
  const broken = store.getSnapshot().accepted;
  assert.ok(broken);
  expect(weaveOutputs(broken).formInvariant?.value).toBe(0);
  expect(flags(broken, SR07_READER_WEAVE)["sr07-form-invariance"]?.lit).toBe(false);
});

test("field pointers preserve vectors, signed boosts, and SI context", () => {
  const session = createSr08Session("field-vector-pointers");
  const source = createSessionWeave(session, SR08_READER_WEAVE);
  const originalRun = session.getSnapshot().accepted?.runId;
  for (const beta of [0.6, -0.6, 0]) {
    expect(session.apply({ ...SR08_DEFAULTS, boost: beta * C_SI }).kind).toBe("accepted");
    const current = source.getSnapshot();
    assert.equal(current.kind, "ready");
    if (current.kind !== "ready") continue;
    expect(current.accepted).toBe(session.getSnapshot().accepted);
    expect(current.accepted.runId).toBe(originalRun);
    expect(weaveOutputs(current.accepted).electricFieldMoving).toEqual({
      quantityId: "electricFieldMoving",
      status: "value",
    });
    expect(current.derived.flags["sr08-field-transformation"]?.lit).toBe(true);
    expect(current.derived.flags["sr08-new-manner-expression"]).toBeUndefined();
    expect(weaveContext(current.accepted, SR08_READER_WEAVE.contextFields)).toContainEqual({
      id: "boost",
      label: "Signed observer speed along x",
      value: `${beta * C_SI} m/s`,
    });
  }
});

test("signed charge is admitted and sphere conservation is labeled as an assumption", () => {
  const session = createSr12Session("charge-current-pointers");
  const source = createSessionWeave(session, SR12_READER_WEAVE);
  for (const chargeDensity of [0, -1, 1]) {
    expect(session.apply({ ...SR12_DEFAULTS, chargeDensity }).kind).toBe("accepted");
    const current = source.getSnapshot();
    assert.equal(current.kind, "ready");
    if (current.kind !== "ready") continue;
    expect(current.accepted).toBe(session.getSnapshot().accepted);
    expect(weaveOutputs(current.accepted).chargeDensityStationary?.value).toBe(chargeDensity);
    expect(weaveOutputs(current.accepted).currentDensityMoving?.value).toBeUndefined();
    expect(current.derived.flags["sr12-charge-density-transformation"]?.lit).toBe(true);
    expect(current.derived.flags["sr12-total-charge-invariance"]?.lit).toBe(true);
    expect(current.derived.flags["sr12-total-charge-invariance"]?.meaning).toBe(
      "assumption-active",
    );
    expect(current.derived.flags["sr12-total-charge-invariance"]?.pointerText).toContain(
      "separate uniform-sphere comparison",
    );
  }
  const before = session.getSnapshot().accepted;
  expect(session.apply({ ...session.acceptedParameters(), boost: -0.6 * C_SI }).kind).toBe(
    "accepted",
  );
  expect(session.getSnapshot().accepted?.runId).toBe(before?.runId);
});

test("missing, duplicate and typed non-value readings cannot light a dependent passage", () => {
  for (const [binding, accepted, quantity, affected] of [
    [
      SR07_READER_WEAVE,
      createSr07Session().getSnapshot().accepted,
      "residualMax",
      "sr07-form-invariance",
    ],
    [
      SR08_READER_WEAVE,
      createSr08Session().getSnapshot().accepted,
      "electricFieldMoving",
      "sr08-field-transformation",
    ],
    [
      SR12_READER_WEAVE,
      createSr12Session().getSnapshot().accepted,
      "currentDensityMoving",
      "sr12-charge-density-transformation",
    ],
    [
      SR12_READER_WEAVE,
      createSr12Session().getSnapshot().accepted,
      "sphereTotalChargeMoving",
      "sr12-total-charge-invariance",
    ],
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
              status: "outside-domain" as const,
              condition: "owner result unavailable",
              domainKind: "physical" as const,
              reason: "This comparison is outside the admitted domain.",
              boundary: { parameterId: "boost", value: 0 },
            }
          : output,
      ),
    ]) {
      expect(flags({ ...accepted, outputs }, binding)[affected]?.lit).toBe(false);
    }
  }
});

test("nonfinite readings and refused settings cannot become a fresh trial", () => {
  for (const [binding, session, quantity, affected, invalid] of [
    [
      SR07_READER_WEAVE,
      createSr07Session(),
      "residualMax",
      "sr07-form-invariance",
      { ...SR07_DEFAULTS, boostBeta: 1.5 },
    ],
    [
      SR08_READER_WEAVE,
      createSr08Session(),
      "lorentzFactor",
      "sr08-field-transformation",
      { ...SR08_DEFAULTS, boost: 1.5 * C_SI },
    ],
    [
      SR12_READER_WEAVE,
      createSr12Session(),
      "lorentzFactor",
      "sr12-charge-density-transformation",
      { ...SR12_DEFAULTS, boost: 1.5 * C_SI },
    ],
  ] as const) {
    const source = createSessionWeave(session, binding);
    const before = source.getSnapshot();
    const accepted = session.getSnapshot().accepted;
    assert.ok(accepted);
    const outputs = accepted.outputs.map((output) =>
      output.quantityId === quantity ? { ...output, value: Number.NaN } : output,
    );
    expect(flags({ ...accepted, outputs }, binding)[affected]?.state).toBe("not-evaluable");
    expect(session.apply(invalid).kind).toBe("refused");
    expect(source.getSnapshot()).toBe(before);
    // These refusals happen before a store command. The production reader test below proves
    // that the form suspends the kept snapshot's source highlights until a valid trial.
  }
});
