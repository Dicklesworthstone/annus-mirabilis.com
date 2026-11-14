import { afterEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { createBm01Recording, measureBm01 } from "../../workers/operations/bm01.ts";
import { evaluateBm06 } from "../../workers/operations/bm06.ts";
import { bm01ScientificState } from "../bm01/tapeCheckpoint.ts";
import {
  decodeTapeDocument,
  encodeTapePermalink,
  MAX_PERMALINK_URL_LENGTH,
} from "../permalink/codec.ts";
import { tapeStateDigestV2 } from "../permalink/sessionTape.ts";
import type { TapeGroupV3, TapeV2 } from "../permalink/types.ts";
import { encodeResult } from "../results/codec.ts";
import type { AcceptedSnapshot } from "../store/instanceStore.ts";
import {
  type BrownianRadiusExamples,
  createBrownianRadiusSession,
  restoreBrownianRadiusFromUrl,
  restoreBrownianRadiusTape,
  tapeForBrownianRadius,
} from "./brownianRadiusTape.ts";
import { loadBrownianRadiusGroup } from "./loadBrownianRadius.ts";
import { controlledOwner, smallBrownianExamples, waitFor } from "./testSupport.ts";

const definition = loadBrownianRadiusGroup();
const examples = await smallBrownianExamples();
const cleanups: (() => void)[] = [];
let instance = 0;
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function drivers(selected: BrownianRadiusExamples = examples) {
  const tracer = controlledOwner("bm-01", selected.tracer.sourceDigest);
  const density = controlledOwner("bm-06", selected.density.sourceDigest);
  return { tracer, density, factories: [tracer.factory, density.factory] as const };
}

function laboratory(selected: BrownianRadiusExamples = examples) {
  const controls = drivers(selected);
  const session = createBrownianRadiusSession(
    `brownian-tape-${++instance}`,
    definition,
    selected,
    controls.factories,
  );
  cleanups.push(() => session.group.disconnect());
  session.group.connect();
  return { ...controls, session };
}

function capture(session: ReturnType<typeof createBrownianRadiusSession>) {
  const tape = tapeForBrownianRadius(session);
  assert(tape, "The real accepted comparison must provide its complete settings.");
  return tape;
}

async function recorded(enabled = true) {
  const lab = laboratory();
  if (enabled) {
    lab.session.group.link(0.8e-6);
    await waitFor(() => lab.session.group.getSnapshot().status === "accepted");
  } else {
    lab.session.group.applyMember("bm-01", 0.8e-6);
    lab.session.group.applyMember("bm-06", 1.2e-6);
    await waitFor(() => lab.session.sessions.every((owner) => !owner.getSnapshot().pending));
  }
  return { ...lab, tape: capture(lab.session) };
}

function memberChange(
  tape: TapeGroupV3,
  id: string,
  update: (tape: TapeV2) => TapeV2,
): TapeGroupV3 {
  return {
    ...tape,
    members: tape.members.map((member) =>
      member.memberId === id ? { ...member, tape: update(member.tape) } : member,
    ),
  };
}

function settingsChange(
  tape: TapeGroupV3,
  id: string,
  patch: Record<string, number | string>,
): TapeGroupV3 {
  return memberChange(tape, id, (member) => {
    const initialConditions = { ...member.initialConditions, ...patch };
    return {
      ...member,
      initialConditions,
      acceptedCheckpoint: {
        ...member.acceptedCheckpoint,
        digest: tapeStateDigestV2(initialConditions, 0),
      },
    };
  });
}

function scalar(snapshot: AcceptedSnapshot, id: string): number {
  const output = snapshot.outputs.find((entry) => entry.quantityId === id);
  assert(output?.status === "value" && typeof output.value === "number");
  return output.value;
}

describe("Brownian linked settings tapes use the real numerical owners", () => {
  test("capture is worker-free and the complete comparison fits the existing bounded V3 transport", () => {
    const lab = laboratory();
    const tape = capture(lab.session);
    const encoded = encodeTapePermalink(tape);
    expect(encoded.length + "?tape=".length).toBeLessThanOrEqual(MAX_PERMALINK_URL_LENGTH);
    const decoded = decodeTapeDocument(encoded);
    assert(decoded.kind === "success");
    expect(decoded.tape).toEqual(tape);
    expect(tape.group.enabled).toBe(false);
    expect(tape.group.valueSI).toBeNull();
    expect(tape.members.map((member) => member.memberId)).toEqual(["bm-01", "bm-06"]);
    expect(tape.members[0]?.tape.replayGrid).toEqual({
      baseSpacing: examples.tracer.parameters.h,
      horizon: examples.tracer.parameters.H,
    });
    expect(tape.members[0]?.tape.initialConditions.interval).toBe(
      examples.tracer.parameters.interval,
    );
    expect(lab.tracer.creations + lab.density.creations).toBe(0);
  });

  test("an active link restores one fresh coherent generation with one request per owner", async () => {
    const source = await recorded();
    const before = source.session.group.getSnapshot();
    const controls = drivers();
    const result = await restoreBrownianRadiusFromUrl(
      "reopened-brownian",
      definition,
      examples,
      controls.factories,
      `https://example.test/lab/bm-01/linked/?tape=${encodeTapePermalink(source.tape)}`,
    );
    expect(result.kind).toBe("restored");
    assert(result.kind === "restored");
    const session = result.session;
    cleanups.push(() => session.group.disconnect());
    const state = session.group.getSnapshot();
    expect(result.notice).toContain("recalculated from the shared settings");
    expect(result.notice).toContain("does not store its previous trajectory");
    expect(state.enabled).toBe(true);
    expect(state.status).toBe("accepted");
    expect(state.generationId).toBe(1);
    expect(state.coherent?.value).toBe(0.8e-6);
    expect(state.displayed.map((snapshot) => snapshot.parameters.a)).toEqual([0.8e-6, 0.8e-6]);
    expect(new Set(state.displayed.map((snapshot) => snapshot.instanceId)).size).toBe(2);
    expect(new Set(state.displayed.map((snapshot) => snapshot.runId)).size).toBe(2);
    expect(
      state.displayed.every((snapshot) => snapshot.instanceId.startsWith("reopened-brownian")),
    ).toBe(true);
    expect(state.displayed.map((snapshot) => snapshot.runId)).not.toEqual(
      before.displayed.map((snapshot) => snapshot.runId),
    );
    expect([controls.tracer.requests.length, controls.density.requests.length]).toEqual([1, 1]);
    const [tracer, density] = state.displayed;
    assert(tracer && density);
    expect(scalar(tracer, "diffusionCoefficient")).toBe(scalar(density, "diffusionCoefficient"));
    expect(capture(session)).toEqual(source.tape);
    session.group.connect();
    expect([controls.tracer.requests.length, controls.density.requests.length]).toEqual([1, 1]);
    expect(source.session.group.getSnapshot()).toBe(before);
    expect([controls.tracer.disposals, controls.density.disposals]).toEqual([0, 0]);
  });

  test("unlinked tapes restore different radii without opting the reader into a group", async () => {
    const source = await recorded(false);
    const controls = drivers();
    const result = await restoreBrownianRadiusTape(
      "independent-copy",
      definition,
      examples,
      controls.factories,
      source.tape,
    );
    assert(result.kind === "restored");
    cleanups.push(() => result.session.group.disconnect());
    expect(result.session.group.getSnapshot().enabled).toBe(false);
    expect(result.session.group.getSnapshot().coherent).toBeNull();
    expect(
      result.session.group.getSnapshot().displayed.map((snapshot) => snapshot.parameters.a),
    ).toEqual([0.8e-6, 1.2e-6]);
    expect([controls.tracer.requests.length, controls.density.requests.length]).toEqual([1, 1]);
    const density = result.session.sessions[1].getSnapshot().accepted;
    result.session.group.applyMember("bm-01", 2e-6);
    await waitFor(() => !result.session.sessions[0].getSnapshot().pending);
    expect(result.session.sessions[1].getSnapshot().accepted).toBe(density);
    expect(controls.density.requests).toHaveLength(1);
  });

  test("capture keeps the displayed coherent settings while pending or refused owners have drifted", async () => {
    const lab = await recorded();
    lab.density.hold();
    lab.session.group.update(1.2e-6);
    await waitFor(
      () =>
        lab.density.held.length === 1 &&
        lab.session.sessions[0].getSnapshot().accepted?.parameters.a === 1.2e-6,
    );
    expect(lab.session.group.getSnapshot().status).toBe("pending");
    expect(capture(lab.session)).toEqual(lab.tape);
    lab.session.group.update(0.05e-6);
    expect(lab.session.group.getSnapshot().status).toBe("incomplete");
    expect(capture(lab.session)).toEqual(lab.tape);
    lab.density.release();
  });

  test("a first pending or refused link cannot be shared as an accepted group", async () => {
    const lab = laboratory();
    lab.density.hold();
    lab.session.group.link(1e-6);
    await waitFor(() => lab.density.held.length === 1);
    expect(tapeForBrownianRadius(lab.session)).toBeNull();
    lab.session.group.update(0.05e-6);
    expect(tapeForBrownianRadius(lab.session)).toBeNull();
    lab.density.release();
  });

  test("the full 64-bit seed and finite measurement interval survive independently of recording time", async () => {
    const parameters = {
      ...examples.tracer.parameters,
      seed: "18446744073709551615",
      interval: 0.1,
    };
    const recording = await createBm01Recording(parameters, { yieldControl: async () => {} });
    assert(recording.kind === "accepted");
    const measurement = measureBm01(recording.data, parameters, false);
    assert(measurement.kind === "accepted");
    const densityParameters = { ...examples.density.parameters, t: parameters.interval };
    const density = await evaluateBm06(densityParameters, { yieldControl: async () => {} });
    assert(density.kind === "accepted");
    const selected: BrownianRadiusExamples = {
      tracer: {
        ...examples.tracer,
        parameters,
        results: measurement.data.outputs.map(encodeResult),
        stepIndex: measurement.data.stepIndex,
        simulationTime: measurement.data.simulationTime,
      },
      density: {
        ...examples.density,
        parameters: densityParameters,
        results: density.data.outputs.map(encodeResult),
        stepIndex: density.data.stepIndex,
        simulationTime: density.data.simulationTime,
      },
    };
    const source = laboratory(selected);
    source.session.group.link(1e-6);
    await waitFor(() => source.session.group.getSnapshot().status === "accepted");
    const tape = capture(source.session);
    const decoded = decodeTapeDocument(encodeTapePermalink(tape));
    assert(decoded.kind === "success");
    const controls = drivers(selected);
    const result = await restoreBrownianRadiusTape(
      "large-seed",
      definition,
      selected,
      controls.factories,
      decoded.tape,
    );
    assert(result.kind === "restored");
    cleanups.push(() => result.session.group.disconnect());
    const [tracer, spreading] = result.session.group.getSnapshot().displayed;
    assert(tracer && spreading);
    expect(tracer.parameters.seed).toBe("18446744073709551615");
    expect(tracer.parameters.interval).toBe(0.1);
    expect(spreading.parameters.t).toBe(0.1);
    expect(tracer.simulationTime).toBe(0.2);
    expect(spreading.simulationTime).toBe(0.1);
    expect(tracer.stepIndex).toBe(10);
    expect(scalar(tracer, "rmsDisplacement1d")).toBe(scalar(spreading, "rmsDisplacement1d"));
  });

  test("model, source, constants, stream, seed and grid mismatches start no calculation", async () => {
    const { tape } = await recorded();
    const controls = drivers();
    const variants = [
      memberChange(tape, "bm-01", (member) => ({
        ...member,
        modelIdentity: { ...member.modelIdentity, modelVersion: 2 },
      })),
      memberChange(tape, "bm-06", (member) => ({
        ...member,
        modelIdentity: { ...member.modelIdentity, artifactDigest: "host:0000000000000000" },
      })),
      memberChange(tape, "bm-01", (member) => ({
        ...member,
        constantSetId: "different-constants",
      })),
      memberChange(tape, "bm-01", (member) => ({ ...member, streamVersion: "different-stream" })),
      memberChange(tape, "bm-01", (member) => ({
        ...member,
        allocationId: "different-allocation",
      })),
      memberChange(tape, "bm-01", (member) => ({ ...member, seed: "1" as TapeV2["seed"] })),
      memberChange(tape, "bm-01", (member) => ({
        ...member,
        replayGrid: { baseSpacing: 0.04, horizon: 0.2 },
      })),
      memberChange(tape, "bm-01", (member) => ({ ...member, mode: "bm-01:other" })),
    ];
    for (const variant of variants)
      expect(
        (
          await restoreBrownianRadiusTape(
            "incompatible",
            definition,
            examples,
            controls.factories,
            variant,
          )
        ).kind,
      ).toBe("not-restored");
    expect(controls.tracer.creations + controls.density.creations).toBe(0);
    expect(controls.tracer.requests).toEqual([]);
    expect(controls.density.requests).toEqual([]);
  });

  test("fixed lesson inputs cannot change beneath the captions, even with a valid settings digest", async () => {
    const { tape } = await recorded();
    const controls = drivers();
    for (const [id, patch] of [
      ["bm-01", { T: 300 }],
      ["bm-01", { interval: 0.1 }],
      ["bm-01", { M: 24 }],
      ["bm-01", { d: 2 }],
      ["bm-06", { t: 0.1 }],
      ["bm-06", { gridEnabled: "true" }],
      [
        "bm-06",
        {
          copiedDiffusivityInstanceId: "another-lab",
          copiedDiffusivityRunId: "another-run",
          copiedDiffusivitySnapshotVersion: 1,
          copiedDiffusivityValue: 1e-12,
        },
      ],
    ] as const) {
      const restored = await restoreBrownianRadiusTape(
        "fixed-inputs",
        definition,
        examples,
        controls.factories,
        settingsChange(tape, id, patch),
      );
      expect(restored.kind).toBe("not-restored");
    }
    const omitted = memberChange(tape, "bm-01", (member) => {
      const { M: _omitted, ...initialConditions } = member.initialConditions;
      return {
        ...member,
        initialConditions,
        acceptedCheckpoint: {
          ...member.acceptedCheckpoint,
          digest: tapeStateDigestV2(initialConditions, 0),
        },
      };
    });
    const restored = await restoreBrownianRadiusTape(
      "omitted-fixed",
      definition,
      examples,
      controls.factories,
      omitted,
    );
    expect(restored.kind === "not-restored" && restored.notice).toContain(
      "complete original settings",
    );
    expect(controls.tracer.creations + controls.density.creations).toBe(0);
  });

  test("missing members are named, and no undeclared member, quantity or approximate SI value is accepted", async () => {
    const { tape } = await recorded();
    const controls = drivers();
    const missing = await restoreBrownianRadiusTape(
      "missing-density",
      definition,
      examples,
      controls.factories,
      { ...tape, members: tape.members.filter((member) => member.memberId !== "bm-06") },
    );
    expect(missing.kind === "not-restored" && missing.notice).toContain("missing BM-06");
    for (const variant of [
      { ...tape, group: { ...tape.group, quantityId: "frameSpeed" } },
      { ...tape, group: { ...tape.group, valueSI: 0.8e-6 + 1e-16 } },
      { ...tape, group: { ...tape.group, valueSI: 0.05e-6 } },
      { ...tape, members: tape.members.map((member) => ({ ...member, parameterId: "T" })) },
      { ...tape, members: tape.members.map((member) => ({ ...member, displayUnit: "m" })) },
      settingsChange(tape, "bm-06", { a: 1.2e-6 }),
    ])
      expect(
        (
          await restoreBrownianRadiusTape(
            "invalid-relation",
            definition,
            examples,
            controls.factories,
            variant,
          )
        ).kind,
      ).toBe("not-restored");
    expect(controls.tracer.creations + controls.density.creations).toBe(0);
  });

  test("event histories, predictions and scientific receipts cannot silently become settings-only replays", async () => {
    const { tape } = await recorded();
    const controls = drivers();
    for (const variant of [
      memberChange(tape, "bm-01", (member) => ({
        ...member,
        events: [{ actionIndex: 1, commandClass: "setup-change", paramId: "a", value: 1.2e-6 }],
      })),
      memberChange(tape, "bm-01", (member) => ({
        ...member,
        teachingTapeRef: { tapeId: "einstein-0-8-micron", stepIndex: 0 },
      })),
      memberChange(tape, "bm-01", (member) => ({
        ...member,
        predictions: [
          { promptId: "brownian-radius", form: "candidate", payload: { candidateId: "wider" } },
        ],
      })),
      memberChange(tape, "bm-01", (member) => ({
        ...member,
        acceptedCheckpoint: { ...member.acceptedCheckpoint, acceptedActionIndex: 1 },
      })),
      memberChange(tape, "bm-01", (member) => ({
        ...member,
        acceptedCheckpoint: { ...member.acceptedCheckpoint, acceptedInputRevision: 1 },
      })),
      memberChange(tape, "bm-01", (member) => ({
        ...member,
        acceptedCheckpoint: {
          ...member.acceptedCheckpoint,
          scientificState: bm01ScientificState(examples.tracer.parameters),
        },
      })),
    ])
      expect(
        (
          await restoreBrownianRadiusTape(
            "unsupported-replay",
            definition,
            examples,
            controls.factories,
            variant,
          )
        ).kind,
      ).toBe("not-restored");
    expect(controls.tracer.creations + controls.density.creations).toBe(0);
  });

  test("a corrupt second checkpoint is rejected before either owner runs", async () => {
    const { tape, session } = await recorded();
    const before = session.group.getSnapshot();
    const controls = drivers();
    const corrupt = memberChange(tape, "bm-06", (member) => ({
      ...member,
      acceptedCheckpoint: { ...member.acceptedCheckpoint, digest: "host:0000000000000000" },
    }));
    const result = await restoreBrownianRadiusTape(
      "corrupt",
      definition,
      examples,
      controls.factories,
      corrupt,
    );
    expect(result.kind === "not-restored" && result.notice).toContain(
      "do not match their checkpoint",
    );
    expect(controls.tracer.creations + controls.density.creations).toBe(0);
    expect(session.group.getSnapshot()).toBe(before);
  });

  test("one worker refusal or execution failure discards the private pair and retains the mounted comparison", async () => {
    const source = await recorded();
    const before = source.session.group.getSnapshot();
    for (const outcome of [false, true]) {
      const controls = drivers();
      controls.tracer.hold();
      if (outcome) controls.density.outcomeNext();
      else controls.density.refuseNext();
      const result = await restoreBrownianRadiusTape(
        "failed-worker",
        definition,
        examples,
        controls.factories,
        source.tape,
      );
      expect(result.kind).toBe("not-restored");
      expect(result.kind === "not-restored" && result.notice).toContain("BM-06");
      expect([controls.tracer.requests.length, controls.density.requests.length]).toEqual([1, 1]);
      expect([controls.tracer.disposals, controls.density.disposals]).toEqual([1, 1]);
      expect(source.session.group.getSnapshot()).toBe(before);
      controls.tracer.release();
    }
  });

  test("cancellation while one real worker is pending retires both owners without publishing a partial pair", async () => {
    const source = await recorded();
    const before = source.session.group.getSnapshot();
    const controls = drivers();
    controls.density.hold();
    const cancel = new AbortController();
    const restoring = restoreBrownianRadiusTape(
      "canceled-worker",
      definition,
      examples,
      controls.factories,
      source.tape,
      { signal: cancel.signal },
    );
    await waitFor(() => controls.density.held.length === 1);
    cancel.abort();
    const result = await restoring;
    expect(result.kind === "not-restored" && result.notice).toContain("canceled");
    expect([controls.tracer.disposals, controls.density.disposals]).toEqual([1, 1]);
    expect(source.session.group.getSnapshot()).toBe(before);
    controls.density.release();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(source.session.group.getSnapshot()).toBe(before);
  });

  test("a bounded restore timeout disposes the pending calculation", async () => {
    const { tape } = await recorded();
    const controls = drivers();
    controls.density.hold();
    const result = await restoreBrownianRadiusTape(
      "timeout",
      definition,
      examples,
      controls.factories,
      tape,
      { timeoutMs: 1000 },
    );
    expect(result.kind === "not-restored" && result.notice).toContain("did not finish in time");
    expect([controls.tracer.disposals, controls.density.disposals]).toEqual([1, 1]);
    controls.density.release();
  });

  test("ordinary URLs, standalone tapes, invalid input and canceled decoding do not start a worker", async () => {
    const lab = laboratory();
    const tape = capture(lab.session);
    const controls = drivers();
    expect(
      await restoreBrownianRadiusFromUrl(
        "absent",
        definition,
        examples,
        controls.factories,
        "not a URL",
      ),
    ).toEqual({ kind: "absent" });
    expect(
      await restoreBrownianRadiusFromUrl(
        "absent",
        definition,
        examples,
        controls.factories,
        "https://example.test/lab/bm-01/linked/",
      ),
    ).toEqual({ kind: "absent" });
    const first = tape.members[0];
    assert(first);
    expect(
      (
        await restoreBrownianRadiusTape(
          "single",
          definition,
          examples,
          controls.factories,
          first.tape,
        )
      ).kind,
    ).toBe("not-restored");
    expect(
      (
        await restoreBrownianRadiusFromUrl(
          "invalid",
          definition,
          examples,
          controls.factories,
          "https://example.test/lab/bm-01/linked/?tape=invalid%25",
        )
      ).kind,
    ).toBe("not-restored");
    const cancel = new AbortController();
    cancel.abort();
    const canceled = await restoreBrownianRadiusFromUrl(
      "canceled-decode",
      definition,
      examples,
      controls.factories,
      `https://example.test/lab/bm-01/linked/?tape=${encodeTapePermalink(tape)}`,
      cancel.signal,
    );
    expect(canceled.kind === "not-restored" && canceled.notice).toContain("canceled");
    expect(controls.tracer.creations + controls.density.creations).toBe(0);
  });
});
