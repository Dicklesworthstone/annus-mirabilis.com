import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { LQ07_DEFAULTS, LQ07_OUTPUTS } from "../../experiments/lq07/definition.ts";
import { createLq07Session } from "../../experiments/lq07/session.ts";
import { LQ09_DEFAULTS, LQ09_OUTPUTS } from "../../experiments/lq09/definition.ts";
import { createLq09Session } from "../../experiments/lq09/session.ts";
import type { AcceptedSnapshot, ExperimentView } from "../../experiments/store/instanceStore.ts";
import { createWeaveEvaluator } from "../../experiments/weave/evaluate.ts";
import { checkPointerVoice } from "../../experiments/weave/pointerVoice.ts";
import { createSessionWeave, type WeaveSession, weaveOutputs } from "../../experiments/weave/sessionSource.ts";
import { validateWeavePredicate } from "../../experiments/weave/validate.ts";
import { closingQuantaReaderWeave, LQ07_READER_WEAVES, LQ09_READER_WEAVES } from "./closingQuantaPassages.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

function accepted(session: WeaveSession): AcceptedSnapshot {
  const result = session.getSnapshot().accepted;
  assert.ok(result);
  return result;
}
function flags(snapshot: AcceptedSnapshot, binding: ReaderWeaveBinding) {
  return createWeaveEvaluator(binding.predicates).evaluate({
    runId: snapshot.runId, snapshotVersion: snapshot.snapshotVersion,
    outputs: weaveOutputs(snapshot), refused: false,
  }).flags;
}

test("all closing predicates use actual source sentences and declared owner outputs", () => {
  for (const binding of [...Object.values(LQ07_READER_WEAVES), ...Object.values(LQ09_READER_WEAVES)]) {
    const manifest = load(readFileSync(new URL(
      "../../../content/experiments/" + binding.instrumentId + ".yaml", import.meta.url,
    ), "utf8")) as { weavePredicates: string[] };
    const sourceIds = new Set<string>();
    for (const passage of Object.values(binding.passages)) {
      const block = passage.sentenceId.replace(/-s\d+$/, "");
      const source = load(readFileSync(new URL(
        "../../../content/source-blocks/light-quanta/" + block + ".yaml", import.meta.url,
      ), "utf8")) as { sentenceSpans: { id: string }[] };
      expect(source.sentenceSpans.some((sentence) => sentence.id === passage.sentenceId)).toBe(true);
      for (const sentence of source.sentenceSpans) sourceIds.add(sentence.id);
    }
    for (const predicate of binding.predicates) {
      expect(manifest.weavePredicates).toContain(predicate.id);
      expect(validateWeavePredicate(predicate, {
        instrumentOutputIds: new Set(Object.keys(binding.instrumentId === "lq-07" ? LQ07_OUTPUTS : LQ09_OUTPUTS)),
        resolvableTargetIds: sourceIds,
      })).toEqual(predicate);
      expect(checkPointerVoice(predicate)).toEqual([]);
      expect(predicate.meaning).not.toBe("agreement-within-stated-bound");
      expect(binding.passages[predicate.id]?.sentenceId).toBe(predicate.targets[0]);
    }
  }
});

test("fluorescence follows accepted energy assumptions and withholds rates that the owner does not supply", () => {
  const session = createLq07Session("closing-fluorescence");
  let snapshot = accepted(session);
  const baseline = LQ07_READER_WEAVES["standard-stokes"];
  expect(closingQuantaReaderWeave("lq-07", snapshot)).toBe(baseline);
  expect(flags(snapshot, baseline)["lq07-s7-energy-conservation"]?.lit).toBe(true);
  expect(flags(snapshot, baseline)["lq07-s7-weak-illumination-rate"]?.lit).toBe(true);

  expect(session.apply({ ...LQ07_DEFAULTS, nu2: 900 }).kind).toBe("accepted");
  snapshot = accepted(session);
  expect(flags(snapshot, baseline)["lq07-s7-energy-conservation"]?.lit).toBe(true);
  expect(flags(snapshot, baseline)["lq07-s7-weak-illumination-rate"]?.lit).toBe(false);

  expect(session.apply({ ...LQ07_DEFAULTS, regime: "deviation-multi-quantum", multiQuantumK: 2, nu2: 900 }).kind).toBe("accepted");
  snapshot = accepted(session);
  const pooled = closingQuantaReaderWeave("lq-07", snapshot);
  assert.ok(pooled);
  expect(flags(snapshot, pooled)["lq07-s7-multi-quantum-deviation"]?.lit).toBe(true);
  expect(pooled.predicates.some((p) => p.id === "lq07-s7-weak-illumination-rate")).toBe(false);

  expect(session.apply({ ...LQ07_DEFAULTS, regime: "deviation-non-wien", sourceTemperatureK: 20000 }).kind).toBe("accepted");
  snapshot = accepted(session);
  const outside = closingQuantaReaderWeave("lq-07", snapshot);
  assert.ok(outside);
  const result = flags(snapshot, outside);
  expect(result["lq07-s7-non-wien-boundary"]?.lit).toBe(true);
  expect(result["lq07-s7-energy-conservation"]?.lit).toBe(false);
  expect(result["lq07-s7-weak-illumination-rate"]?.lit).toBe(false);

  expect(session.apply({ ...LQ07_DEFAULTS, regime: "modern-thermal", nu2: 900 }).kind).toBe("accepted");
  snapshot = accepted(session);
  const modern = closingQuantaReaderWeave("lq-07", snapshot);
  assert.ok(modern);
  expect(flags(snapshot, modern)["lq07-s7-body-energy-premise"]?.lit).toBe(true);
  expect(modern.predicates.some((p) => p.id === "lq07-s7-non-wien-boundary")).toBe(false);
});

test("the ionization threshold never supplies a missing yield or overrides a below-threshold status", () => {
  const session = createLq09Session("closing-ionization");
  const full = LQ09_READER_WEAVES["all-absorbed-ionizes"];
  expect(flags(accepted(session), full)["lq09-s9-full-yield-count"]?.lit).toBe(true);
  for (const [mode, countId] of [
    ["declared-fraction", "lq09-s9-declared-yield"],
    ["unknown", "lq09-s9-unknown-yield"],
  ] as const) {
    expect(session.apply({ ...LQ09_DEFAULTS, absorptionMode: mode, declaredFraction: 0.25 }).kind).toBe("accepted");
    const snapshot = accepted(session);
    const selected = closingQuantaReaderWeave("lq-09", snapshot);
    assert.ok(selected);
    expect(flags(snapshot, selected)["lq09-s9-energy-threshold"]?.lit).toBe(true);
    expect(flags(snapshot, selected)[countId]?.lit).toBe(true);
    expect(selected.predicates.some((p) => p.id === "lq09-s9-full-yield-count")).toBe(false);
  }
  expect(session.apply({ ...LQ09_DEFAULTS, frequency: 2.17619e15 }).kind).toBe("accepted");
  const subthreshold = flags(accepted(session), full);
  expect(subthreshold["lq09-s9-energy-threshold"]?.lit).toBe(true);
  expect(subthreshold["lq09-s9-below-threshold"]?.lit).toBe(true);
  expect(subthreshold["lq09-s9-full-yield-count"]?.lit).toBe(false);
});

test("missing accepted metadata, duplicated outputs and nonfinite numbers do not acquire a comparison", () => {
  for (const instrumentId of ["lq-07", "lq-09"] as const) {
    expect(closingQuantaReaderWeave(instrumentId, null)).toBeNull();
    expect(closingQuantaReaderWeave(instrumentId, { parameters: {} })).toBeNull();
    expect(closingQuantaReaderWeave(instrumentId, { parameters: { regime: "unknown", absorptionMode: "unrecorded" } })).toBeNull();
  }
  const snapshot = accepted(createLq09Session("closing-missing-outputs"));
  const reading = snapshot.outputs.find((output) => output.quantityId === "ionizationCount");
  assert.ok(reading && reading.status === "value");
  for (const outputs of [
    snapshot.outputs.filter((output) => output !== reading),
    [...snapshot.outputs, reading],
    snapshot.outputs.map((output) => output === reading ? { ...reading, value: Number.NaN } : output),
  ]) {
    const result = flags({ ...snapshot, outputs }, LQ09_READER_WEAVES["all-absorbed-ionizes"]);
    expect(result["lq09-s9-full-yield-count"]?.lit).toBe(false);
    expect(result["lq09-s9-energy-threshold"]?.lit).toBe(true);
  }
});

test("pending and refused views retain the accepted trial without lighting its old source comparison", () => {
  const original = createLq09Session("closing-pending");
  const server = original.getServerSnapshot();
  let current: ExperimentView = server;
  const session: WeaveSession = {
    getSnapshot: () => current,
    getServerSnapshot: () => server,
    subscribe: () => () => {},
  };
  const source = createSessionWeave(session, LQ09_READER_WEAVES["all-absorbed-ionizes"]);
  const initial = source.getSnapshot();
  assert.equal(initial.kind, "ready");
  if (initial.kind !== "ready") return;
  expect(initial.accepted).toBe(server.accepted);
  current = { ...server, pending: true };
  expect(source.getSnapshot()).toEqual({ kind: "inactive", reason: "pending" });
  current = { ...server, status: "refused" };
  expect(source.getSnapshot()).toEqual({ kind: "inactive", reason: "refused" });
  current = { ...server };
  expect(source.getSnapshot().kind).toBe("ready");
});
