import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { SR09_DEFAULTS, SR09_EVENTS, SR09_OUTPUTS } from "../../experiments/sr09/definition.ts";
import { sr09InputFromParameters } from "../../experiments/sr09/parameters.ts";
import { createSr09Session } from "../../experiments/sr09/session.ts";
import { SR10_DEFAULTS, SR10_OUTPUTS } from "../../experiments/sr10/definition.ts";
import { createSr10Session } from "../../experiments/sr10/session.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { createWeaveEvaluator } from "../../experiments/weave/evaluate.ts";
import { checkPointerVoice } from "../../experiments/weave/pointerVoice.ts";
import { createSessionWeave, weaveOutputs } from "../../experiments/weave/sessionSource.ts";
import { validateWeavePredicate } from "../../experiments/weave/validate.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";
import { SR09_READER_WEAVE, SR10_READER_WEAVE } from "./wavePassages.ts";

function flags(snapshot: AcceptedSnapshot, binding: ReaderWeaveBinding) {
  return createWeaveEvaluator(binding.predicates).evaluate({
    runId: snapshot.runId,
    snapshotVersion: snapshot.snapshotVersion,
    outputs: weaveOutputs(snapshot),
    refused: false,
  }).flags;
}

for (const [binding, outputs] of [
  [SR09_READER_WEAVE, SR09_OUTPUTS],
  [SR10_READER_WEAVE, SR10_OUTPUTS],
] as const) {
  test(`${binding.instrumentId} connects declared predicates to real source sentences and owner outputs`, () => {
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
    expect(binding.predicates.length).toBeGreaterThan(0);
    for (const predicate of binding.predicates) {
      expect(manifest.weavePredicates).toContain(predicate.id);
      expect(
        validateWeavePredicate(predicate, {
          instrumentOutputIds: new Set(Object.keys(outputs)),
          resolvableTargetIds: ids,
        }),
      ).toEqual(predicate);
      expect(checkPointerVoice(predicate)).toEqual([]);
      expect(predicate.meaning).toBe(
        predicate.id === "sr09-phase-invariance"
          ? "agreement-within-stated-bound"
          : "quantity-compared",
      );
      expect(binding.passages[predicate.id]?.sentenceId).toBe(predicate.targets[0]);
    }
  });
}

test("the same accepted ray drives Doppler and aberration pointers for longitudinal and transverse views", () => {
  const session = createSr09Session("wave-pointers");
  const source = createSessionWeave(session, SR09_READER_WEAVE);
  const initial = source.getSnapshot();
  assert.equal(initial.kind, "ready");
  if (initial.kind !== "ready") return;
  expect(initial.prepared).toBe(true);
  expect(source.getServerSnapshot()).toBe(initial);
  for (const [angle, expectedFactor] of [
    [0, 0.5],
    [180, 2],
    [90, 1.25],
  ] as const) {
    expect(session.apply({ ...SR09_DEFAULTS, propagationAngleDeg: angle }).kind).toBe("accepted");
    const current = source.getSnapshot();
    assert.equal(current.kind, "ready");
    if (current.kind !== "ready") continue;
    expect(current.accepted).toBe(session.getSnapshot().accepted);
    expect(weaveOutputs(current.accepted).dopplerFactor?.value).toBeCloseTo(expectedFactor, 12);
    expect(current.derived.flags["sr09-doppler-principle"]?.lit).toBe(true);
    expect(current.derived.flags["sr09-aberration-formula"]?.lit).toBe(true);
    expect(current.derived.flags["sr09-phase-invariance"]?.lit).toBe(true);
    expect(source.getSnapshot()).toBe(current);
  }
  const before = session.getSnapshot().accepted;
  expect(session.apply({ ...session.acceptedParameters(), beta: -0.6 }).kind).toBe("accepted");
  expect(session.getSnapshot().accepted?.runId).toBe(before?.runId);
  const after = source.getSnapshot();
  assert.equal(after.kind, "ready");
  if (after.kind === "ready") expect(after.accepted).toBe(session.getSnapshot().accepted);
});

test("phase invariance follows the selected fixed event without creating another physical run", () => {
  const session = createSr09Session("selected-phase-pointers");
  const source = createSessionWeave(session, SR09_READER_WEAVE);
  const original = session.getSnapshot().accepted;
  assert.ok(original);
  for (const event of SR09_EVENTS) {
    expect(session.apply({ ...session.acceptedParameters(), selectedEventId: event.id }).kind).toBe(
      "accepted",
    );
    const current = source.getSnapshot();
    assert.equal(current.kind, "ready");
    if (current.kind !== "ready") continue;
    expect(current.accepted.runId).toBe(original.runId);
    expect(current.accepted.revisions).toEqual(original.revisions);
    expect(current.accepted.parameters.selectedEventId).toBe(event.id);
    const outputs = weaveOutputs(current.accepted);
    const selected = session
      .evaluate(sr09InputFromParameters(session.acceptedParameters()))
      .events.find((entry) => entry.id === event.id);
    assert.ok(selected);
    expect(outputs.selectedEventPhaseK?.value).toBe(selected.phaseK);
    expect(outputs.selectedEventPhaseMoving?.value).toBe(selected.phase_k);
    expect(current.derived.flags["sr09-phase-invariance"]?.lit).toBe(true);
    expect(current.derived.flags["sr09-phase-invariance"]?.pointerText).toContain("10⁻¹² radians");
  }
});

test("a failed or missing owner phase verdict never borrows agreement from the other event", () => {
  const session = createSr09Session("phase-verdict-boundary");
  const accepted = session.getSnapshot().accepted;
  assert.ok(accepted);
  const id = "selectedEventPhaseAgreement";
  const verdict = accepted.outputs.find((output) => output.quantityId === id);
  assert.ok(verdict?.status === "value");
  expect(flags(accepted, SR09_READER_WEAVE)["sr09-phase-invariance"]?.lit).toBe(true);
  for (const outputs of [
    accepted.outputs.filter((output) => output !== verdict),
    [...accepted.outputs, verdict],
    ...[0, Number.NaN].map((value) =>
      accepted.outputs.map((output) => (output === verdict ? { ...output, value } : output)),
    ),
  ]) {
    const derived = flags({ ...accepted, outputs }, SR09_READER_WEAVE);
    expect(derived["sr09-phase-invariance"]?.lit).toBe(false);
    expect(derived["sr09-doppler-principle"]?.lit).toBe(true);
    expect(derived["sr09-aberration-formula"]?.lit).toBe(true);
  }
  for (const quantityId of ["selectedEventPhaseK", "selectedEventPhaseMoving"]) {
    const outputs = accepted.outputs.filter((output) => output.quantityId !== quantityId);
    const derived = flags({ ...accepted, outputs }, SR09_READER_WEAVE);
    expect(derived["sr09-phase-invariance"]?.state).toBe("not-evaluable");
    expect(derived["sr09-phase-invariance"]?.lit).toBe(false);
  }
});

test("light-energy and volume pointers read the physical snapshot even when the countermodel agrees", () => {
  const session = createSr10Session("light-complex-pointers");
  const source = createSessionWeave(session, SR10_READER_WEAVE);
  for (const [angle, energy, volume] of [
    [0, 0.5, 2],
    [180, 2, 0.5],
    [90, 1.25, 0.8],
  ] as const) {
    expect(session.apply({ ...SR10_DEFAULTS, propagationAngleDeg: angle }).kind).toBe("accepted");
    const current = source.getSnapshot();
    assert.equal(current.kind, "ready");
    if (current.kind !== "ready") continue;
    expect(current.accepted).toBe(session.getSnapshot().accepted);
    const outputs = weaveOutputs(current.accepted);
    expect(outputs.lightComplexEnergyMoving?.value).toBeCloseTo(energy, 12);
    expect(outputs.lightComplexVolumeMoving?.value).toBeCloseTo(volume, 12);
    expect(current.derived.flags["sr10-energy-frequency-proportionality"]?.lit).toBe(true);
    expect(current.derived.flags["sr10-volume-transformation"]?.lit).toBe(true);
    // A transverse ray cannot falsify the rigid-body countermodel. The weave does not claim it can.
    expect(current.derived.flags["sr10-countermodel-falsification"]).toBeUndefined();
    expect(Object.keys(outputs).some((id) => id.startsWith("countermodel"))).toBe(false);
  }
});

test("unavailable, duplicated and nonfinite readings withdraw just the affected comparison", () => {
  const cases = [
    {
      binding: SR09_READER_WEAVE,
      accepted: createSr09Session("damaged-wave").getSnapshot().accepted,
      quantity: "waveFrequencyMoving",
      affected: "sr09-doppler-principle",
      unaffected: "sr09-aberration-formula",
    },
    {
      binding: SR10_READER_WEAVE,
      accepted: createSr10Session("damaged-complex").getSnapshot().accepted,
      quantity: "lightComplexEnergyMoving",
      affected: "sr10-energy-frequency-proportionality",
      unaffected: "sr10-volume-transformation",
    },
  ];
  for (const { binding, accepted, quantity, affected, unaffected } of cases) {
    assert.ok(accepted);
    const target = accepted.outputs.find((output) => output.quantityId === quantity);
    assert.ok(target);
    expect(flags(accepted, binding)[affected]?.lit).toBe(true);
    for (const outputs of [
      accepted.outputs.filter((output) => output !== target),
      [...accepted.outputs, target],
      accepted.outputs.map((output) =>
        output === target ? { ...output, value: Number.NaN } : output,
      ),
    ]) {
      const derived = flags({ ...accepted, outputs }, binding);
      expect(derived[affected]?.state).toBe("not-evaluable");
      expect(derived[affected]?.lit).toBe(false);
      expect(derived[unaffected]?.lit).toBe(true);
    }
  }
});

test("a frequency outside the admitted range cannot relabel the last accepted comparison", () => {
  const session = createSr09Session("frequency-overflow");
  const source = createSessionWeave(session, SR09_READER_WEAVE);
  const before = source.getSnapshot();
  expect(session.apply({ ...SR09_DEFAULTS, frequencyTHz: 1e300 }).kind).toBe("refused");
  expect(source.getSnapshot()).toBe(before);
  expect(session.acceptedParameters().frequencyTHz).toBe(SR09_DEFAULTS.frequencyTHz);
  // This validation precedes a store request. The reader tests separately prove that the
  // form passes its refusal to SessionResultWeave and hides the kept comparison's pointers.
});
