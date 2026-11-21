import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { SR13_DEFAULTS, SR13_OUTPUTS } from "../../experiments/sr13/definition.ts";
import { createSr13Session } from "../../experiments/sr13/session.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { createWeaveEvaluator } from "../../experiments/weave/evaluate.ts";
import { checkPointerVoice } from "../../experiments/weave/pointerVoice.ts";
import { createSessionWeave, weaveOutputs } from "../../experiments/weave/sessionSource.ts";
import { validateWeavePredicate } from "../../experiments/weave/validate.ts";
import { weaveContext } from "./context.ts";
import { SR13_READER_WEAVE } from "./electronPassages.ts";

const binding = SR13_READER_WEAVE;

function flags(snapshot: AcceptedSnapshot) {
  return createWeaveEvaluator(binding.predicates).evaluate({
    runId: snapshot.runId,
    snapshotVersion: snapshot.snapshotVersion,
    outputs: weaveOutputs(snapshot),
    refused: false,
  }).flags;
}

test("electron pointers bind declared comparisons to real sentences and accepted owner quantities", () => {
  const manifest = load(
    readFileSync(new URL("../../../content/experiments/sr-13.yaml", import.meta.url), "utf8"),
  ) as { weavePredicates: string[] };
  const ids = new Set<string>();
  for (const passage of Object.values(binding.passages)) {
    const block = passage.sentenceId.replace(/-s\d+$/, "");
    const source = load(
      readFileSync(
        new URL(`../../../content/source-blocks/special-relativity/${block}.yaml`, import.meta.url),
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
        instrumentOutputIds: new Set(Object.keys(SR13_OUTPUTS)),
        resolvableTargetIds: ids,
      }),
    ).toEqual(predicate);
    expect(checkPointerVoice(predicate)).toEqual([]);
    expect(predicate.meaning).toBe("quantity-compared");
    expect(binding.passages[predicate.id]?.sentenceId).toBe(predicate.targets[0]);
  }
});

test("force-convention changes keep the motion and update accepted context without restarting it", () => {
  const session = createSr13Session("electron-conventions");
  const source = createSessionWeave(session, binding);
  const before = source.getSnapshot();
  assert.ok(before.kind === "ready");
  expect(before.prepared).toBe(true);
  const path = before.accepted.outputs.find(
    (output) => output.quantityId === "trajectoryPositions",
  );
  assert.ok(path?.status === "value" && typeof path.value !== "number");
  expect(session.apply({ ...SR13_DEFAULTS, forceConvention: "laboratory" }).kind).toBe("accepted");
  const after = source.getSnapshot();
  assert.ok(after.kind === "ready");
  expect(after.accepted).toBe(session.getSnapshot().accepted);
  expect(after.accepted.runId).toBe(before.accepted.runId);
  const newPath = after.accepted.outputs.find(
    (output) => output.quantityId === "trajectoryPositions",
  );
  assert.ok(newPath?.status === "value" && typeof newPath.value !== "number");
  expect(newPath.value.copy()).toEqual(path.value.copy());
  expect(weaveContext(after.accepted, binding.contextFields)).toContainEqual({
    id: "forceConvention",
    label: "Force convention",
    value: "Laboratory force",
  });
  for (const flag of Object.values(after.derived.flags)) expect(flag.lit).toBe(true);
  expect(source.getServerSnapshot()).toBe(before);
});

test("energy pointers include rest and high subluminal speeds without claiming an infinite numeric result", () => {
  const session = createSr13Session("electron-energies");
  for (const initialSpeed of [0, 0.6, 0.9, 0.95]) {
    expect(session.apply({ ...SR13_DEFAULTS, initialSpeed }).kind).toBe("accepted");
    const accepted = session.getSnapshot().accepted;
    assert.ok(accepted);
    const outputs = weaveOutputs(accepted);
    expect(Number.isFinite(outputs.kineticEnergy?.value)).toBe(true);
    expect(flags(accepted)["sr13-infinite-energy"]?.lit).toBe(true);
  }
  const before = session.getSnapshot().accepted;
  expect(session.apply({ ...SR13_DEFAULTS, initialSpeed: 1 }).kind).toBe("refused");
  expect(session.getSnapshot().accepted).toBe(before);
});

test("neutral custom particles still compare mass and work without borrowing unavailable voltages", () => {
  const session = createSr13Session("electron-neutral-weave");
  expect(session.apply({ ...SR13_DEFAULTS, particle: "custom", customCharge: 0 }).kind).toBe(
    "accepted",
  );
  const accepted = session.getSnapshot().accepted;
  assert.ok(accepted);
  expect(weaveOutputs(accepted).acceleratingPotential?.status).toBe("outside-domain");
  for (const flag of Object.values(flags(accepted))) expect(flag.lit).toBe(true);
});

test("missing, ambiguous or nonfinite values withdraw only their own comparison", () => {
  const accepted = createSr13Session("electron-incomplete-weave").getSnapshot().accepted;
  assert.ok(accepted);
  for (const [quantity, affected, unaffected] of [
    ["transverseMassComoving", "sr13-force-convention", "sr13-infinite-energy"],
    ["kineticEnergy", "sr13-infinite-energy", "sr13-force-convention"],
  ] as const) {
    const target = accepted.outputs.find((output) => output.quantityId === quantity);
    assert.ok(target);
    for (const outputs of [
      accepted.outputs.filter((output) => output !== target),
      [...accepted.outputs, target],
      accepted.outputs.map((output) =>
        output === target ? { ...output, value: Number.NaN } : output,
      ),
    ]) {
      const derived = flags({ ...accepted, outputs });
      expect(derived[affected]?.lit).toBe(false);
      expect(derived[affected]?.state).toBe("not-evaluable");
      expect(derived[unaffected]?.lit).toBe(true);
    }
  }
});
