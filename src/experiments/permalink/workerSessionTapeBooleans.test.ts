import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { evaluatorSources } from "../../../scripts/generate-inference.mjs";
import { createBm07Recording, measureBm07 } from "../../workers/operations/bm07.ts";
import { BM07_DEFAULTS } from "../bm07/definition.ts";
import { BM07_DRAFT_TAPE } from "../bm07/draftTape.ts";
import { createBm07Session } from "../bm07/session.ts";
import { createSchedulingPause } from "../lifecycle/schedulingPause.ts";
import { encodeResult } from "../results/codec.ts";
import { draftTapeForSettings } from "./draftTape.ts";
import type { TapeControlEvent, TapeV2 } from "./types.ts";
import { restoreWorkerTape, type WorkerTapeBinding } from "./workerSessionTape.ts";

// The scientific owner supplies the real starting snapshot. These tests stop at its policy
// boundary on purpose: they prove the shared planner decodes a boolean's previous value before
// comparing it, not that a made-up checkpoint proves a numerical replay.
const sources = createHash("sha256");
for (const [path, text] of await evaluatorSources()) {
  sources.update(`${path}\0${Buffer.byteLength(text)}\0`).update(text);
}
const sourceDigest = `source:sha256:${sources.digest("hex")}`;
const recording = await createBm07Recording(BM07_DEFAULTS, { yieldControl: async () => {} });
assert.equal(recording.kind, "accepted");
const evaluated = await measureBm07(recording.data, BM07_DEFAULTS, false);
assert.equal(evaluated.kind, "accepted");
const example = {
  sourceDigest,
  parameters: BM07_DEFAULTS,
  stepIndex: evaluated.data.stepIndex,
  simulationTime: evaluated.data.simulationTime,
  results: evaluated.data.outputs.map(encodeResult),
};
const policyBoundary = "The complete parameter history reached the scientific checkpoint policy.";
let instance = 0;

function plannedLab(events: readonly TapeControlEvent[]) {
  let workers = 0;
  const workerFactory = () => {
    workers++;
    throw new Error("Structural planning must not start a worker before scientific admission.");
  };
  const owner = createBm07Session(`boolean-plan-${++instance}`, example, workerFactory);
  const session = {
    ...owner,
    ...createSchedulingPause((paused) => owner.setSchedulingPaused(paused)),
  };
  const histories: (readonly Readonly<Record<string, unknown>>[])[] = [];
  const binding: WorkerTapeBinding = {
    ...BM07_DRAFT_TAPE,
    createSession: () => {
      throw new Error("An unadmitted checkpoint must not allocate a private session.");
    },
    scientificReplay: {
      validate(_tape, states) {
        histories.push(states);
        return policyBoundary;
      },
      async verify() {
        throw new Error("No numerical verification is allowed before structural admission.");
      },
    },
  };
  const draft = draftTapeForSettings(binding, BM07_DEFAULTS);
  assert.ok(draft);
  const tape: TapeV2 = {
    ...draft,
    events,
    acceptedCheckpoint: {
      ...draft.acceptedCheckpoint,
      acceptedActionIndex: events.at(-1)?.actionIndex ?? 0,
    },
  };
  return { session, binding, tape, histories, workers: () => workers };
}

const radiusChange = (
  actionIndex: number,
  previousValue: string,
  value: string,
): TapeControlEvent => ({
  actionIndex,
  commandClass: "estimator-change",
  paramId: "radiusKnown",
  previousValue,
  value,
});

test("scientific planning compares canonical false and true against the typed boolean history", async () => {
  const lab = plannedLab([radiusChange(1, "false", "true"), radiusChange(2, "true", "false")]);
  const before = lab.session.getSnapshot();
  try {
    expect(await restoreWorkerTape(lab.binding, lab.session, lab.tape)).toEqual({
      kind: "not-restored",
      notice: policyBoundary,
    });
    expect(lab.histories.map((states) => states.map((state) => state.radiusKnown))).toEqual([
      [false, true, false],
    ]);
    expect(lab.session.getSnapshot()).toBe(before);
    expect(lab.workers()).toBe(0);
  } finally {
    lab.session.disconnect();
  }
});

test("a false previous-value claim cannot overwrite the actual typed boolean history", async () => {
  for (const previous of ["true", "FALSE", "0"]) {
    const lab = plannedLab([radiusChange(1, previous, "true")]);
    const before = lab.session.getSnapshot();
    try {
      expect(await restoreWorkerTape(lab.binding, lab.session, lab.tape)).toEqual({
        kind: "not-restored",
        notice: "A recorded change does not begin at its stated previous value.",
      });
      expect(lab.histories).toEqual([]);
      expect(lab.session.getSnapshot()).toBe(before);
      expect(lab.workers()).toBe(0);
    } finally {
      lab.session.disconnect();
    }
  }
});

test("boolean decoding does not coerce a numeric setting's previous value from a string", async () => {
  const lab = plannedLab([
    {
      actionIndex: 1,
      commandClass: "measurement-change",
      paramId: "M",
      previousValue: String(BM07_DEFAULTS.M),
      value: BM07_DEFAULTS.M + 1,
    },
  ]);
  const before = lab.session.getSnapshot();
  try {
    expect(await restoreWorkerTape(lab.binding, lab.session, lab.tape)).toEqual({
      kind: "not-restored",
      notice: "A recorded change does not begin at its stated previous value.",
    });
    expect(lab.histories).toEqual([]);
    expect(lab.session.getSnapshot()).toBe(before);
    expect(lab.workers()).toBe(0);
  } finally {
    lab.session.disconnect();
  }
});
