import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { parseResult } from "../../experiments/results/codec.ts";
import { SR11_DEFAULTS, SR11_OUTPUTS } from "../../experiments/sr11/definition.ts";
import { createSr11Session, DEFAULT_PREPARED_EXAMPLE } from "../../experiments/sr11/session.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { createWeaveEvaluator } from "../../experiments/weave/evaluate.ts";
import { checkPointerVoice } from "../../experiments/weave/pointerVoice.ts";
import { createSessionWeave, weaveOutputs } from "../../experiments/weave/sessionSource.ts";
import { validateWeavePredicate } from "../../experiments/weave/validate.ts";
import {
  SR11_LAB_READER_WEAVE,
  SR11_MIRROR_READER_WEAVE,
  sr11ReaderWeave,
} from "./mirrorPassages.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

function accepted(session: ReturnType<typeof createSr11Session>): AcceptedSnapshot {
  const snapshot = session.getSnapshot().accepted;
  assert.ok(snapshot);
  return snapshot;
}

function flags(snapshot: AcceptedSnapshot, binding: ReaderWeaveBinding) {
  return createWeaveEvaluator(binding.predicates).evaluate({
    runId: snapshot.runId,
    snapshotVersion: snapshot.snapshotVersion,
    outputs: weaveOutputs(snapshot),
    refused: false,
  }).flags;
}

test("both mirror frames bind declared quantities to the actual reflection and energy passages", () => {
  const manifest = load(
    readFileSync(new URL("../../../content/experiments/sr-11.yaml", import.meta.url), "utf8"),
  ) as { weavePredicates: string[] };
  for (const binding of [SR11_LAB_READER_WEAVE, SR11_MIRROR_READER_WEAVE]) {
    const ids = new Set<string>();
    for (const passage of Object.values(binding.passages)) {
      const block = passage.sentenceId.replace(/-s\d+$/, "");
      const source = load(
        readFileSync(
          new URL(
            "../../../content/source-blocks/special-relativity/" + block + ".yaml",
            import.meta.url,
          ),
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
          instrumentOutputIds: new Set(Object.keys(SR11_OUTPUTS)),
          resolvableTargetIds: ids,
        }),
      ).toEqual(predicate);
      expect(checkPointerVoice(predicate)).toEqual([]);
      expect(predicate.meaning).toBe("quantity-compared");
      expect(binding.passages[predicate.id]?.sentenceId).toBe(predicate.targets[0]);
    }
  }
  expect(SR11_LAB_READER_WEAVE.passages["sr11-reflection"]?.sentenceId).toBe("s8-p7-s4");
  expect(SR11_MIRROR_READER_WEAVE.passages["sr11-reflection"]?.sentenceId).toBe("s8-p7-s3");
});

test("frame-specific source pointers follow the same accepted trial and keep the K frequency reference", () => {
  const session = createSr11Session("mirror-frame-pointers");
  const initial = accepted(session);
  expect(sr11ReaderWeave(initial)).toBe(SR11_LAB_READER_WEAVE);
  const laboratory = createSessionWeave(session, SR11_LAB_READER_WEAVE).getSnapshot();
  assert.equal(laboratory.kind, "ready");
  if (laboratory.kind !== "ready") return;
  expect(laboratory.accepted).toBe(initial);
  expect(laboratory.prepared).toBe(true);
  expect(weaveOutputs(initial).incidentFrequencyRatio?.value).toBe(1);
  expect(weaveOutputs(initial).frequencyRatio?.value).toBeCloseTo(0.25, 12);
  expect(Object.values(laboratory.derived.flags).every((flag) => flag.lit)).toBe(true);

  expect(session.apply({ ...SR11_DEFAULTS, frame: "mirror" }).kind).toBe("accepted");
  const rest = accepted(session);
  expect(rest.runId).toBe(initial.runId);
  expect(sr11ReaderWeave(rest)).toBe(SR11_MIRROR_READER_WEAVE);
  const mirrored = createSessionWeave(session, SR11_MIRROR_READER_WEAVE).getSnapshot();
  assert.equal(mirrored.kind, "ready");
  if (mirrored.kind !== "ready") return;
  expect(mirrored.accepted).toBe(rest);
  expect(weaveOutputs(rest).incidentFrequencyRatio?.value).toBeCloseTo(0.5, 12);
  expect(weaveOutputs(rest).frequencyRatio?.value).toBeCloseTo(0.5, 12);
  expect(Object.values(mirrored.derived.flags).every((flag) => flag.lit)).toBe(true);
  expect(mirrored.derived.flags["sr11-reflection"]?.pointerText).toContain(
    "original incident frequency in K",
  );
  expect(sr11ReaderWeave(null)).toBeNull();
  expect(sr11ReaderWeave({ parameters: { frame: "unrecorded" } })).toBeNull();
});

test("negative mechanical work stays comparable without treating the residual as a conservation verdict", () => {
  const session = createSr11Session("approaching-mirror-pointers");
  expect(session.apply({ ...SR11_DEFAULTS, beta: -0.6 }).kind).toBe("accepted");
  const snapshot = accepted(session);
  expect(weaveOutputs(snapshot).workRate?.value).toBeLessThan(0);
  expect(flags(snapshot, SR11_LAB_READER_WEAVE)["sr11-energy-balance"]?.lit).toBe(true);
  const changedResidual = {
    ...snapshot,
    outputs: snapshot.outputs.map((output) =>
      output.quantityId === "energyBalanceResidual" && output.status === "value"
        ? { ...output, value: -123 }
        : output,
    ),
  };
  // This pointer names a comparison, so it must not silently certify a zero-residual equation.
  expect(flags(changedResidual, SR11_LAB_READER_WEAVE)["sr11-energy-balance"]?.lit).toBe(true);
  expect(SR11_LAB_READER_WEAVE.predicates.every((p) => p.meaning === "quantity-compared")).toBe(
    true,
  );
});

test("no-catch and numerically unresolved interception withdraw every numerical comparison", () => {
  const session = createSr11Session("mirror-domain-pointers");
  for (const frame of ["lab", "mirror"] as const) {
    for (const angle of [60, (Math.acos(0.6) * 180) / Math.PI]) {
      expect(session.apply({ ...SR11_DEFAULTS, frame, incidentAngleDeg: angle }).kind).toBe(
        "accepted",
      );
      const snapshot = accepted(session);
      const binding = sr11ReaderWeave(snapshot);
      assert.ok(binding);
      for (const flag of Object.values(flags(snapshot, binding))) {
        expect(flag.lit).toBe(false);
        expect(flag.state).toBe("not-evaluable");
      }
    }
  }
  expect(session.apply(SR11_DEFAULTS).kind).toBe("accepted");
  expect(Object.values(flags(accepted(session), SR11_LAB_READER_WEAVE)).every((p) => p.lit)).toBe(
    true,
  );
});

test("missing, duplicated and nonfinite quantities disable their own comparison", () => {
  const snapshot = accepted(createSr11Session("damaged-mirror-pointers"));
  for (const [quantityId, predicateId, unaffectedId] of [
    ["incidentFrequencyRatio", "sr11-reflection", "sr11-radiation-pressure"],
    ["radiationForce", "sr11-radiation-pressure", "sr11-reflection"],
    ["workRate", "sr11-energy-balance", "sr11-reflection"],
  ] as const) {
    const target = snapshot.outputs.find((output) => output.quantityId === quantityId);
    assert.ok(target);
    for (const outputs of [
      snapshot.outputs.filter((output) => output !== target),
      [...snapshot.outputs, target],
      snapshot.outputs.map((output) =>
        output === target && output.status === "value" ? { ...output, value: Number.NaN } : output,
      ),
    ]) {
      const result = flags({ ...snapshot, outputs }, SR11_LAB_READER_WEAVE);
      expect(result[predicateId]?.state).toBe("not-evaluable");
      expect(result[predicateId]?.lit).toBe(false);
      expect(result[unaffectedId]?.lit).toBe(true);
    }
  }
});

test("a partial accepted checkpoint can lack incident geometry without inventing a reflection comparison", () => {
  const missing = new Set(["incidentAngleInFrameDeg", "incidentFrequencyRatio"]);
  const legacy = {
    ...DEFAULT_PREPARED_EXAMPLE,
    results: DEFAULT_PREPARED_EXAMPLE.results.filter(
      (output) => !missing.has(parseResult(output).quantityId),
    ),
  };
  const original = createSr11Session("partial-mirror-checkpoint", legacy);
  const checkpoint = original.exportCheckpoint();
  assert.ok(checkpoint);
  const restored = createSr11Session("partial-mirror-checkpoint");
  expect(restored.restoreCheckpoint(checkpoint).kind).toBe("restored");
  const snapshot = accepted(restored);
  expect(snapshot.outputs.some((output) => missing.has(output.quantityId))).toBe(false);
  const result = flags(snapshot, SR11_LAB_READER_WEAVE);
  expect(result["sr11-reflection"]?.state).toBe("not-evaluable");
  expect(result["sr11-reflection"]?.lit).toBe(false);
  expect(result["sr11-radiation-pressure"]?.lit).toBe(true);
  expect(result["sr11-energy-balance"]?.lit).toBe(true);
});
