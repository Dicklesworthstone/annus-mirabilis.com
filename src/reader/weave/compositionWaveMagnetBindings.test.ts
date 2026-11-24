import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import {
  LQ01_DEFAULTS,
  LQ01_OUTPUTS,
  type Lq01Parameters,
} from "../../experiments/lq01/definition.ts";
import { createLq01Session, type PreparedLq01Example } from "../../experiments/lq01/session.ts";
import { encodeResult } from "../../experiments/results/codec.ts";
import { SR02_DEFAULTS, SR02_OUTPUTS } from "../../experiments/sr02/definition.ts";
import { createSr02Session } from "../../experiments/sr02/session.ts";
import { SR06_DEFAULTS, SR06_OUTPUTS } from "../../experiments/sr06/definition.ts";
import { createSr06Session } from "../../experiments/sr06/session.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { createWeaveEvaluator } from "../../experiments/weave/evaluate.ts";
import { checkPointerVoice } from "../../experiments/weave/pointerVoice.ts";
import {
  createSessionWeave,
  type SessionWeave,
  weaveOutputs,
} from "../../experiments/weave/sessionSource.ts";
import { validateWeavePredicate } from "../../experiments/weave/validate.ts";
import example from "../../generated/lq01-example.json";
import { createLq01Host } from "../../workers/host/lq01Host.ts";
import { evaluateLq01 } from "../../workers/operations/lq01.ts";
import type { WorkerChannel } from "../../workers/scheduler/lq01Scheduler.ts";
import { SR06_COLLINEAR_READER_WEAVE, sr06ReaderWeave } from "./compositionPassages.ts";
import { weaveContext } from "./context.ts";
import { SR02_READER_WEAVE, sr02ReaderWeave } from "./magnetConductorPassages.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";
import {
  LQ01_AVERAGE_READER_WEAVE,
  LQ01_SPREADING_READER_WEAVE,
  lq01ReaderWeave,
} from "./waveDescriptionPassages.ts";

const SUBLIGHT = "sr06-subluminal-composition";
const LIGHT = "sr06-null-stays-null";
const WAVE = "lq01-s0-wave-success";
const AVERAGE = "lq01-s0-time-averages";
const SPREADING = "lq01-s0-energy-spreading";

function ready(state: SessionWeave) {
  assert.ok(state.kind === "ready", "Expected an accepted owner calculation");
  return state;
}

function flags(binding: ReaderWeaveBinding, snapshot: AcceptedSnapshot) {
  return createWeaveEvaluator(binding.predicates).evaluate({
    runId: snapshot.runId,
    snapshotVersion: snapshot.snapshotVersion,
    constantSetId:
      typeof binding.constantSetId === "string"
        ? binding.constantSetId
        : binding.constantSetId(snapshot),
    outputs: weaveOutputs(snapshot),
    refused: false,
  }).flags;
}

async function waveSnapshot(parameters: Lq01Parameters) {
  const evaluated = await evaluateLq01(parameters);
  assert.ok(evaluated.kind === "accepted");
  const session = createLq01Session("wave-binding", {
    ...example,
    parameters,
    results: evaluated.data.outputs.map(encodeResult),
    stepIndex: evaluated.data.stepIndex,
    simulationTime: evaluated.data.simulationTime,
  });
  const snapshot = session.getSnapshot().accepted;
  assert.ok(snapshot);
  return snapshot;
}

test("all seven new pointers resolve to declared source sentences and owner output contracts", () => {
  for (const [binding, outputs] of [
    [SR06_COLLINEAR_READER_WEAVE, SR06_OUTPUTS],
    [SR02_READER_WEAVE, SR02_OUTPUTS],
    [LQ01_AVERAGE_READER_WEAVE, LQ01_OUTPUTS],
    [LQ01_SPREADING_READER_WEAVE, LQ01_OUTPUTS],
  ] as const) {
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
  }
});

test("composition distinguishes timelike and null owner results, even when a timelike speed rounds to c", () => {
  for (const parameters of [
    SR06_DEFAULTS,
    { ...SR06_DEFAULTS, frameBeta: 0, movingSpeed: 0 },
    { ...SR06_DEFAULTS, frameBeta: 1 - Number.EPSILON, movingSpeed: 1 - Number.EPSILON },
    { ...SR06_DEFAULTS, mode: "two-boosts" as const, movingSpeed: 1 },
  ]) {
    const session = createSr06Session("composition-timelike", parameters);
    const state = ready(createSessionWeave(session, SR06_COLLINEAR_READER_WEAVE).getSnapshot());
    expect(state.derived.flags[SUBLIGHT]?.lit).toBe(true);
    expect(state.derived.flags[LIGHT]?.lit).toBe(false);
    expect(weaveOutputs(state.accepted).shortfall?.value).toBeGreaterThan(0);
    if (parameters.frameBeta === 1 - Number.EPSILON) {
      expect(weaveOutputs(state.accepted).composedSpeedOverC?.value).toBe(1);
    }
  }
  for (const mode of ["collinear", "angled"] as const) {
    const session = createSr06Session("composition-light", {
      ...SR06_DEFAULTS,
      movingSpeed: 1,
      mode,
      alphaDeg: 90,
    });
    const state = ready(createSessionWeave(session, SR06_COLLINEAR_READER_WEAVE).getSnapshot());
    expect(state.derived.flags[LIGHT]?.lit).toBe(true);
    expect(state.derived.flags[SUBLIGHT]?.lit).toBe(false);
    expect(weaveOutputs(state.accepted).composedGamma?.status).toBe("not-applicable");
  }
});

test("composition context follows active controls and a new run cannot retain the light-ray pointer", () => {
  const session = createSr06Session("composition-reset", {
    ...SR06_DEFAULTS,
    mode: "angled",
    movingSpeed: 1,
  });
  const source = createSessionWeave(session, SR06_COLLINEAR_READER_WEAVE);
  const first = ready(source.getSnapshot());
  expect(first.prepared).toBe(true);
  expect(first.derived.flags[LIGHT]?.lit).toBe(true);
  expect(session.startNewRun({ ...SR06_DEFAULTS, mode: "two-boosts", movingSpeed: 1 }).kind).toBe(
    "accepted",
  );
  const next = ready(source.getSnapshot());
  expect(next.prepared).toBe(false);
  expect(next.accepted.runId).not.toBe(first.accepted.runId);
  expect(next.derived.flags[LIGHT]?.lit).toBe(false);
  expect(next.derived.flags[SUBLIGHT]?.lit).toBe(true);
  const binding = sr06ReaderWeave(next.accepted);
  assert.ok(binding);
  expect(weaveContext(next.accepted, binding.contextFields).map((field) => field.id)).toEqual([
    "mode",
    "frameBeta",
    "secondBeta",
    "secondAngleDeg",
  ]);
  expect(sr06ReaderWeave({ parameters: { mode: "unknown" } })).toBeNull();
});

test("wave pointers use the accepted experiment and readout, not unrelated outputs that happen to exist", async () => {
  const averaged = await waveSnapshot(LQ01_DEFAULTS);
  const instantaneous = await waveSnapshot({ ...LQ01_DEFAULTS, readout: "instantaneous" });
  const spreading = await waveSnapshot({
    ...LQ01_DEFAULTS,
    mode: "spreading",
    readout: "instantaneous",
    r: 2,
  });
  const averageBinding = lq01ReaderWeave(averaged);
  const instantBinding = lq01ReaderWeave(instantaneous);
  const spreadingBinding = lq01ReaderWeave(spreading);
  assert.ok(averageBinding && instantBinding && spreadingBinding);
  expect(Object.keys(flags(averageBinding, averaged))).toEqual([WAVE, AVERAGE]);
  expect(flags(averageBinding, averaged)[AVERAGE]?.lit).toBe(true);
  expect(Object.keys(flags(instantBinding, instantaneous))).toEqual([WAVE]);
  expect(Object.keys(flags(spreadingBinding, spreading))).toEqual([SPREADING]);
  expect(flags(spreadingBinding, spreading)[SPREADING]?.lit).toBe(true);
  // The other model's readings really exist; their presence must not select a passage.
  expect(weaveOutputs(spreading).fringeVisibility?.value).toBe(1);
  expect(weaveOutputs(averaged).pointSourceIntensity?.status).toBe("value");
  expect(weaveContext(spreading, spreadingBinding.contextFields).map((field) => field.id)).toEqual([
    "mode",
    "P",
    "r",
  ]);
  expect(lq01ReaderWeave({ parameters: { mode: "interference", readout: "unknown" } })).toBeNull();
  expect(lq01ReaderWeave(null)).toBeNull();
});

test("a dark interference fringe still illustrates superposition, but one or no wave does not", async () => {
  const dark = await waveSnapshot({ ...LQ01_DEFAULTS, delta: Math.PI });
  expect(weaveOutputs(dark).centerIntensity?.value).toBeCloseTo(0, 12);
  expect(flags(LQ01_AVERAGE_READER_WEAVE, dark)[WAVE]?.lit).toBe(true);
  for (const parameters of [
    { ...LQ01_DEFAULTS, A2: 0 },
    { ...LQ01_DEFAULTS, A1: 0, A2: 0 },
  ]) {
    const snapshot = await waveSnapshot(parameters);
    expect(weaveOutputs(snapshot).fringeVisibility?.value).toBe(0);
    expect(flags(LQ01_AVERAGE_READER_WEAVE, snapshot)[WAVE]?.lit).toBe(false);
  }
});

test("magnet pointers compare local forces even when the path EMFs cannot be compared, and exclude symbolic apparatus results", () => {
  const session = createSr02Session("magnet-binding");
  const source = createSessionWeave(session, SR02_READER_WEAVE);
  expect(ready(source.getSnapshot()).prepared).toBe(true);
  expect(
    session.apply({ ...SR02_DEFAULTS, pathOrientation: "along-motion", sliceDeclared: false }).kind,
  ).toBe("accepted");
  const path = ready(source.getSnapshot());
  expect(weaveOutputs(path.accepted).electromotiveForceConductorFrame?.status).toBe(
    "not-applicable",
  );
  expect(Object.values(path.derived.flags).every((flag) => flag.lit)).toBe(true);
  expect(
    session.apply({ ...SR02_DEFAULTS, pathOrientation: "along-motion", sliceDeclared: true }).kind,
  ).toBe("accepted");
  const declaredPath = ready(source.getSnapshot());
  expect(weaveOutputs(declaredPath.accepted).electromotiveForceConductorFrame).toMatchObject({
    status: "value",
    value: 0,
  });
  expect(weaveOutputs(declaredPath.accepted).electromotiveForceExcess?.status).toBe(
    "not-applicable",
  );
  expect(Object.values(declaredPath.derived.flags).every((flag) => flag.lit)).toBe(true);
  expect(session.apply({ ...SR02_DEFAULTS, speed: 0 }).kind).toBe("accepted");
  const stationary = ready(source.getSnapshot());
  expect(weaveOutputs(stationary.accepted).transverseForceLaboratory?.value).toBeCloseTo(0, 15);
  expect(weaveOutputs(stationary.accepted).transverseForceComoving?.value).toBeCloseTo(0, 15);
  expect(stationary.derived.flags["sr02-introduction-asymmetry"]?.pointerText).toContain(
    "at zero relative speed both vanish",
  );
  expect(session.apply({ ...SR02_DEFAULTS, mode: "apparatus" }).kind).toBe("accepted");
  const apparatus = ready(source.getSnapshot());
  expect(sr02ReaderWeave(apparatus.accepted)).toBeNull();
  expect(Object.values(apparatus.derived.flags).every((flag) => !flag.lit)).toBe(true);
  expect(session.startNewRun(SR02_DEFAULTS).kind).toBe("accepted");
  expect(Object.values(ready(source.getSnapshot()).derived.flags).every((flag) => flag.lit)).toBe(
    true,
  );
});

test("missing, nonfinite and typed non-value readings cannot be replaced by plausible settings", async () => {
  const composition = createSr06Session("missing-composition").getSnapshot().accepted;
  const magnet = createSr02Session("missing-magnet").getSnapshot().accepted;
  const wave = await waveSnapshot(LQ01_DEFAULTS);
  const spreading = await waveSnapshot({ ...LQ01_DEFAULTS, mode: "spreading" });
  assert.ok(composition && magnet);
  for (const [binding, snapshot] of [
    [SR06_COLLINEAR_READER_WEAVE, composition],
    [SR02_READER_WEAVE, magnet],
    [LQ01_AVERAGE_READER_WEAVE, wave],
    [LQ01_SPREADING_READER_WEAVE, spreading],
  ] as const) {
    for (const predicate of binding.predicates) {
      const condition = predicate.conditions.find(
        (condition) => condition.kind === "threshold" || condition.kind === "regime",
      );
      assert.ok(condition);
      const quantityId = condition.kind === "threshold" ? condition.quantityId : condition.on;
      const missing = snapshot.outputs.filter((output) => output.quantityId !== quantityId);
      expect(flags(binding, { ...snapshot, outputs: missing })[predicate.id]?.state).toBe(
        "not-evaluable",
      );
      const nonfinite = snapshot.outputs.map((output) =>
        output.quantityId === quantityId && output.status === "value"
          ? { ...output, value: Number.NaN }
          : output,
      );
      expect(flags(binding, { ...snapshot, outputs: nonfinite })[predicate.id]?.lit).toBe(false);
      const unavailable = snapshot.outputs.map((output) =>
        output.quantityId === quantityId
          ? {
              quantityId,
              unit: output.unit,
              semanticKind: output.semanticKind,
              ownerId: output.ownerId,
              status: "outside-domain" as const,
              condition: "outside-numerical-range",
              domainKind: "numerical" as const,
              reason: "No representable scalar in this trial.",
              boundary: { alternativeModel: "Inspect the symbolic relation." },
            }
          : output,
      );
      expect(flags(binding, { ...snapshot, outputs: unavailable })[predicate.id]?.lit).toBe(false);
    }
  }
});

test("the wave binding follows actual worker publications, hides pending results, and starts no additional worker", async () => {
  let creations = 0;
  let disposals = 0;
  const session = createLq01Session("wave-live", example as PreparedLq01Example, () => {
    creations++;
    let receive: Parameters<WorkerChannel["listen"]>[0] | undefined;
    const host = createLq01Host(
      (message) => receive?.(structuredClone(message)),
      example.sourceDigest,
    );
    return {
      send(message) {
        void host.receive(structuredClone(message));
      },
      listen(listener) {
        receive = listener;
        queueMicrotask(() => host.hello());
        return () => {
          receive = undefined;
        };
      },
      dispose() {
        disposals++;
        host.dispose();
      },
    };
  });
  const source = createSessionWeave(session, LQ01_AVERAGE_READER_WEAVE);
  const initial = ready(source.getSnapshot());
  expect(initial.prepared).toBe(true);
  expect(creations).toBe(0);
  const seen: SessionWeave[] = [];
  const unsubscribe = source.subscribe(() => seen.push(source.getSnapshot()));
  async function settle() {
    if (!session.getSnapshot().pending) return;
    await new Promise<void>((resolve) => {
      const stop = session.subscribe(() => {
        if (!session.getSnapshot().pending) {
          stop();
          resolve();
        }
      });
    });
  }
  try {
    expect(session.apply({ ...LQ01_DEFAULTS, delta: Math.PI }).kind).toBe("accepted");
    expect(source.getSnapshot()).toEqual({ kind: "inactive", reason: "pending" });
    await settle();
    const current = ready(source.getSnapshot());
    expect(current.accepted).toBe(session.getSnapshot().accepted);
    expect(current.prepared).toBe(false);
    expect(current.derived.flags[WAVE]?.lit).toBe(true);
    expect(weaveOutputs(current.accepted).centerIntensity?.value).toBeCloseTo(0, 12);
    expect(seen.some((state) => state.kind === "inactive" && state.reason === "pending")).toBe(
      true,
    );
    expect(session.startNewRun({ ...LQ01_DEFAULTS, mode: "spreading", r: 2 }).kind).toBe(
      "accepted",
    );
    expect(source.getSnapshot()).toEqual({ kind: "inactive", reason: "pending" });
    await settle();
    const next = ready(source.getSnapshot());
    expect(next.accepted.runId).not.toBe(current.accepted.runId);
    const binding = lq01ReaderWeave(next.accepted);
    assert.ok(binding);
    expect(binding.predicates.map((p) => p.id)).toEqual([SPREADING]);
    expect(flags(binding, next.accepted)[SPREADING]?.lit).toBe(true);
    expect(source.getServerSnapshot()).toBe(initial);
    expect(creations).toBe(1);
  } finally {
    unsubscribe();
    session.disconnect();
  }
  expect(disposals).toBe(1);
});
