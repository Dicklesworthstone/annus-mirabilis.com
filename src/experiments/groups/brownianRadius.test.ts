import { afterEach, describe, expect, test } from "bun:test";
import { createWorkerAdmission } from "../../workers/scheduler/admission.ts";
import { createBm01Session } from "../bm01/session.ts";
import { createBm06Session } from "../bm06/session.ts";
import type { AcceptedSnapshot } from "../store/instanceStore.ts";
import { assertBrownianComparisonInputs, createBrownianRadiusGroup } from "./brownianRadius.ts";
import { loadBrownianRadiusGroup } from "./loadBrownianRadius.ts";
import { ExperimentGroupDefinitionError } from "./schema.ts";
import { controlledOwner, smallBrownianExamples, waitFor } from "./testSupport.ts";

const examples = await smallBrownianExamples();
const definition = loadBrownianRadiusGroup();
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function laboratory(options: Readonly<{ onError?: (error: unknown) => void }> = {}) {
  const tracer = controlledOwner("bm-01", examples.tracer.sourceDigest);
  const density = controlledOwner("bm-06", examples.density.sourceDigest);
  const resources = { admission: createWorkerAdmission(2), retention: null };
  const tracerSession = createBm01Session(
    "linked-tracers",
    examples.tracer,
    tracer.factory,
    resources,
  );
  const densitySession = createBm06Session(
    "linked-density",
    examples.density,
    density.factory,
    resources,
  );
  const group = createBrownianRadiusGroup(definition, [tracerSession, densitySession], options);
  cleanups.push(() => group.disconnect());
  group.connect();
  return { group, tracer, density, tracerSession, densitySession };
}

function scalar(snapshot: AcceptedSnapshot | undefined, quantityId: string): number {
  const output = snapshot?.outputs.find((entry) => entry.quantityId === quantityId);
  if (output?.status !== "value" || typeof output.value !== "number")
    throw new Error("The real owner must publish the requested scalar.");
  return output.value;
}

describe("coherent linked Brownian owners", () => {
  test("invalid-experiment-group refuses mismatched physics, copied diffusivity and a different coordinate (brownianRadius.ts:39)", () => {
    expect(() =>
      assertBrownianComparisonInputs(examples.tracer.parameters, examples.density.parameters),
    ).not.toThrow();
    for (const patch of [
      { T: 300 },
      { eta: 0.002 },
      { interval: 0.1 },
      { constantSetId: "einstein-1905-brownian-printed" },
      { d: 2 },
      { axis: 1 },
    ])
      expect(() =>
        assertBrownianComparisonInputs(
          { ...examples.tracer.parameters, ...patch },
          examples.density.parameters,
        ),
      ).toThrow("same temperature, viscosity and observation interval");
    for (const patch of [
      { gridEnabled: true },
      { copiedDiffusivityValue: 1e-12 },
      { copiedDiffusivityInstanceId: "some-other-trial" },
      { copiedDiffusivitySnapshotVersion: 2 },
    ])
      expect(() =>
        assertBrownianComparisonInputs(examples.tracer.parameters, {
          ...examples.density.parameters,
          ...patch,
        }),
      ).toThrow("no copied diffusivity");
    let caught: unknown;
    try {
      assertBrownianComparisonInputs(examples.tracer.parameters, {
        ...examples.density.parameters,
        gridEnabled: true,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ExperimentGroupDefinitionError);
    expect((caught as ExperimentGroupDefinitionError).code).toBe("invalid-experiment-group");
  });

  test("is opt-in, sends one request per owner, and leaves another mounted copy independent", async () => {
    const lab = laboratory();
    const spareTransport = controlledOwner("bm-01", examples.tracer.sourceDigest);
    const spare = createBm01Session("unlinked-copy", examples.tracer, spareTransport.factory);
    cleanups.push(() => spare.disconnect());
    const spareBefore = spare.getSnapshot().accepted;
    const before = lab.group.getSnapshot().displayed;
    expect(lab.group.getSnapshot().enabled).toBe(false);
    lab.group.update(1e-6);
    expect(lab.tracer.creations + lab.density.creations).toBe(0);
    lab.group.link(1e-6);
    await waitFor(() => lab.group.getSnapshot().status === "accepted");
    const view = lab.group.getSnapshot();
    expect(view.generationId).toBe(1);
    expect(view.coherent?.value).toBe(1e-6);
    expect(lab.tracer.requests).toHaveLength(1);
    expect(lab.density.requests).toHaveLength(1);
    expect(view.displayed.map((snapshot) => snapshot.parameters.a)).toEqual([1e-6, 1e-6]);
    expect(view.displayed.map((snapshot) => snapshot.instanceId)).toEqual([
      "linked-tracers",
      "linked-density",
    ]);
    expect(view.displayed[0]?.runId).not.toBe(before[0]?.runId);
    expect(view.displayed[1]?.runId).not.toBe(before[1]?.runId);
    expect(spare.getSnapshot().accepted).toBe(spareBefore);
    expect(spareTransport.creations).toBe(0);
    const diffusionRatio =
      scalar(view.displayed[0], "diffusionCoefficient") / scalar(before[0], "diffusionCoefficient");
    const rmsRatio =
      scalar(view.displayed[0], "rmsDisplacement1d") / scalar(before[0], "rmsDisplacement1d");
    expect(diffusionRatio).toBeCloseTo(0.5, 12);
    expect(rmsRatio).toBeCloseTo(1 / Math.SQRT2, 12);
    expect(scalar(view.displayed[0], "rmsDisplacement1d")).toBe(
      scalar(view.displayed[1], "rmsDisplacement1d"),
    );
    expect(lab.tracer.errors).toEqual([]);
    expect(lab.density.errors).toEqual([]);
  });

  test("withholds one completed member and never publishes a superseded generation", async () => {
    const lab = laboratory();
    lab.group.link(0.5e-6);
    await waitFor(() => lab.group.getSnapshot().status === "accepted");
    const first = lab.group.getSnapshot().coherent;
    const commits: number[] = [];
    const unsubscribe = lab.group.subscribe(() => {
      const generation = lab.group.getSnapshot().coherent?.generationId;
      if (generation !== undefined && commits.at(-1) !== generation) commits.push(generation);
    });
    cleanups.push(unsubscribe);
    lab.density.hold();
    lab.group.update(1e-6);
    await waitFor(
      () =>
        lab.density.held.length === 1 &&
        lab.tracerSession.getSnapshot().accepted?.parameters.a === 1e-6,
    );
    expect(lab.group.getSnapshot().status).toBe("pending");
    expect(lab.group.getSnapshot().coherent).toBe(first);
    expect(lab.group.getSnapshot().displayed.map((snapshot) => snapshot.parameters.a)).toEqual([
      0.5e-6, 0.5e-6,
    ]);
    expect(lab.group.getSnapshot().members.map((member) => member.status)).toEqual([
      "accepted",
      "pending",
    ]);

    lab.group.update(2e-6);
    lab.density.release();
    await waitFor(() => lab.group.getSnapshot().status === "accepted");
    expect(lab.group.getSnapshot().generationId).toBe(3);
    expect(lab.group.getSnapshot().coherent?.generationId).toBe(3);
    expect(commits).not.toContain(2);
    expect(lab.group.getSnapshot().displayed.map((snapshot) => snapshot.parameters.a)).toEqual([
      2e-6, 2e-6,
    ]);
  });

  test("a refusing member retains the last complete pair without rolling back the other owner", async () => {
    const lab = laboratory();
    lab.group.link(0.5e-6);
    await waitFor(() => lab.group.getSnapshot().status === "accepted");
    const first = lab.group.getSnapshot().coherent;
    lab.density.refuseNext();
    lab.group.update(1e-6);
    await waitFor(
      () =>
        lab.group.getSnapshot().status === "incomplete" &&
        lab.tracerSession.getSnapshot().accepted?.parameters.a === 1e-6,
    );
    const view = lab.group.getSnapshot();
    expect(view.coherent).toBe(first);
    expect(view.displayed.map((snapshot) => snapshot.parameters.a)).toEqual([0.5e-6, 0.5e-6]);
    expect(view.members[1]?.status).toBe("refused");
    expect(view.members[1]?.failure?.kind).toBe("refused");
    expect(view.requestedValue).toBe(1e-6);
    // Each owner still owns its state; the group has not forged a rollback.
    expect(lab.tracerSession.getSnapshot().accepted?.parameters.a).toBe(1e-6);
    expect(lab.densitySession.getSnapshot().accepted?.parameters.a).toBe(0.5e-6);
    lab.group.update(1e-6);
    await waitFor(() => lab.group.getSnapshot().status === "accepted");
    expect(lab.group.getSnapshot().displayed.map((snapshot) => snapshot.parameters.a)).toEqual([
      1e-6, 1e-6,
    ]);
  });

  test("preflights the intersection, names the excluding member, and sends no illegal request", async () => {
    const lab = laboratory();
    lab.group.link(0.5e-6);
    await waitFor(() => lab.group.getSnapshot().status === "accepted");
    const first = lab.group.getSnapshot().coherent;
    const counts = [lab.tracer.requests.length, lab.density.requests.length];
    lab.group.update(0.05e-6); // valid for BM-06, below BM-01's declared minimum
    expect(lab.group.getSnapshot().status).toBe("incomplete");
    expect(lab.group.getSnapshot().coherent).toBe(first);
    expect(lab.group.getSnapshot().members[0]?.failure?.text).toContain("BM-01");
    expect(lab.group.getSnapshot().members[1]?.failure).toBeNull();
    expect([lab.tracer.requests.length, lab.density.requests.length]).toEqual(counts);
  });

  test("unlink keeps accepted values and run identities; one later action changes only its owner", async () => {
    const lab = laboratory();
    lab.group.link(1e-6);
    await waitFor(() => lab.group.getSnapshot().status === "accepted");
    const accepted = lab.group.getSnapshot().displayed;
    const counts = [lab.tracer.requests.length, lab.density.requests.length];
    lab.group.unlink();
    expect(lab.group.getSnapshot().enabled).toBe(false);
    expect(lab.group.getSnapshot().displayed).toEqual(accepted);
    expect([lab.tracer.requests.length, lab.density.requests.length]).toEqual(counts);
    lab.group.applyMember("bm-01", 2e-6);
    await waitFor(() => lab.tracerSession.getSnapshot().accepted?.parameters.a === 2e-6);
    expect(lab.densitySession.getSnapshot().accepted).toBe(accepted[1]);
    expect(lab.density.requests).toHaveLength(counts[1] ?? 0);
  });

  test("unmount during a pending group cancels without a hidden run and can reconnect independently", async () => {
    const lab = laboratory();
    lab.density.hold();
    lab.group.link(1e-6);
    await waitFor(() => lab.density.held.length === 1);
    const requests = [lab.tracer.requests.length, lab.density.requests.length];
    const runIds = [
      lab.tracerSession.getSnapshot().requested?.runId,
      lab.densitySession.getSnapshot().requested?.runId,
    ];
    lab.group.disconnect();
    lab.density.release();
    expect(lab.group.getSnapshot().enabled).toBe(false);
    expect(lab.tracer.disposals).toBe(1);
    expect(lab.density.disposals).toBe(1);
    expect([lab.tracer.requests.length, lab.density.requests.length]).toEqual(requests);
    expect([
      lab.tracerSession.getSnapshot().requested?.runId,
      lab.densitySession.getSnapshot().requested?.runId,
    ]).toEqual(runIds);
    lab.group.connect();
    expect(lab.group.getSnapshot().status).toBe("independent");
    expect(lab.tracer.creations).toBe(1);
    expect(lab.density.creations).toBe(1);
  });

  test("teardown resists a reentrant subscriber and still notifies after another subscriber throws", async () => {
    const errors: unknown[] = [];
    const lab = laboratory({ onError: (error) => errors.push(error) });
    lab.group.link(1e-6);
    await waitFor(() => lab.group.getSnapshot().status === "accepted");
    const requests = [lab.tracer.requests.length, lab.density.requests.length];
    let notified = false;
    const unsubscribeBroken = lab.group.subscribe(() => {
      throw new Error("Broken group view");
    });
    const unsubscribeReentrant = lab.group.subscribe(() => {
      notified = true;
      if (!lab.group.getSnapshot().enabled) {
        lab.group.connect();
        lab.group.link(2e-6);
      }
    });
    lab.group.disconnect();
    expect(notified).toBe(true);
    expect(errors.length).toBeGreaterThan(0);
    expect(lab.group.getSnapshot().enabled).toBe(false);
    expect(lab.group.getSnapshot().status).toBe("independent");
    expect([lab.tracer.requests.length, lab.density.requests.length]).toEqual(requests);
    expect(lab.tracer.disposals).toBe(1);
    expect(lab.density.disposals).toBe(1);
    unsubscribeBroken();
    unsubscribeReentrant();
  });

  test("disconnect during either linked or independent issue retires a scheduler created afterward", async () => {
    for (const linked of [true, false]) {
      const lab = laboratory();
      let disconnected = false;
      const unsubscribe = lab.tracerSession.subscribe(() => {
        if (!disconnected && lab.tracerSession.getSnapshot().pending) {
          disconnected = true;
          lab.group.disconnect();
        }
      });
      cleanups.push(unsubscribe);
      if (linked) lab.group.link(1e-6);
      else lab.group.applyMember("bm-01", 1e-6);
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(disconnected).toBe(true);
      expect(lab.group.getSnapshot().enabled).toBe(false);
      expect(lab.tracer.disposals).toBe(lab.tracer.creations);
      expect(lab.density.creations).toBe(0);
      expect(lab.density.requests).toHaveLength(0);
      const creations = lab.tracer.creations;
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(lab.tracer.creations).toBe(creations);
    }
  });

  test("unlink during synchronous issue cancels a late-created worker request without changing accepted values", async () => {
    const lab = laboratory();
    const accepted = lab.tracerSession.getSnapshot().accepted;
    let unlinked = false;
    const unsubscribe = lab.tracerSession.subscribe(() => {
      if (!unlinked && lab.tracerSession.getSnapshot().pending) {
        unlinked = true;
        lab.group.unlink();
      }
    });
    cleanups.push(unsubscribe);
    lab.group.link(1e-6);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(unlinked).toBe(true);
    expect(lab.group.getSnapshot().enabled).toBe(false);
    expect(lab.tracerSession.getSnapshot().pending).toBe(false);
    expect(lab.tracerSession.getSnapshot().accepted).toBe(accepted);
    expect(lab.density.requests).toHaveLength(0);
  });

  test("a superseded independent apply cannot erase a newer shared refusal", async () => {
    const lab = laboratory();
    let linked = false;
    const unsubscribe = lab.tracerSession.subscribe(() => {
      if (!linked && lab.tracerSession.getSnapshot().pending) {
        linked = true;
        lab.group.link(0.05e-6);
      }
    });
    cleanups.push(unsubscribe);
    lab.group.applyMember("bm-01", 1e-6);
    await waitFor(() => !lab.tracerSession.getSnapshot().pending);
    expect(linked).toBe(true);
    expect(lab.group.getSnapshot().status).toBe("incomplete");
    expect(lab.group.getSnapshot().members[0]?.failure?.kind).toBe("refused");
    expect(lab.group.getSnapshot().requestedValue).toBe(0.05e-6);
  });

  test("an execution outcome stays distinct from a model refusal and preserves the last pair", async () => {
    const lab = laboratory();
    lab.group.link(0.5e-6);
    await waitFor(() => lab.group.getSnapshot().status === "accepted");
    const accepted = lab.group.getSnapshot().coherent;
    lab.density.outcomeNext();
    lab.group.update(1e-6);
    await waitFor(() => lab.group.getSnapshot().status === "incomplete");
    const failure = lab.group.getSnapshot().members[1]?.failure;
    expect(failure?.kind).toBe("unavailable");
    expect(failure?.kind === "unavailable" && failure.outcome.outcome).toBe("invariant-violation");
    expect(lab.group.getSnapshot().coherent).toBe(accepted);
  });
});
